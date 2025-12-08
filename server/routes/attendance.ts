import { Router } from 'express';
import { storage } from '../storage';
import { insertAttendanceSessionSchema, insertAttendanceCheckInSchema, type User } from '../../shared/schema';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth, requireManager } from '../middleware/auth';
// @ts-ignore - json2csv doesn't have type definitions
import { parse } from 'json2csv';
import { AttendanceGoogleSync } from '../services/attendance-google-sync';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const router = Router();

let attendanceGoogleSync: AttendanceGoogleSync | null = null;

// Initialize Google sync if available
export function initializeAttendanceGoogleSync(googleSync: any) {
  if (googleSync) {
    attendanceGoogleSync = new AttendanceGoogleSync();
    attendanceGoogleSync.initialize().catch(console.error);
  }
}

// Create a new attendance session (Manager only)
router.post('/sessions', requireManager, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = insertAttendanceSessionSchema.parse({
      name: req.body.name,
      location: req.body.location,
      startsAt: req.body.startsAt ? new Date(req.body.startsAt) : new Date(),
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : new Date(Date.now() + 4 * 60 * 60 * 1000),
      createdByUserId: req.user.id,
      qrToken: crypto.randomUUID(),
      status: 'ACTIVE' as const,
      notes: req.body.notes || null,
    });

    // Storage method expects InsertAttendanceSession (will generate id internally)
    const session = await storage.createAttendanceSession(validatedData as any);
    
    // Generate QR URL with proper public URL detection
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = process.env.VITE_BASE_URL || `${proto}://${host}`;
    const qrUrl = `${baseUrl}/attendance/check-in?sid=${session.id}&t=${session.qrToken}`;
    console.log('Generated QR URL:', qrUrl);
    
    // Sync to Google Sheets if available
    if (attendanceGoogleSync) {
      attendanceGoogleSync.syncAttendanceSession(session).catch(console.error);
    }
    
    res.json({ ...session, qrUrl });
  } catch (error) {
    console.error('Error creating attendance session:', error);
    const message = error instanceof Error ? error.message : 'Failed to create session';
    res.status(400).json({ error: message });
  }
});

