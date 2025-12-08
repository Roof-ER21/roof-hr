import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export async function requireAuth(req: any, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    console.log('[Auth] Looking up session for token:', token?.substring(0, 10) + '...');
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

    console.log('[Auth] User authenticated:', user.email);
    req.user = user;
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
  
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
}

export function requireAdmin(req: any, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}