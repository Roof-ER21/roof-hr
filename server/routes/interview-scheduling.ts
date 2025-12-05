import { Router } from 'express';
import { z } from 'zod';
import { insertInterviewAvailabilitySchema, insertInterviewPanelMemberSchema } from '@shared/schema';
import { storage } from '../storage';
import { requireAuth, checkRole } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get interviewer availability
router.get('/interview-availability/:interviewerId', requireAuth, async (req, res) => {
  try {
    const { interviewerId } = req.params;
    const availability = await storage.getInterviewAvailabilityByInterviewer(interviewerId);
    res.json(availability);
  } catch (error) {
    console.error('Error fetching interview availability:', error);
    res.status(500).json({ error: 'Failed to fetch interview availability' });
  }
});

// Create interview availability slot
router.post('/interview-availability', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const data = insertInterviewAvailabilitySchema.parse(req.body);
    const availability = await storage.createInterviewAvailability(data);
    res.json(availability);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating interview availability:', error);
    res.status(500).json({ error: 'Failed to create interview availability' });
  }
});

// Update interview availability
router.patch('/interview-availability/:id', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const availability = await storage.updateInterviewAvailability(id, req.body);
    res.json(availability);
  } catch (error) {
    console.error('Error updating interview availability:', error);
    res.status(500).json({ error: 'Failed to update interview availability' });
  }
});

// Delete interview availability
router.delete('/interview-availability/:id', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteInterviewAvailability(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting interview availability:', error);
    res.status(500).json({ error: 'Failed to delete interview availability' });
  }
});

// Get panel members for an interview
router.get('/interview-panel-members/:interviewId', requireAuth, async (req, res) => {
  try {
    const { interviewId } = req.params;
    const members = await storage.getInterviewPanelMembersByInterview(interviewId);
    res.json(members);
  } catch (error) {
    console.error('Error fetching interview panel members:', error);
    res.status(500).json({ error: 'Failed to fetch interview panel members' });
  }
});

// Add panel member to interview
router.post('/interview-panel-members', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const data = insertInterviewPanelMemberSchema.parse(req.body);
    const member = await storage.createInterviewPanelMember(data);
    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error adding interview panel member:', error);
    res.status(500).json({ error: 'Failed to add interview panel member' });
  }
});

// Update panel member
router.patch('/interview-panel-members/:id', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const member = await storage.updateInterviewPanelMember(id, req.body);
    res.json(member);
  } catch (error) {
    console.error('Error updating interview panel member:', error);
    res.status(500).json({ error: 'Failed to update interview panel member' });
  }
});

// Remove panel member
router.delete('/interview-panel-members/:id', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteInterviewPanelMember(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing interview panel member:', error);
    res.status(500).json({ error: 'Failed to remove interview panel member' });
  }
});

// Generate meeting link for interview
router.post('/interviews/generate-meeting-link', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { type, candidateName, interviewDate, durationMinutes } = req.body;

    if (type === 'VIDEO') {
      // Use Google Meet for video interviews
      try {
        const { googleCalendarService } = await import('../services/google-calendar-service');

        const result = await googleCalendarService.createMeetingLink({
          summary: candidateName ? `Interview: ${candidateName}` : 'Video Interview',
          startDateTime: interviewDate ? new Date(interviewDate) : undefined,
          durationMinutes: durationMinutes || 60
        });

        res.json({
          meetingLink: result.meetingLink,
          eventId: result.eventId
        });
      } catch (googleError: any) {
        console.error('Google Meet generation failed:', googleError);

        // If Google Calendar is not configured, return helpful error
        if (googleError.message?.includes('not initialized') ||
            googleError.code === 401 ||
            googleError.code === 403) {
          return res.status(503).json({
            error: 'Google Calendar integration not configured',
            message: 'Please configure Google OAuth in Settings > Integrations to generate Google Meet links.',
            fallbackAvailable: true
          });
        }

        throw googleError;
      }
    } else {
      // For phone interviews, generate a dial-in number
      const meetingId = uuidv4().slice(0, 8);
      const meetingLink = `tel:+1-555-${Math.random().toString().slice(2, 6)}-${Math.random().toString().slice(2, 6)}`;
      res.json({ meetingLink });
    }
  } catch (error: any) {
    console.error('Error generating meeting link:', error);
    res.status(500).json({
      error: 'Failed to generate meeting link',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Get interviews by candidate
router.get('/interviews/candidate/:candidateId', requireAuth, async (req, res) => {
  try {
    const { candidateId } = req.params;
    const interviews = await storage.getInterviewsByCandidate(candidateId);
    res.json(interviews);
  } catch (error) {
    console.error('Error fetching candidate interviews:', error);
    res.status(500).json({ error: 'Failed to fetch candidate interviews' });
  }
});

export default router;