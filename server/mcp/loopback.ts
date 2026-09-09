/**
 * Loopback — how every MCP tool reads Roof HR.
 *
 * A tool never queries the database. It calls the app's own HTTP route on
 * 127.0.0.1 (the port this process listens on) AS the token's person. Roof HR
 * has no JWT: `requireAuth` looks a bearer up in the `sessions` table. So for
 * each tool call this module:
 *
 *   1. inserts a session row for the person with `agent_scope = 'mcp:read'`,
 *      a random token and `expires_at = now + 5 minutes`,
 *   2. GETs the route with that bearer,
 *   3. deletes the row again (finally — a crash cannot leave it behind for
 *      longer than the five minutes).
 *
 * Two things follow from that, and they are the whole design:
 *
 *   - The route applies the app's own authorization (requireAuth, the role
 *     groups, authzService, per-row filtering). A tool returns exactly what
 *     that person can already see in the app. Nothing here re-implements
 *     scoping.
 *   - `agent_scope = 'mcp:read'` is the ceiling: the auth middleware never
 *     sliding-renews such a session and refuses it on any non-GET/HEAD
 *     request (server/middleware/auth.ts, server/routes.ts), so a read token
 *     cannot write even through a bug in a tool.
 *
 * Nothing from the MCP request is forwarded except the validated arguments,
 * and only the query params each tool whitelists. Nothing is cached across
 * calls except the user lookup (60 s).
 */

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import type { Mcp21Context, Mcp21Result } from '@omj21/mcp21';
import { MCP_READ_SCOPE } from './scope';

export const LOOPBACK_TIMEOUT_MS = 15_000;
export const LOOPBACK_SESSION_TTL_MS = 5 * 60_000;
const USER_CACHE_TTL_MS = 60_000;

export type LoopbackUser = { id: string; email: string; role: string };

/** Same env the server listens on (server/config.ts: PORT || 5000). */
export function loopbackBaseUrl(): string {
  const port = parseInt(process.env.PORT || '5000', 10);
  return `http://127.0.0.1:${port}`;
}

const userCache = new Map<string, { user: LoopbackUser | null; at: number }>();

/** The token's user, if still active. Cached briefly; the routes re-check on every call anyway. */
export async function resolveLoopbackUser(userId: string): Promise<LoopbackUser | null> {
  const hit = userCache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < USER_CACHE_TTL_MS) return hit.user;
  // Lazy so the tool registry (and its unit tests) load without opening a pool.
  const { storage } = await import('../storage');
  const row = await storage.getUserById(userId);
  const user: LoopbackUser | null = row && row.isActive !== false
    ? { id: row.id, email: row.email, role: row.role }
    : null;
  userCache.set(userId, { user, at: now });
  return user;
}

export function invalidateLoopbackUserCache(userId?: string): void {
  if (userId) userCache.delete(userId);
  else userCache.clear();
}

/**
 * Run `fn` with a short-lived read-only session for the person, then delete
 * the row. Exported for the integration test, which proves such a session
 * cannot POST.
 */
export async function withLoopbackSession<T>(userId: string, fn: (bearer: string) => Promise<T>): Promise<T> {
  const { db } = await import('../db');
  const { sessions } = await import('../../shared/schema');
  const id = crypto.randomUUID();
  const token = `mcpsess_${crypto.randomBytes(32).toString('base64url')}`;
  await db.insert(sessions).values({
    id,
    userId,
    token,
    expiresAt: new Date(Date.now() + LOOPBACK_SESSION_TTL_MS),
    agentScope: MCP_READ_SCOPE,
  });
  try {
    return await fn(token);
  } finally {
    await db.delete(sessions).where(eq(sessions.id, id)).catch((err: unknown) => {
      console.warn('[mcp] loopback session cleanup failed (expires in 5 min anyway):', (err as Error).message);
    });
  }
}

/** A path segment from a tool argument: encoded, never empty, never a path escape. */
export function segment(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s || s.length > 128 || s.includes('/') || s.includes('\\') || s === '.' || s === '..') return null;
  return encodeURIComponent(s);
}

function queryFrom(args: Record<string, unknown>, allowed: readonly string[]): URLSearchParams {
  const qs = new URLSearchParams();
  for (const key of allowed) {
    const value = args[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) qs.set(key, value.map((v) => String(v)).join(','));
    else qs.set(key, String(value));
  }
  return qs;
}

function plainRefusal(status: number, body: unknown): string {
  const b = (body ?? {}) as { error?: unknown; message?: unknown };
  const detail = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : '';
  if (status === 401) return "Roof HR did not accept this token's session; try again in a moment.";
  if (status === 403) return `This person is not allowed to see that in Roof HR${detail ? `: ${detail}` : '.'}`;
  if (status === 404) return `Not found${detail ? `: ${detail}` : '.'}`;
  if (status === 400) return `Roof HR refused the request${detail ? `: ${detail}` : '.'}`;
  if (status === 429) return 'Roof HR is rate limiting this person right now; try again shortly.';
  return `Roof HR could not answer (HTTP ${status})${detail ? `: ${detail}` : '.'}`;
}

export type LoopbackOptions = {
  /** Route path, already containing any encoded path segments, e.g. `/api/pto-policies/employee/${id}` */
  path: string;
  /** The tool's validated arguments. */
  args: Record<string, unknown>;
  /** Query params this tool may forward (the route's real params — nothing else reaches the URL). */
  query?: readonly string[];
  /** Extra fixed query params. */
  fixedQuery?: Record<string, string>;
  /** Project the route's JSON before returning it. */
  pick?: (json: unknown) => unknown;
};

/** GET one of Roof HR's own routes as the token's person. Returns `{ json }` or a plain-sentence `isError`. */
export async function loopbackGet(context: Mcp21Context, options: LoopbackOptions): Promise<Mcp21Result> {
  const user = await resolveLoopbackUser(context.auth.principal.id);
  if (!user) {
    return { isError: true, text: 'The person behind this token is no longer active in Roof HR.' };
  }

  const qs = queryFrom(options.args, options.query ?? []);
  for (const [k, v] of Object.entries(options.fixedQuery ?? {})) qs.set(k, v);
  const suffix = qs.toString();
  const url = `${loopbackBaseUrl()}${options.path}${suffix ? `?${suffix}` : ''}`;

  const timeout = AbortSignal.timeout(LOOPBACK_TIMEOUT_MS);
  const signal = AbortSignal.any([context.signal, timeout]);

  return withLoopbackSession(user.id, async (bearer) => {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: 'application/json',
          'X-Request-Id': context.requestId,
        },
        signal,
      });
    } catch (err) {
      if (timeout.aborted) return { isError: true, text: 'Roof HR took longer than 15 seconds to answer; try a narrower request.' };
      if (context.signal.aborted) return { isError: true, text: 'The request was cancelled.' };
      const reason = err instanceof Error ? err.message : String(err);
      return { isError: true, text: `Roof HR could not be reached over loopback (${reason}).` };
    }

    let body: unknown = null;
    const raw = await res.text();
    if (raw) {
      try { body = JSON.parse(raw); } catch { body = null; }
    }
    if (!res.ok) {
      return { isError: true, text: plainRefusal(res.status, body) };
    }
    if (body === null && raw) {
      return { isError: true, text: 'Roof HR answered with something other than JSON.' };
    }
    return { json: options.pick ? options.pick(body) : body };
  });
}
