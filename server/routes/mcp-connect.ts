/**
 * The three endpoints behind "Connect Susan to Roof HR".
 *
 *   GET  /api/mcp/connect/request   (as the person)  — what is this app asking for?
 *   POST /api/mcp/connect/approve   (as the person)  — mint for ME, hand back a code
 *   POST /api/mcp/connect/exchange  (app server)     — code + app secret -> the token
 *
 * The first two require a Roof HR session, so the person is authenticated BY
 * ROOF HR, not asserted by the app that sent them. The third is server-to-server
 * and never sees a user session at all. See server/mcp/connect.ts for why the
 * flow is shaped this way.
 */

import { Router, type Response } from 'express';
import crypto from 'crypto';
import { generateToken } from '@omj21/mcp21';
import { db } from '../db';
import { mcpTokens } from '../../shared/schema';
import { requireAuth } from '../middleware/auth';
import { validateRequestedScopes } from '../mcp/areas';
import { MCP_TOKEN_PREFIX } from '../mcp/server';
import { MCP_ENDPOINT_URL } from './mcp-tokens';
import {
  appSecret,
  describeAreas,
  findConnectApp,
  grantableAreas,
  issueCode,
  redeemCode,
  redirectAllowed,
  secretMatches,
} from '../mcp/connect';

const router = Router();

/** How long a connection lasts before the person has to approve it again. */
const CONNECT_EXPIRY_DAYS = 180;
const MAX_STATE = 512;

/**
 * What is this app asking for, and what may I actually grant?
 *
 * Answers for the SIGNED-IN caller — the app's claim about who they are is not
 * consulted anywhere in this file.
 */
router.get('/request', requireAuth, async (req: any, res: Response) => {
  const app = findConnectApp(req.query.app);
  if (!app) return res.status(404).json({ error: 'That app is not one Roof HR can be connected to.' });
  if (!appSecret(app)) {
    return res.status(503).json({ error: `${app.displayName} is not configured to connect yet.` });
  }
  if (!redirectAllowed(app, req.query.redirect_uri)) {
    // Deliberately not echoed back: an attacker probing redirects learns nothing.
    return res.status(400).json({ error: 'That return address is not registered for this app.' });
  }

  const areas = grantableAreas(app, req.user);
  res.json({
    app: { slug: app.slug, displayName: app.displayName, purpose: app.purpose },
    you: { name: [req.user.firstName, req.user.lastName].filter(Boolean).join(' '), email: req.user.email, role: req.user.role },
    grants: describeAreas(areas),
    // Areas the app wanted that this person's role cannot reach. Shown so the
    // consent screen can be honest about what is being left out.
    withheld: describeAreas(app.requestedAreas.filter((a) => !areas.includes(a))),
    readOnly: true,
    expiresInDays: CONNECT_EXPIRY_DAYS,
  });
});

/**
 * Approve. Mints a token for the AUTHENTICATED CALLER — `req.user.id`, never a
 * value from the request body — and returns a one-time code, not the token.
 */
router.post('/approve', requireAuth, async (req: any, res: Response) => {
  const body = (req.body ?? {}) as { app?: unknown; redirect_uri?: unknown; state?: unknown };

  const app = findConnectApp(body.app);
  if (!app) return res.status(404).json({ error: 'That app is not one Roof HR can be connected to.' });
  if (!appSecret(app)) {
    return res.status(503).json({ error: `${app.displayName} is not configured to connect yet.` });
  }
  const redirectUri = String(body.redirect_uri ?? '').trim();
  if (!redirectAllowed(app, redirectUri)) {
    return res.status(400).json({ error: 'That return address is not registered for this app.' });
  }
  const state = String(body.state ?? '');
  if (state.length > MAX_STATE) return res.status(400).json({ error: 'That request is malformed.' });

  const areas = grantableAreas(app, req.user);
  if (areas.length === 0) {
    return res.status(403).json({ error: 'Your role does not reach anything this app is asking for.' });
  }

  // Re-validated against the caller's role rather than trusted from `areas`:
  // one gate, used by every path that mints.
  const validated = validateRequestedScopes(req.user, areas.map((a) => `${a}:read`));
  if (!validated.ok) return res.status(400).json({ error: validated.error });

  try {
    const { token, hash, hint } = generateToken(MCP_TOKEN_PREFIX);
    const [row] = await db
      .insert(mcpTokens)
      .values({
        id: crypto.randomUUID(),
        userId: req.user.id,
        name: `${app.displayName} (connected)`,
        tokenHash: hash,
        tokenHint: hint,
        scopes: validated.scopes,
        expiresAt: new Date(Date.now() + CONNECT_EXPIRY_DAYS * 86_400_000),
      })
      .returning();

    const code = issueCode({
      appSlug: app.slug,
      redirectUri,
      userId: req.user.id,
      token,
      tokenId: row.id,
      scopes: validated.scopes,
    });

    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    // The token is NOT here. Only the code, which is useless without the app's secret.
    res.status(201).json({ redirectTo: target.toString(), scopes: validated.scopes });
  } catch (err) {
    console.error('[mcp-connect] approve failed:', (err as Error).message);
    res.status(500).json({ error: 'Could not connect that app. Try again.' });
  }
});

/**
 * Exchange. Server-to-server: the app proves it is itself with its secret, and
 * the code proves a person approved this. Both are required; neither alone does
 * anything. No Roof HR session is involved, and none is accepted.
 */
router.post('/exchange', async (req: any, res: Response) => {
  const body = (req.body ?? {}) as { app?: unknown; code?: unknown; redirect_uri?: unknown; client_secret?: unknown };

  const app = findConnectApp(body.app);
  const expected = app ? appSecret(app) : null;
  // Same refusal whether the app is unknown, unconfigured, or the secret is
  // wrong — an exchange caller learns only that it failed.
  if (!app || !expected || !secretMatches(body.client_secret, expected)) {
    return res.status(401).json({ error: 'This app could not be authenticated.' });
  }

  const redirectUri = String(body.redirect_uri ?? '').trim();
  const result = redeemCode(body.code, { appSlug: app.slug, redirectUri });
  if (!result.ok) return res.status(400).json({ error: result.reason });

  const { record } = result;
  res.json({
    token: record.token,
    tokenId: record.tokenId,
    scopes: record.scopes,
    endpoint: MCP_ENDPOINT_URL,
    readOnly: true,
    // So the app can key the token to the right person on its own side WITHOUT
    // guessing from an email: this is Roof HR's id for whoever approved.
    roofhrUserId: record.userId,
  });
});

export default router;