// Get session by ID (Auth required)
router.get('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const session = await storage.getAttendanceSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const checkIns = await storage.getCheckInsBySessionId(session.id);
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = process.env.VITE_BASE_URL || `${proto}://${host}`;
    const qrUrl = `${baseUrl}/attendance/check-in?sid=${session.id}&t=${session.qrToken}`;
    
    res.json({ ...session, qrUrl, checkIns });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all sessions (Manager only)
router.get('/sessions', requireManager, async (req, res) => {
  try {
    const sessions = req.query.active === 'true' 
      ? await storage.getActiveAttendanceSessions()
      : await storage.getAllAttendanceSessions();
    
    // Add QR URLs to session list
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = process.env.VITE_BASE_URL || `${proto}://${host}`;
    
    const sessionsWithQR = sessions.map(session => ({
      ...session,
      qrUrl: `${baseUrl}/attendance/check-in?sid=${session.id}&t=${session.qrToken}`
    }));
      
    res.json(sessionsWithQR);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update session (Manager only) 
router.patch('/sessions/:id', requireManager, async (req, res) => {
  try {
    const session = await storage.updateAttendanceSession(req.params.id, req.body);
    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update session notes (Manager only)
router.patch('/sessions/:id/notes', requireManager, async (req, res) => {
  try {
    const { notes } = req.body;
    const session = await storage.updateAttendanceSession(req.params.id, { notes });
    
    // Sync updated notes to Google Sheets
    if (attendanceGoogleSync && session) {
      const checkIns = await storage.getCheckInsBySessionId(session.id);
      attendanceGoogleSync.syncAttendanceSession({ ...session, checkIns }).catch(console.error);
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error updating session notes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rotate session token (Manager only)
router.post('/sessions/:id/rotate-token', requireManager, async (req, res) => {
  try {
    const session = await storage.rotateSessionToken(req.params.id);
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = process.env.VITE_BASE_URL || `${proto}://${host}`;
    const qrUrl = `${baseUrl}/attendance/check-in?sid=${session.id}&t=${session.qrToken}`;
    res.json({ ...session, qrUrl });
  } catch (error) {
    console.error('Error rotating token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Close session (Manager only)
router.post('/sessions/:id/close', requireManager, async (req, res) => {
  try {
    const session = await storage.closeAttendanceSession(req.params.id);
    
    // Sync closed session to Google Sheets
    if (attendanceGoogleSync && session) {
      const checkIns = await storage.getCheckInsBySessionId(session.id);
      attendanceGoogleSync.syncAttendanceSession({ ...session, checkIns }).catch(console.error);
      // Generate monthly summary after closing a session
      attendanceGoogleSync.generateMonthlySummary().catch(console.error);
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error closing session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session details for check-in (Public with token validation) 
router.get('/sessions/:id/public', async (req, res) => {
  try {
    const { t: token } = req.query;
    
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }
    
    const session = await storage.getAttendanceSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.qrToken !== token) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Don't include sensitive information in public response
    const publicSession = {
      id: session.id,
      name: session.name,
      location: session.location,
      status: session.status,
      startsAt: session.startsAt,
      expiresAt: session.expiresAt,
      notes: session.notes,
    };
    
    res.json(publicSession);
  } catch (error) {
    console.error('Error fetching public session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check in to a session (Public with token validation)
router.post('/sessions/:id/check-in', async (req, res) => {
  try {
    const { name, location, email, userId } = req.body;
    const { t: token } = req.query;
    
    // Validate session exists and token matches
    const session = await storage.getAttendanceSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.qrToken !== token) {
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Session is closed' });
    }
    
    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Session has expired' });
    }
    
    // Check for duplicate check-in
    const hasCheckedIn = await storage.hasUserCheckedIn(session.id, userId || null, name);
    if (hasCheckedIn) {
      return res.status(400).json({ error: 'Already checked in to this session' });
    }
    
    // Create check-in
    const checkInData = insertAttendanceCheckInSchema.parse({
      sessionId: session.id,
      name,
      email: email || null,
      location: session.location, // Use session's location (RICHMOND | PHILLY | DMV)
      userId: userId || null,
      userAgent: req.get('User-Agent') || null,
      ipHash: crypto.createHash('sha256').update(req.ip || '').digest('hex'),
      latLng: req.body.latLng || null,
    });

    // Storage method expects InsertAttendanceCheckIn (will generate id internally)
    const checkIn = await storage.createAttendanceCheckIn(checkInData as any);
    
    // Emit WebSocket event for real-time updates
    if (req.app.locals.io) {
      req.app.locals.io.emit(`attendance:${session.id}`, {
        type: 'check-in',
        payload: checkIn
      });
    }
    
    // Update Google Sheets with new check-in
    if (attendanceGoogleSync) {
      const sessionWithCheckIns = await storage.getAttendanceSessionById(session.id);
      if (sessionWithCheckIns) {
        const checkIns = await storage.getCheckInsBySessionId(session.id);
        attendanceGoogleSync.syncAttendanceSession({ ...sessionWithCheckIns, checkIns }).catch(console.error);
      }
    }
    
    res.json({ success: true, checkIn });
  } catch (error) {
    console.error('Error checking in:', error);
    const message = error instanceof Error ? error.message : 'Failed to check in';
    res.status(400).json({ error: message });
  }
});

// Export session attendance as CSV (Manager only)
router.get('/sessions/:id/export.csv', requireManager, async (req, res) => {
  try {
    const session = await storage.getAttendanceSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const checkIns = await storage.exportSessionAttendance(session.id);
    
    // Transform data for CSV
    const csvData = checkIns.map(checkIn => ({
      Name: checkIn.name,
      Email: checkIn.email || '',
      Location: checkIn.location,
      'Checked In At': new Date(checkIn.checkedInAt).toLocaleString(),
    }));
    
    if (csvData.length === 0) {
      return res.status(200).send('Name,Email,Location,Checked In At\n');
    }
    
    const csv = parse(csvData, { fields: ['Name', 'Email', 'Location', 'Checked In At'] });
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="attendance_${session.name}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting attendance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance analytics (Manager only)
router.get('/analytics', requireManager, async (req, res) => {
  try {
    const { from, to, location } = req.query;
    
    let sessions = await storage.getAllAttendanceSessions();
    
    // Filter by date range if provided
    if (from) {
      sessions = sessions.filter(s => new Date(s.createdAt) >= new Date(from as string));
    }
    if (to) {
      sessions = sessions.filter(s => new Date(s.createdAt) <= new Date(to as string));
    }
    if (location) {
      sessions = sessions.filter(s => s.location === location);
    }
    
    // Calculate analytics
    const totalSessions = sessions.length;
    let totalAttendees = 0;
    const locationBreakdown: Record<string, number> = {};
    
    for (const session of sessions) {
      const checkIns = await storage.getCheckInsBySessionId(session.id);
      totalAttendees += checkIns.length;
      
      if (!locationBreakdown[session.location]) {
        locationBreakdown[session.location] = 0;
      }
      locationBreakdown[session.location] += checkIns.length;
    }
    
    const avgAttendancePerSession = totalSessions > 0 ? totalAttendees / totalSessions : 0;
    
    res.json({
      totalSessions,
      totalAttendees,
      avgAttendancePerSession,
      locationBreakdown,
      sessions: sessions.slice(0, 10), // Return latest 10 sessions
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;