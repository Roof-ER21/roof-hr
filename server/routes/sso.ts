/**
 * OIDC single sign-on (Google Workspace by default).
 *
 * DORMANT until SSO_OIDC_CLIENT_ID + SSO_OIDC_CLIENT_SECRET are set — the
 * status endpoint reports disabled and the login page shows no SSO button, so
 * deploying this costs nothing until credentials exist.
 *
 * Design (per the enterprise audit): the whole app authorizes off a `sessions`
 * row, so SSO only needs to mint the same row password login mints — zero
 * downstream changes. Password login keeps working alongside.
 *
 * Env:
 *   SSO_OIDC_CLIENT_ID / SSO_OIDC_CLIENT_SECRET  — enables SSO when both set
 *   SSO_OIDC_ISSUER        — default https://accounts.google.com
 *   SSO_OIDC_REDIRECT_URI  — default <request origin>/api/auth/sso/callback
 */
import express from 'express';
import * as oidc from 'openid-client';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { logAuthEvent } from '../middleware/audit';

const router = express.Router();

const CLIENT_ID = process.env.SSO_OIDC_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SSO_OIDC_CLIENT_SECRET || '';
const ISSUER = process.env.SSO_OIDC_ISSUER || 'https://accounts.google.com';
const ALLOWED_DOMAIN = 'theroofdocs.com';

export const ssoEnabled = () => !!(CLIENT_ID && CLIENT_SECRET);

let configPromise: Promise<oidc.Configuration> | null = null;
function getOidcConfig(): Promise<oidc.Configuration> {
  if (!configPromise) {
    configPromise = oidc.discovery(new URL(ISSUER), CLIENT_ID, CLIENT_SECRET);
    // A transient discovery failure must not poison every later attempt
    configPromise.catch(() => { configPromise = null; });
  }
  return configPromise;
}

function redirectUri(req: express.Request): string {
  return (
    process.env.SSO_OIDC_REDIRECT_URI ||
    `${req.protocol}://${req.get('host')}/api/auth/sso/callback`
  );
}

// Same semantics as password login's session mint (routes.ts)
function generateSessionToken(): string {
  return uuidv4() + '-' + Date.now();
}
function getSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

router.get('/api/auth/sso/status', (_req, res) => {
  res.json({ enabled: ssoEnabled(), provider: ssoEnabled() ? 'google' : null });
});

router.get('/api/auth/sso/login', async (req: any, res) => {
  if (!ssoEnabled()) {
    return res.status(404).json({ error: 'SSO is not configured' });
  }
  try {
    const config = await getOidcConfig();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();

    req.session.ssoCodeVerifier = codeVerifier;
    req.session.ssoState = state;

    const authUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri(req),
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      // Google: skip account chooser noise for single-account users, and
      // restrict the chooser to the workspace domain
      hd: ALLOWED_DOMAIN,
    });

    res.redirect(authUrl.href);
  } catch (err: any) {
    console.error('[SSO] Failed to start login:', err?.message);
    res.redirect('/login?error=sso_failed');
  }
});

router.get('/api/auth/sso/callback', async (req: any, res) => {
  if (!ssoEnabled()) {
    return res.status(404).json({ error: 'SSO is not configured' });
  }
  try {
    const config = await getOidcConfig();
    const codeVerifier = req.session?.ssoCodeVerifier;
    const expectedState = req.session?.ssoState;
    if (!codeVerifier || !expectedState) {
      console.warn('[SSO] Callback without session state (expired or cross-site)');
      return res.redirect('/login?error=sso_failed');
    }
    delete req.session.ssoCodeVerifier;
    delete req.session.ssoState;

    const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState,
    });

    const claims = tokens.claims();
    const email = String(claims?.email || '').toLowerCase();
    const emailVerified = claims?.email_verified === true;

    if (!email || !emailVerified) {
      logAuthEvent(req, 'LOGIN', { userEmail: email || 'unknown', success: false, reason: 'sso_unverified_email' });
      return res.redirect('/login?error=sso_failed');
    }
    if (email.split('@')[1] !== ALLOWED_DOMAIN) {
      logAuthEvent(req, 'LOGIN', { userEmail: email, success: false, reason: 'sso_wrong_domain' });
      return res.redirect('/login?error=sso_domain');
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      logAuthEvent(req, 'LOGIN', { userEmail: email, success: false, reason: 'sso_no_account' });
      return res.redirect('/login?error=sso_no_account');
    }
    if (user.isActive === false) {
      logAuthEvent(req, 'LOGIN', { userId: user.id, userEmail: user.email, success: false, reason: 'deactivated' });
      return res.redirect('/login?error=sso_deactivated');
    }

    const token = generateSessionToken();
    await storage.createSession({
      userId: user.id,
      token,
      expiresAt: getSessionExpiry(),
    });
    req.session.userId = user.id;

    logAuthEvent(req, 'LOGIN', { userId: user.id, userEmail: user.email, success: true, reason: 'sso' });

    // Hash fragment (never sent to servers/logs); login page stores it and
    // finishes exactly like password login
    res.redirect(`/login#sso_token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    console.error('[SSO] Callback failed:', err?.message);
    res.redirect('/login?error=sso_failed');
  }
});

export default router;
