/**
 * The Roof HR MCP endpoint — mounted at /mcp (server/index.ts).
 *
 * Built on @omj21/mcp21, which owns transport, 401/503, scope enforcement,
 * tools/list filtering, JSON-Schema validation, result rendering and the audit
 * callback. Roof HR owns the three host hooks below:
 *
 *   authenticate — sha256 the bearer, find the live mcp_tokens row, make sure
 *                  the person is still active (same check requireAuth uses),
 *                  stamp last_used_at, hand back a READ-ONLY auth.
 *   audit        — one mcp_audit_log row per tools/call (argument keys only).
 *   disabled     — MCP_ACCESS_DISABLED=true answers 503 before auth.
 *
 * Pass one is read-only regardless of stored scopes: `readOnly: true` hides
 * and refuses every write tool, and the loopback session is 'mcp:read' anyway.
 */

import crypto from 'crypto';
import { and, eq, isNull, or, gt, desc } from 'drizzle-orm';
import type { Request } from 'express';
import { createMcp21, hashToken, type Mcp21Auth, type Mcp21AuditEvent } from '@omj21/mcp21';
import { db } from '../db';
import { mcpTokens, mcpAuditLog, users } from '../../shared/schema';
import { MCP_TOOLS } from './tools';

export const MCP_TOKEN_PREFIX = 'roofhr';
const LAST_USED_STAMP_INTERVAL_MS = 60_000;

/** tokenId → userId, so the audit hook needs no second lookup. */
const tokenOwner = new Map<string, string>();

export function isMcpAccessDisabled(): boolean {
  return process.env.MCP_ACCESS_DISABLED === 'true';
}

/** Resolve a bearer token to a read-only auth, or null (→ 401). */
export async function authenticateMcpToken(bearerToken: string): Promise<Mcp21Auth | null> {
  if (typeof bearerToken !== 'string' || bearerToken.length < 16 || bearerToken.length > 512) return null;
  const hash = hashToken(bearerToken);
  const now = new Date();

  const [row] = await db
    .select({
      id: mcpTokens.id,
      userId: mcpTokens.userId,
      scopes: mcpTokens.scopes,
      lastUsedAt: mcpTokens.lastUsedAt,
      userRole: users.role,
      userEmail: users.email,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userIsActive: users.isActive,
    })
    .from(mcpTokens)
    .innerJoin(users, eq(users.id, mcpTokens.userId))
    .where(and(
      eq(mcpTokens.tokenHash, hash),
      isNull(mcpTokens.revokedAt),
      or(isNull(mcpTokens.expiresAt), gt(mcpTokens.expiresAt, now)),
    ))
    .limit(1);
  if (!row) return null;

  // Same active check requireAuth applies to every session.
  if (row.userIsActive === false) return null;

  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_STAMP_INTERVAL_MS) {
    db.update(mcpTokens)
      .set({ lastUsedAt: now })
      .where(eq(mcpTokens.id, row.id))
      .catch((err: unknown) => console.warn('[mcp] last_used_at stamp failed:', (err as Error).message));
  }

  tokenOwner.set(row.id, row.userId);

  const fullName = [row.userFirstName, row.userLastName].filter(Boolean).join(' ').trim();
  return {
    principal: {
      id: row.userId,
      organizationId: 'roof-er',
      label: fullName || row.userEmail,
      role: row.userRole,
    },
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    tokenId: row.id,
    // Pass one: read-only by construction, whatever the stored scopes say.
    readOnly: true,
  };
}

async function ownerFor(event: Mcp21AuditEvent): Promise<string | null> {
  const cached = tokenOwner.get(event.tokenId);
  if (cached) return cached;
  const [row] = await db
    .select({ userId: mcpTokens.userId })
    .from(mcpTokens)
    .where(eq(mcpTokens.id, event.tokenId))
    .limit(1);
  if (!row) return null;
  tokenOwner.set(event.tokenId, row.userId);
  return row.userId;
}

/** One audit row per tools/call. Keys only — the kit never hands us values. */
export async function auditMcpCall(event: Mcp21AuditEvent): Promise<void> {
  const userId = await ownerFor(event);
  if (!userId) return;
  await db.insert(mcpAuditLog).values({
    id: crypto.randomUUID(),
    userId,
    tokenId: event.tokenId,
    requestId: event.requestId,
    tool: event.tool,
    area: event.area,
    access: event.access,
    argumentKeys: [...event.argumentKeys],
    ok: event.ok,
    error: event.error ? event.error.slice(0, 500) : null,
    durationMs: Math.round(event.durationMs),
    createdAt: event.at,
  });
}

/** Rate-limit key: the sha256 of the bearer (never the bearer). Empty when there is none. */
export function mcpRateLimitKey(req: Request): string {
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? /^\s*Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match ? `tok:${hashToken(match[1])}` : '';
}

export function createRoofHrMcpServer() {
  return createMcp21({
    name: 'roofhr',
    version: process.env.npm_package_version || '1.0.0',
    tools: MCP_TOOLS,
    authenticate: authenticateMcpToken,
    audit: auditMcpCall,
    disabled: isMcpAccessDisabled,
    maxBodyBytes: 256 * 1024,
  });
}

/** Rows written for one token, newest first — used by tests and (later) a "recent activity" view. */
export async function recentAuditForToken(tokenId: string, limit = 50) {
  return db
    .select()
    .from(mcpAuditLog)
    .where(eq(mcpAuditLog.tokenId, tokenId))
    .orderBy(desc(mcpAuditLog.createdAt))
    .limit(limit);
}
