import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import {
  meetings,
  meetingAttendees,
  meetingRooms,
  users,
  insertMeetingsSchema,
  insertMeetingAttendeesSchema,
  type User
} from '@shared/schema';
import { eq, and, gte, lte, or, inArray } from 'drizzle-orm';
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

// Schema for creating a meeting with attendees
const createMeetingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string(),
  roomId: z.string().optional(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  isRecurring: z.boolean().optional(),
  recurringPattern: z.string().optional(),
  virtualLink: z.string().optional(),
  agenda: z.string().optional(),
  attendeeIds: z.array(z.string()).min(1, 'At least one attendee is required'),
});

// Schema for RSVP
const rsvpSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE']),
});

// GET /api/meetings - List meetings with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { organizerId, roomId, type, startDate, endDate, attendeeId } = req.query;

    let conditions = [];

    // Filter by organizer
    if (organizerId) {
      conditions.push(eq(meetings.organizerId, organizerId as string));
    }

    // Filter by room
    if (roomId) {
      conditions.push(eq(meetings.roomId, roomId as string));
    }

    // Filter by type
    if (type) {
      conditions.push(eq(meetings.type, type as string));
    }

    // Filter by date range
    if (startDate) {
      conditions.push(gte(meetings.startTime, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(meetings.endTime, new Date(endDate as string)));
    }

    let query = db
      .select({
        meeting: meetings,
        organizer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        room: meetingRooms,
      })
      .from(meetings)
      .leftJoin(users, eq(meetings.organizerId, users.id))
      .leftJoin(meetingRooms, eq(meetings.roomId, meetingRooms.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    let results = await query;

    // If filtering by attendee, need to do a separate query
    if (attendeeId) {
      const attendeeMeetingIds = await db
        .select({ meetingId: meetingAttendees.meetingId })
        .from(meetingAttendees)
        .where(eq(meetingAttendees.userId, attendeeId as string));

      const meetingIds = attendeeMeetingIds.map(a => a.meetingId);

      if (meetingIds.length > 0) {
        results = results.filter(r => meetingIds.includes(r.meeting.id));
      } else {
        results = [];
      }
    }

    // Fetch attendees for each meeting
    const meetingsWithAttendees = await Promise.all(
      results.map(async (result) => {
        const attendeesList = await db
          .select({
            id: meetingAttendees.id,
            userId: meetingAttendees.userId,
            rsvpStatus: meetingAttendees.rsvpStatus,
            respondedAt: meetingAttendees.respondedAt,
            user: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(meetingAttendees)
          .leftJoin(users, eq(meetingAttendees.userId, users.id))
          .where(eq(meetingAttendees.meetingId, result.meeting.id));

        return {
          ...result.meeting,
          organizer: result.organizer,
          room: result.room,
          attendees: attendeesList,
        };
      })
    );

    res.json(meetingsWithAttendees);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meetings/my-meetings - Get current user's meetings
router.get('/my-meetings', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;

    // Get meetings where user is organizer
    const organizedMeetings = await db
      .select({
        meeting: meetings,
        room: meetingRooms,
      })
      .from(meetings)
      .leftJoin(meetingRooms, eq(meetings.roomId, meetingRooms.id))
      .where(eq(meetings.organizerId, userId));

    // Get meetings where user is an attendee
    const attendingMeetingIds = await db
      .select({ meetingId: meetingAttendees.meetingId })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.userId, userId));

    const attendingMeetingIdsList = attendingMeetingIds.map(a => a.meetingId);

    let attendingMeetings: typeof organizedMeetings = [];
    if (attendingMeetingIdsList.length > 0) {
      attendingMeetings = await db
        .select({
          meeting: meetings,
          room: meetingRooms,
          organizer: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(meetings)
        .leftJoin(meetingRooms, eq(meetings.roomId, meetingRooms.id))
        .leftJoin(users, eq(meetings.organizerId, users.id))
        .where(inArray(meetings.id, attendingMeetingIdsList));
    }

    // Fetch attendees for all meetings
    const allMeetings = [...organizedMeetings, ...attendingMeetings];
    const uniqueMeetingIds = [...new Set(allMeetings.map(m => m.meeting.id))];

    const meetingsWithAttendees = await Promise.all(
      allMeetings.map(async (result) => {
        const attendeesList = await db
          .select({
            id: meetingAttendees.id,
            userId: meetingAttendees.userId,
            rsvpStatus: meetingAttendees.rsvpStatus,
            respondedAt: meetingAttendees.respondedAt,
            user: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(meetingAttendees)
          .leftJoin(users, eq(meetingAttendees.userId, users.id))
          .where(eq(meetingAttendees.meetingId, result.meeting.id));

        return {
          ...result.meeting,
          organizer: 'organizer' in result ? result.organizer : req.user,
          room: result.room,
          attendees: attendeesList,
          isOrganizer: result.meeting.organizerId === userId,
        };
      })
    );

    // Remove duplicates (meetings where user is both organizer and attendee)
    const uniqueMeetings = meetingsWithAttendees.filter(
      (meeting, index, self) =>
        index === self.findIndex((m) => m.id === meeting.id)
    );

    res.json(uniqueMeetings);
  } catch (error) {
    console.error('Error fetching user meetings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meetings/:id - Get specific meeting with attendees
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const meeting = await db
      .select({
        meeting: meetings,
        organizer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        room: meetingRooms,
      })
      .from(meetings)
      .leftJoin(users, eq(meetings.organizerId, users.id))
      .leftJoin(meetingRooms, eq(meetings.roomId, meetingRooms.id))
      .where(eq(meetings.id, req.params.id))
      .limit(1);

    if (!meeting || meeting.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Fetch attendees
    const attendeesList = await db
      .select({
        id: meetingAttendees.id,
        userId: meetingAttendees.userId,
        rsvpStatus: meetingAttendees.rsvpStatus,
        respondedAt: meetingAttendees.respondedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(meetingAttendees)
      .leftJoin(users, eq(meetingAttendees.userId, users.id))
      .where(eq(meetingAttendees.meetingId, req.params.id));

    const result = {
      ...meeting[0].meeting,
      organizer: meeting[0].organizer,
      room: meeting[0].room,
      attendees: attendeesList,
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meetings - Create meeting with attendees
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = createMeetingSchema.parse(req.body);

    // Validate attendees exist
    const attendeeUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, validatedData.attendeeIds));

    if (attendeeUsers.length !== validatedData.attendeeIds.length) {
      return res.status(400).json({ error: 'One or more attendees not found' });
    }

    // If room is specified, check availability
    if (validatedData.roomId) {
      const startTime = new Date(validatedData.startTime);
      const endTime = new Date(validatedData.endTime);

      const conflictingMeetings = await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.roomId, validatedData.roomId),
            or(
              eq(meetings.status, 'scheduled'),
              eq(meetings.status, 'in_progress')
            ),
            lte(meetings.startTime, endTime),
            gte(meetings.endTime, startTime)
          )
        );

      if (conflictingMeetings.length > 0) {
        return res.status(409).json({
          error: 'Meeting room is not available for the selected time',
          conflicts: conflictingMeetings,
        });
      }
    }

    const meetingId = uuidv4();

    // Create meeting
    const newMeeting = await db
      .insert(meetings)
      .values({
        id: meetingId,
        title: validatedData.title,
        description: validatedData.description || null,
        type: validatedData.type,
        roomId: validatedData.roomId || null,
        organizerId: req.user.id,
        startTime: new Date(validatedData.startTime),
        endTime: new Date(validatedData.endTime),
        isRecurring: validatedData.isRecurring || false,
        recurringPattern: validatedData.recurringPattern || null,
        virtualLink: validatedData.virtualLink || null,
        agenda: validatedData.agenda || null,
        status: 'scheduled',
      })
      .returning();

    // Create attendees
    const attendeesData = validatedData.attendeeIds.map(userId => ({
      id: uuidv4(),
      meetingId,
      userId,
      rsvpStatus: 'pending' as const,
      respondedAt: null,
    }));

    await db.insert(meetingAttendees).values(attendeesData);

    // Fetch the complete meeting with attendees
    const result = await db
      .select({
        meeting: meetings,
        organizer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        room: meetingRooms,
      })
      .from(meetings)
      .leftJoin(users, eq(meetings.organizerId, users.id))
      .leftJoin(meetingRooms, eq(meetings.roomId, meetingRooms.id))
      .where(eq(meetings.id, meetingId))
      .limit(1);

    const attendeesList = await db
      .select({
        id: meetingAttendees.id,
        userId: meetingAttendees.userId,
        rsvpStatus: meetingAttendees.rsvpStatus,
        respondedAt: meetingAttendees.respondedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(meetingAttendees)
      .leftJoin(users, eq(meetingAttendees.userId, users.id))
      .where(eq(meetingAttendees.meetingId, meetingId));

    const meetingWithAttendees = {
      ...result[0].meeting,
      organizer: result[0].organizer,
      room: result[0].room,
      attendees: attendeesList,
    };

    res.status(201).json(meetingWithAttendees);
  } catch (error) {
    console.error('Error creating meeting:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/meetings/:id - Update meeting
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if meeting exists and user is the organizer
    const existingMeeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, req.params.id))
      .limit(1);

    if (!existingMeeting || existingMeeting.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (existingMeeting[0].organizerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the meeting organizer can update the meeting' });
    }

    const validatedData = insertMeetingsSchema.partial().parse(req.body);

    // If room is being changed, check availability
    if (validatedData.roomId) {
      const startTime = validatedData.startTime
        ? new Date(validatedData.startTime)
        : existingMeeting[0].startTime;
      const endTime = validatedData.endTime
        ? new Date(validatedData.endTime)
        : existingMeeting[0].endTime;

      const conflictingMeetings = await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.roomId, validatedData.roomId),
            or(
              eq(meetings.status, 'scheduled'),
              eq(meetings.status, 'in_progress')
            ),
            lte(meetings.startTime, endTime),
            gte(meetings.endTime, startTime)
          )
        );

      // Exclude the current meeting from conflicts
      const otherConflicts = conflictingMeetings.filter(m => m.id !== req.params.id);

      if (otherConflicts.length > 0) {
        return res.status(409).json({
          error: 'Meeting room is not available for the selected time',
          conflicts: otherConflicts,
        });
      }
    }

    const updatedMeeting = await db
      .update(meetings)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, req.params.id))
      .returning();

    // Fetch the complete meeting with attendees
    const result = await db
      .select({
        meeting: meetings,
        organizer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        room: meetingRooms,
      })
      .from(meetings)
      .leftJoin(users, eq(meetings.organizerId, users.id))
      .leftJoin(meetingRooms, eq(meetings.roomId, meetingRooms.id))
      .where(eq(meetings.id, req.params.id))
      .limit(1);

    const attendeesList = await db
      .select({
        id: meetingAttendees.id,
        userId: meetingAttendees.userId,
        rsvpStatus: meetingAttendees.rsvpStatus,
        respondedAt: meetingAttendees.respondedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(meetingAttendees)
      .leftJoin(users, eq(meetingAttendees.userId, users.id))
      .where(eq(meetingAttendees.meetingId, req.params.id));

    const meetingWithAttendees = {
      ...result[0].meeting,
      organizer: result[0].organizer,
      room: result[0].room,
      attendees: attendeesList,
    };

    res.json(meetingWithAttendees);
  } catch (error) {
    console.error('Error updating meeting:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/meetings/:id - Cancel meeting
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if meeting exists and user is the organizer
    const existingMeeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, req.params.id))
      .limit(1);

    if (!existingMeeting || existingMeeting.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (existingMeeting[0].organizerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the meeting organizer can cancel the meeting' });
    }

    // Update status to cancelled instead of deleting
    const cancelledMeeting = await db
      .update(meetings)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, req.params.id))
      .returning();

    res.json({ message: 'Meeting cancelled successfully', meeting: cancelledMeeting[0] });
  } catch (error) {
    console.error('Error cancelling meeting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meetings/:id/rsvp - RSVP to meeting
router.post('/:id/rsvp', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = rsvpSchema.parse(req.body);

    // Check if meeting exists
    const meeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, req.params.id))
      .limit(1);

    if (!meeting || meeting.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Check if user is an attendee
    const attendee = await db
      .select()
      .from(meetingAttendees)
      .where(
        and(
          eq(meetingAttendees.meetingId, req.params.id),
          eq(meetingAttendees.userId, req.user.id)
        )
      )
      .limit(1);

    if (!attendee || attendee.length === 0) {
      return res.status(403).json({ error: 'You are not invited to this meeting' });
    }

    // Update RSVP status
    const updatedAttendee = await db
      .update(meetingAttendees)
      .set({
        rsvpStatus: validatedData.status.toLowerCase() as 'pending' | 'accepted' | 'declined' | 'tentative',
        respondedAt: new Date(),
      })
      .where(eq(meetingAttendees.id, attendee[0].id))
      .returning();

    res.json({
      message: 'RSVP updated successfully',
      attendee: updatedAttendee[0],
    });
  } catch (error) {
    console.error('Error updating RSVP:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
