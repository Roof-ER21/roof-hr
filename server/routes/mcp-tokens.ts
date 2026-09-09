/**
 * Personal agent tokens — "Connected agents" in the UI.
 *
 *   GET    /api/mcp/tokens/areas  → the areas THIS person may mint, the endpoint URL
 *   GET    /api/mcp/tokens        → the caller's own tokens (hint + scopes, never the hash)
 *   POST   /api/mcp/tokens        { name, scopes: string[], expiresInDays? }
 *                                 → the plaintext token ONCE, plus hint
 *   DELETE /api/mcp/tokens/:id    → revoke (own token; admins may revoke anyone's)
 *
 * Pass one is reads only: a ":write" scope is refused in a plain sentence, and
 * an area outside the caller's role is refused by name (server/mcp/areas.ts).
 * A token is bound to the person who minted it and acts as them over /mcp.
 * A loopback session (agent_scope 'mcp:read') cannot reach these routes at
 * all — not even the list.
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { generateToken } from '@omj21/mcp21';
import { db } from '../db';
import { mcpTokens, type McpToken } from '../../shared/schema';
import { requireAuth, MCP_READ_SCOPE } from '../middleware/auth';
import { isAdmin } from '../../shared/constants/roles';
import { MCP_AREAS, MCP_AREA_LABELS, userCanMintArea, validateRequestedScopes } from '../mcp/areas';
import { MCP_TOKEN_PREFIX } from '../mcp/server';

// The URL agents connect to — the public origin. PUBLIC_URL wins so a
// self-host or preview controls the domain.
const APP_URL = (process.env.PUBLIC_URL || process.env.APP_URL || 'https://roofhr.up.railway.app').replace(/\/+$/, '');

export const MCP_ENDPOINT_URL = `${APP_URL}/mcp`;
const MAX_NAME = 80;
const MAX_EXPIRY_DAYS = 365;

function present(row: McpToken) {
  return {
    id: row.id,
    name: row.name,
    hint: row.tokenHint,
    scopes: row.scopes,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

const router = Router();
router.use(requireAuth);

// An agent's loopback session must not manage tokens — even reads of this list.
router.use((req: any, res: Response, next) => {
  if (req.agentScope === MCP_READ_SCOPE) {
    return res.status(403).json({ error: 'Read-only agent token.' });
  }
  next();
});

router.get('/areas', (req: any, res: Response) => {
  const user = req.user;
  res.json({
    endpoint: MCP_ENDPOINT_URL,
    readOnly: true,
    areas: MCP_AREAS.map((area) => ({
      area,
      scope: `${area}:read`,
      label: MCP_AREA_LABELS[area].label,
      description: MCP_AREA_LABELS[area].description,
      allowed: userCanMintArea(user, area),
    })),
  });
});

router.get('/', async (req: any, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(mcpTokens)
      .where(and(eq(mcpTokens.userId, req.user.id), isNull(mcpTokens.revokedAt)))
      .orderBy(desc(mcpTokens.createdAt));
    res.json({ tokens: rows.map(present), endpoint: MCP_ENDPOINT_URL });
  } catch (err) {
    console.error('[mcp-tokens] GET failed:', (err as Error).message);
    res.status(500).json({ error: 'Could not load agent tokens' });
  }
});

router.post('/', async (req: any, res: Response) => {
  const body = (req.body ?? {}) as { name?: unknown; scopes?: unknown; expiresInDays?: unknown };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > MAX_NAME) {
    return res.status(400).json({ error: `Give the token a name (1-${MAX_NAME} characters), such as the agent that will use it.` });
  }

  const validated = validateRequestedScopes(req.user, body.scopes);
  if (!validated.ok) return res.status(400).json({ error: validated.error });

  let expiresAt: Date | null = null;
  if (body.expiresInDays !== undefined && body.expiresInDays !== null && body.expiresInDays !== '') {
    const days = Number(body.expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > MAX_EXPIRY_DAYS) {
      return res.status(400).json({ error: `expiresInDays must be a whole number from 1 to ${MAX_EXPIRY_DAYS}.` });
    }
    expiresAt = new Date(Date.now() + days * 86_400_000);
  }

  try {
    const { token, hash, hint } = generateToken(MCP_TOKEN_PREFIX);
    const [row] = await db
      .insert(mcpTokens)
      .values({
        id: crypto.randomUUID(),
        userId: req.user.id,
        name,
        tokenHash: hash,
        tokenHint: hint,
        scopes: validated.scopes,
        expiresAt,
      })
      .returning();
    // The plaintext leaves the server exactly once, here. It is not logged.
    res.status(201).json({ ...present(row), token, endpoint: MCP_ENDPOINT_URL, readOnly: true });
  } catch (err) {
    console.error('[mcp-tokens] POST failed:', (err as Error).message);
    res.status(500).json({ error: 'Could not create the agent token' });
  }
});

router.delete('/:id', async (req: any, res: Response) => {
  const id = String(req.params.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid token id' });
  try {
    const [row] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, id)).limit(1);
    const ownsIt = row && row.userId === req.user.id;
    if (!row || (!ownsIt && !isAdmin(req.user))) {
      return res.status(404).json({ error: 'Token not found' });
    }
    if (row.revokedAt) {
      return res.json({ ...present(row), alreadyRevoked: true });
    }
    const [updated] = await db
      .update(mcpTokens)
      .set({ revokedAt: new Date() })
      .where(eq(mcpTokens.id, id))
      .returning();
    res.json(present(updated));
  } catch (err) {
    console.error('[mcp-tokens] DELETE failed:', (err as Error).message);
    res.status(500).json({ error: 'Could not revoke the agent token' });
  }
});

export default router;
