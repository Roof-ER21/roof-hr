import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { sessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  ADMIN_ROLES,
  MANAGER_ROLES,
  SYSTEM_ADMIN_ROLES,
  SUPER_ADMIN_EMAIL,
  isSystemAdmin,
  isAdmin,
  isManager,
} from '../../shared/constants/roles';
import { canApprovePtoRequests } from '../services/authzService';

// ─── Read-only agent sessions (MCP) ───────────────────────────────────────────
//
// An MCP tool never queries the database; it calls the app's own routes over
// loopback with a 5-minute session row whose `agent_scope` is 'mcp:read'
// (server/mcp/loopback.ts). That value is the ceiling: such a session is never
// sliding-renewed, and it is refused on any request that is not GET/HEAD — here
// in requireAuth and in the global session middleware in server/routes.ts, since
// a few routes (equipment-agreements, attendance) rely on the latter alone.

import { MCP_READ_SCOPE } from '../mcp/scope';
export { MCP_READ_SCOPE };

type SessionLike = { agentScope?: string | null } | null | undefined;

export function isReadOnlyAgentSession(session: SessionLike): boolean {
  return session?.agentScope === MCP_READ_SCOPE;
}

/**
 * Refuse a write attempted through a read-only agent session. Returns true when
 * the response has been sent (the caller must stop).
 */
export function refuseReadOnlyAgentWrite(session: SessionLike, req: Request, res: Response): boolean {
  if (!isReadOnlyAgentSession(session)) return false;
  if (req.method === 'GET' || req.method === 'HEAD') return false;
  res.status(403).json({ error: 'Read-only agent token.' });
  return true;
}

export async function requireAuth(req: any, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Deliberately quiet. This used to log a prefix of the live session token
    // and, below, the user's email on EVERY authenticated request - a rolling,
    // unredacted activity log of every employee sitting in Railway's log
    // retention, outside the audit table that was purpose-built for it.
    // Set DEBUG_AUTH=true to get it back while chasing a session bug.
    const session = await storage.getSessionByToken(token);
    if (!session) {
      console.log('[Auth] Session not found for token');
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    if (new Date(session.expiresAt) < new Date()) {
      console.log('[Auth] Session expired:', session.expiresAt);
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    console.log('[Auth] Session found, looking up user:', session.userId);
    const user = await storage.getUserById(session.userId);
    if (!user) {
      console.log('[Auth] User not found for id:', session.userId);
      return res.status(401).json({ error: 'User not found' });
    }

    // Deactivated (archived/terminated) users must not keep an authenticated
    // session — without this, an existing token would sliding-renew forever.
    if (user.isActive === false) {
      console.log('[Auth] Rejecting session for inactive user:', user.email);
      storage.deleteSessionsByUserId(user.id).catch((err: any) =>
        console.warn('[Auth] Session cleanup for inactive user failed:', err?.message));
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // A read-only agent session (MCP loopback) reads as the person and nothing
    // else: no write, no renewal. Routes still apply their own authorization
    // to req.user below.
    if (refuseReadOnlyAgentWrite(session, req, res)) return;

    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[Auth] User authenticated:', user.email);
    }
    req.user = user;
    req.agentScope = session.agentScope ?? null;

    if (isReadOnlyAgentSession(session)) {
      return next();
    }

    // Sliding session renewal — extend expiry by 24h on every authenticated request
    // Fire-and-forget (don't block the request)
    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + 24);
    db.update(sessions)
      .set({ expiresAt: newExpiry })
      .where(eq(sessions.id, session.id))
      .then(() => {})
      .catch((err: any) => console.warn('[Auth] Session renewal failed:', err?.message));

    next();
  } catch (error: any) {
    console.error('[Auth] Middleware error:', error?.message || error);
    console.error('[Auth] Stack:', error?.stack);
    return res.status(500).json({ error: 'Authentication error', details: error?.message });
  }
}

export function checkRole(allowedRoles: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Ahmed always has access (super admin email fallback)
    if (req.user.email === SUPER_ADMIN_EMAIL) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export function requireManager(req: any, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has manager access
  if (req.user.email === SUPER_ADMIN_EMAIL) {
    return next();
  }

  if (!isManager(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
}

export function requireAdmin(req: any, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has admin access
  if (isAdmin(req.user)) {
    return next();
  }

  return res.status(403).json({ error: 'Admin access required' });
}

export function requireSystemAdmin(req: any, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has system admin access
  if (isSystemAdmin(req.user)) {
    return next();
  }

  return res.status(403).json({ error: 'System admin access required' });
}

// PTO Approval - Only specific people can approve PTO (email-based restriction)
export function requirePtoApprover(req: any, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!canApprovePtoRequests(req.user)) {
    return res.status(403).json({
      error: 'PTO approval not permitted',
      message: 'Only authorized approvers can approve or deny PTO requests'
    });
  }

  next();
}
