import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import {
  meetingRooms,
  meetings,
  insertMeetingRoomsSchema,
  type User
} from '@shared/schema';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import { requireAuth, requireManager } from '../middleware/auth';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const router = Router();

// GET /api/meeting-rooms - List all rooms (with optional filters)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { isActive, minCapacity } = req.query;

    let query = db.select().from(meetingRooms);
    let conditions = [];

    // Filter by active status
    if (isActive !== undefined) {
      conditions.push(eq(meetingRooms.isActive, isActive === 'true'));
    }

    // Apply filters if any
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    let rooms = await query;

    // Filter by minimum capacity (post-query as it's a >= operation)
    if (minCapacity) {
      const minCap = parseInt(minCapacity as string);
      if (!isNaN(minCap)) {
        rooms = rooms.filter(room => room.capacity >= minCap);
      }
    }

    res.json(rooms);
  } catch (error) {
    console.error('Error fetching meeting rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meeting-rooms/:id - Get specific room
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const room = await db
      .select()
      .from(meetingRooms)
      .where(eq(meetingRooms.id, req.params.id))
      .limit(1);

    if (!room || room.length === 0) {
      return res.status(404).json({ error: 'Meeting room not found' });
    }

    res.json(room[0]);
  } catch (error) {
    console.error('Error fetching meeting room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meeting-rooms - Create new room (manager only)
router.post('/', requireManager, async (req, res) => {
  try {
    const validatedData = insertMeetingRoomsSchema.parse(req.body);

    const newRoom = await db
      .insert(meetingRooms)
      .values({
        id: uuidv4(),
        ...validatedData,
      })
      .returning();

    res.status(201).json(newRoom[0]);
  } catch (error) {
    console.error('Error creating meeting room:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/meeting-rooms/:id - Update room (manager only)
router.put('/:id', requireManager, async (req, res) => {
  try {
    const validatedData = insertMeetingRoomsSchema.partial().parse(req.body);

    const updatedRoom = await db
      .update(meetingRooms)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(meetingRooms.id, req.params.id))
      .returning();

    if (!updatedRoom || updatedRoom.length === 0) {
      return res.status(404).json({ error: 'Meeting room not found' });
    }

    res.json(updatedRoom[0]);
  } catch (error) {
    console.error('Error updating meeting room:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/meeting-rooms/:id - Deactivate room (manager only)
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const updatedRoom = await db
      .update(meetingRooms)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(meetingRooms.id, req.params.id))
      .returning();

    if (!updatedRoom || updatedRoom.length === 0) {
      return res.status(404).json({ error: 'Meeting room not found' });
    }

    res.json({ message: 'Meeting room deactivated successfully', room: updatedRoom[0] });
  } catch (error) {
    console.error('Error deactivating meeting room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meeting-rooms/:id/availability - Check room availability for date range
router.get('/:id/availability', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    // Check if room exists
    const room = await db
      .select()
      .from(meetingRooms)
      .where(eq(meetingRooms.id, req.params.id))
      .limit(1);

    if (!room || room.length === 0) {
      return res.status(404).json({ error: 'Meeting room not found' });
    }

    // Find all meetings in the room during the specified time range
    // A meeting conflicts if:
    // - Meeting starts before requested end AND
    // - Meeting ends after requested start
    const conflictingMeetings = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.roomId, req.params.id),
          or(
            eq(meetings.status, 'scheduled'),
            eq(meetings.status, 'in_progress')
          ),
          // Meeting starts before our end time
          lte(meetings.startTime, end),
          // Meeting ends after our start time
          gte(meetings.endTime, start)
        )
      );

    const isAvailable = conflictingMeetings.length === 0;

    res.json({
      room: room[0],
      isAvailable,
      requestedRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      conflictingMeetings: isAvailable ? [] : conflictingMeetings.map(m => ({
        id: m.id,
        title: m.title,
        startTime: m.startTime,
        endTime: m.endTime,
      })),
    });
  } catch (error) {
    console.error('Error checking room availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
