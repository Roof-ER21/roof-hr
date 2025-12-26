import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { userEmailPreferences, insertUserEmailPreferencesSchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Middleware for auth
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// GET /api/email-preferences/:userId - Get user's email preferences
router.get('/api/email-preferences/:userId', requireAuth, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Check if user is accessing their own preferences or is an admin
    if (req.user.id !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const preferences = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId))
      .limit(1);

    if (preferences.length === 0) {
      // Return default preferences if none exist
      return res.json({
        userId,
        ptoRequestsAndApprovals: true,
        candidateUpdates: true,
        interviewReminders: true,
        taskNotifications: true,
        systemAnnouncements: true,
        weeklyDigest: false,
      });
    }

    res.json(preferences[0]);
  } catch (error) {
    console.error('Error fetching email preferences:', error);
    res.status(500).json({ error: 'Failed to fetch email preferences' });
  }
});

// PUT /api/email-preferences/:userId - Update user's preferences
router.put('/api/email-preferences/:userId', requireAuth, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Check if user is updating their own preferences or is an admin
    if (req.user.id !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if preferences already exist
    const existing = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing preferences
      const updated = await db
        .update(userEmailPreferences)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(userEmailPreferences.userId, userId))
        .returning();

      return res.json(updated[0]);
    } else {
      // Create new preferences
      const created = await db
        .insert(userEmailPreferences)
        .values({
          id: uuidv4(),
          userId,
          ptoRequestsAndApprovals: req.body.ptoRequestsAndApprovals ?? true,
          candidateUpdates: req.body.candidateUpdates ?? true,
          interviewReminders: req.body.interviewReminders ?? true,
          taskNotifications: req.body.taskNotifications ?? true,
          systemAnnouncements: req.body.systemAnnouncements ?? true,
          weeklyDigest: req.body.weeklyDigest ?? false,
        })
        .returning();

      return res.json(created[0]);
    }
  } catch (error) {
    console.error('Error updating email preferences:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid preferences data', details: error.message });
    }
    res.status(500).json({ error: 'Failed to update email preferences' });
  }
});

// POST /api/email-preferences - Create default preferences for a user
router.post('/api/email-preferences', requireAuth, async (req: any, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if user has permission (must be admin or the user themselves)
    if (req.user.id !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if preferences already exist
    const existing = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Email preferences already exist for this user',
        preferences: existing[0]
      });
    }

    // Create default preferences
    const created = await db
      .insert(userEmailPreferences)
      .values({
        id: uuidv4(),
        userId,
        ptoRequestsAndApprovals: true,
        candidateUpdates: true,
        interviewReminders: true,
        taskNotifications: true,
        systemAnnouncements: true,
        weeklyDigest: false,
      })
      .returning();

    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Error creating email preferences:', error);
    res.status(500).json({ error: 'Failed to create email preferences' });
  }
});

export default router;
