/**
 * Connecting an agent to Roof HR, as yourself.
 *
 * Roof HR is the permissions key. Another Roof-ER app (Susan/sa21, CC24, Lite
 * Training) that wants to answer a person's Roof HR question must do it on a
 * token minted for THAT PERSON, so every answer passes through Roof HR's own
 * routes and its own role checks. The alternative — one shared service token —
 * silently hands every rep the privileges of whoever it was minted as, and the
 * one that exists today is a System Administrator.
 *
 * The rule this file exists to enforce: **the calling app never asserts who
 * the user is.** Identity is established twice, independently — the person
 * signs into the other app, and separately signs into Roof HR — and neither
 * app vouches for the other. What links the two accounts is a human completing
 * both logins, not a matching email string. A matching email is a guess; a
 * completed round-trip is proof.
 *
 * The shape is OAuth's authorization-code flow, kept small because both ends
 * are first-party:
 *
 *   1. The app sends the person here:  /connect/agent?app=…&redirect_uri=…&state=…
 *   2. Roof HR signs them in (its own session — this is the independent half)
 *      and shows what the app is asking for, narrowed to what their role can
 *      actually reach.
 *   3. On approve, Roof HR mints a token FOR THE AUTHENTICATED CALLER using the
 *      ordinary path, and hands back a one-time code — never the token.
 *   4. The app's SERVER exchanges that code, with its own secret, for the token.
 *
 * The code is single-use, short-lived, hashed at rest, bound to the app that
 * asked and to the redirect it was issued for. A stolen code is useless
 * without the app secret; a stolen secret is useless without a live code.
 */

import crypto from 'crypto';
import { mintableAreasForUser, MCP_AREA_LABELS, type McpArea } from './areas';

/** How long the person has to get from "Allow" to the app's server call. */
export const CODE_TTL_MS = 90_000;
/** Codes are few and short-lived; an in-process map is honest about that. */
const MAX_LIVE_CODES = 500;

export type ConnectApp = {
  slug: string;
  /** Shown on the consent screen. */
  displayName: string;
  /** One line: what this app will do with the access. */
  purpose: string;
  /** Exact-match allowlist. No wildcards, no prefixes — this is what stops a token being redirected to an attacker. */
  redirectUris: readonly string[];
  /** Areas the app asks for. Intersected with what the person's role can mint. */
  requestedAreas: readonly McpArea[];
  /** Env var holding this app's exchange secret. Absent/empty = the app cannot connect. */
  secretEnv: string;
};

/**
 * The apps allowed to ask. Deliberately a hand-maintained list rather than
 * dynamic registration: every entry is a decision about who may hold tokens
 * for Roof-ER employees.
 */
export const CONNECT_APPS: readonly ConnectApp[] = [
  {
    slug: 'sa21',
    displayName: 'Susan (sa21)',
    purpose: 'so Susan can answer your Roof HR questions as you, in the field app',
    redirectUris: [
      'https://sa21.theroofdocs.com/api/connect/roofhr/callback',
      'https://sa21.up.railway.app/api/connect/roofhr/callback',
      'http://localhost:5173/api/connect/roofhr/callback',
    ],
    requestedAreas: ['me', 'pto', 'employees', 'documents', 'meetings'],
    secretEnv: 'CONNECT_SECRET_SA21',
  },
];

export function findConnectApp(slug: unknown): ConnectApp | null {
  const s = String(slug ?? '').trim().toLowerCase();
  return CONNECT_APPS.find((a) => a.slug === s) ?? null;
}

/** Exact match only. A prefix or wildcard here would be an open redirect with a token on the end. */
export function redirectAllowed(app: ConnectApp, redirectUri: unknown): boolean {
  const uri = String(redirectUri ?? '').trim();
  return app.redirectUris.includes(uri);
}

export function appSecret(app: ConnectApp): string | null {
  const value = (process.env[app.secretEnv] || '').trim();
  return value.length >= 16 ? value : null;
}

/**
 * What this person can actually grant: what the app asked for, narrowed to
 * what their own role may mint. A rep is never shown — and can never approve —
 * an area their role does not reach.
 */
export function grantableAreas(app: ConnectApp, user: { role?: string | null; email?: string | null }): McpArea[] {
  const mintable = new Set(mintableAreasForUser(user));
  return app.requestedAreas.filter((area) => mintable.has(area));
}

export function describeAreas(
  areas: readonly McpArea[],
): { area: McpArea; scope: string; label: string; description: string }[] {
  return areas.map((area) => ({
    area,
    scope: `${area}:read`,
    label: MCP_AREA_LABELS[area]?.label ?? area,
    description: MCP_AREA_LABELS[area]?.description ?? '',
  }));
}

type CodeRecord = {
  appSlug: string;
  redirectUri: string;
  userId: string;
  token: string;
  tokenId: string;
  scopes: string[];
  expiresAt: number;
};

const codes = new Map<string, CodeRecord>();

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function sweep(): void {
  const now = Date.now();
  for (const [key, rec] of codes) if (rec.expiresAt <= now) codes.delete(key);
}

/** Issue a one-time code standing in for a freshly minted token. */
export function issueCode(input: Omit<CodeRecord, 'expiresAt'>): string {
  sweep();
  if (codes.size >= MAX_LIVE_CODES) {
    // Never grow without bound; the oldest live code is the least likely to be redeemed.
    const oldest = [...codes.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) codes.delete(oldest[0]);
  }
  const code = `rhc_${crypto.randomBytes(32).toString('base64url')}`;
  codes.set(hashCode(code), { ...input, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/**
 * Redeem a code. Single use: the record is removed whether or not the rest of
 * the check passes, so a code cannot be probed twice. The app slug and the
 * redirect it was issued for must both match what the exchanging app claims.
 */
export function redeemCode(
  code: unknown,
  expect: { appSlug: string; redirectUri: string },
): { ok: true; record: CodeRecord } | { ok: false; reason: string } {
  sweep();
  const key = hashCode(String(code ?? ''));
  const record = codes.get(key);
  codes.delete(key);
  if (!record) return { ok: false, reason: 'That connection code is not valid or has already been used.' };
  if (record.expiresAt <= Date.now()) return { ok: false, reason: 'That connection code has expired; connect again.' };
  if (record.appSlug !== expect.appSlug) return { ok: false, reason: 'That connection code was not issued to this app.' };
  if (record.redirectUri !== expect.redirectUri) {
    return { ok: false, reason: 'That connection code was issued for a different redirect.' };
  }
  return { ok: true, record };
}

/** Test seam. */
export function clearCodes(): void {
  codes.clear();
}

export function liveCodeCount(): number {
  sweep();
  return codes.size;
}

/**
 * Compare two secrets without leaking their relationship through timing.
 * Lengths are compared first because timingSafeEqual throws on a mismatch.
 */
export function secretMatches(provided: unknown, expected: string): boolean {
  const a = Buffer.from(String(provided ?? ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
