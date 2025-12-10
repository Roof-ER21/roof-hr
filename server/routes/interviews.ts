import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertInterviewSchema, insertInterviewFeedbackSchema, insertInterviewReminderSchema } from '@shared/schema';
import { getConflictDetector } from '../services/calendar-conflict-detector';

const router = Router();

// Middleware functions
async function requireAuth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = await storage.getSessionByToken(token);
  if (!session || new Date(session.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const user = await storage.getUserById(session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

function requireManager(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
}

// Enhanced interview scheduling
const scheduleInterviewSchema = z.object({
  candidateId: z.string(),
  interviewerId: z.string().optional(), // Optional when using custom interviewer
  customInterviewerName: z.string().optional(), // For interviewers not in system
  scheduledDate: z.string(),
  duration: z.number().min(15).max(480),
  type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON']),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  notes: z.string().optional(),
  reminderHours: z.number().min(1).max(168).optional(),
  sendReminders: z.boolean().default(true),
  forceSchedule: z.boolean().default(false), // Only managers can override conflicts
  sendCalendarInvite: z.boolean().optional(),
}).refine(data => data.interviewerId || data.customInterviewerName, {
  message: 'Either interviewerId or customInterviewerName is required',
});

// Simple POST route for basic interview creation
router.post('/', requireAuth, requireManager, async (req, res) => {
  try {
    // Use the same logic as /schedule but with default values
    const data = scheduleInterviewSchema.parse(req.body);

    // Create the interview
    const interview = await storage.createInterview({
      candidateId: data.candidateId,
      interviewerId: data.interviewerId || undefined,
      customInterviewerName: data.customInterviewerName || undefined,
      scheduledDate: new Date(data.scheduledDate),
      duration: data.duration,
      type: data.type,
      location: data.location,
      meetingLink: data.meetingLink,
      notes: data.notes,
      reminderHours: data.reminderHours || 24,
      status: 'SCHEDULED',
    });

    res.json(interview);
  } catch (error) {
    console.error('[INTERVIEW CREATE ERROR]', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid interview data',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to create interview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Schedule interview with automated reminders and conflict detection
router.post('/schedule', requireAuth, requireManager, async (req, res) => {
  try {
    const data = scheduleInterviewSchema.parse(req.body);

    // Get participant emails for conflict checking
    const candidate = await storage.getCandidateById(data.candidateId);
    const interviewer = data.interviewerId ? await storage.getUserById(data.interviewerId) : null;

    // Validate: candidate is required, interviewer is optional if customInterviewerName is provided
    if (!candidate) {
      return res.status(400).json({
        error: 'Invalid candidate'
      });
    }

    if (!interviewer && !data.customInterviewerName) {
      return res.status(400).json({
        error: 'Either interviewer or custom interviewer name is required'
      });
    }

    // Check for calendar conflicts
    const conflictDetector = getConflictDetector(storage);
    const startTime = new Date(data.scheduledDate);
    const endTime = new Date(startTime.getTime() + data.duration * 60 * 1000);

    const participants = [
      ...(interviewer?.email ? [interviewer.email] : []),
      ...(candidate.email ? [candidate.email] : [])
    ];

    const conflictResult = await conflictDetector.checkConflicts(
      participants,
      startTime,
      endTime
    );

    // If there are hard conflicts, return them without creating the interview
    const hardConflicts = conflictResult.conflicts.filter(c => c.severity === 'hard');

    // Send alert emails about detected conflicts (even if not forcing)
    if (hardConflicts.length > 0) {
      await conflictDetector.sendConflictAlerts(
        hardConflicts,
        {
          candidateId: data.candidateId,
          interviewerId: data.interviewerId || undefined,
          scheduledDate: startTime,
          duration: data.duration,
          type: data.type,
          location: data.location,
          meetingLink: data.meetingLink
        },
        false, // not forced yet
        (req as any).user?.email // Send emails from the logged-in user
      );
    }

    if (hardConflicts.length > 0 && !data.forceSchedule) {
      return res.status(409).json({
        error: 'Schedule conflicts detected',
        conflicts: hardConflicts.map(c => conflictDetector.formatConflictMessage(c)),
        suggestedTimes: conflictResult.suggestedTimes,
        warnings: conflictResult.warnings,
        message: 'The selected time has conflicts. Please choose another time or confirm to override.'
      });
    }

    // Create the interview
    const interview = await storage.createInterview({
      candidateId: data.candidateId,
      interviewerId: data.interviewerId || undefined,
      customInterviewerName: data.customInterviewerName || undefined,
      scheduledDate: new Date(data.scheduledDate),
      duration: data.duration,
      type: data.type,
      location: data.location,
      meetingLink: data.meetingLink,
      notes: data.notes,
      reminderHours: data.reminderHours || 24,
      status: 'SCHEDULED',
    });
    
    // If there were conflicts but interview was forced, send follow-up alert
    if (hardConflicts.length > 0 && data.forceSchedule) {
      // Send confirmation that interview was scheduled despite conflicts
      await conflictDetector.sendConflictAlerts(
        hardConflicts,
        {
          candidateId: data.candidateId,
          interviewerId: data.interviewerId,
          scheduledDate: startTime,
          duration: data.duration,
          type: data.type,
          location: data.location,
          meetingLink: data.meetingLink
        },
        true, // forcedSchedule flag
        (req as any).user?.email // Send emails from the logged-in user
      );
    }
    
    // Send alerts for soft conflicts as well
    const softConflicts = conflictResult.conflicts.filter(c => c.severity === 'soft');
    if (softConflicts.length > 0 || conflictResult.warnings.length > 0) {
      console.log('[INTERVIEW] Soft conflicts/warnings detected:', {
        softConflicts: softConflicts.length,
        warnings: conflictResult.warnings.length
      });
    }

    // If reminders are enabled, schedule them
    if (data.sendReminders) {
      const reminderTime = new Date(data.scheduledDate);
      reminderTime.setHours(reminderTime.getHours() - (data.reminderHours || 24));

      // Schedule candidate reminder
      await storage.createInterviewReminder({
        interviewId: interview.id,
        reminderType: 'CANDIDATE',
        scheduledAt: reminderTime,
        status: 'PENDING',
      });

      // Schedule interviewer reminder  
      await storage.createInterviewReminder({
        interviewId: interview.id,
        reminderType: 'INTERVIEWER',
        scheduledAt: reminderTime,
        status: 'PENDING',
      });
    }

    // Create Google Calendar event using service account
    let googleEventId: string | undefined;
    try {
      // Import and initialize the service account-based calendar service
      const GoogleCalendarService = (await import('../services/google-calendar-service')).default;
      const calendarService = new GoogleCalendarService();
      
      // Initialize with service account
      await calendarService.initialize();
      
      // Get candidate and interviewer info for attendees
      const candidateDetails = await storage.getCandidateById(data.candidateId);
      const interviewerDetails = data.interviewerId ? await storage.getUserById(data.interviewerId) : null;
      
      if (candidateDetails && interviewerDetails) {
        const startDateTime = new Date(data.scheduledDate);
        const endDateTime = new Date(startDateTime.getTime() + data.duration * 60 * 1000);
        
        // Create detailed interview description
        const description = `
Interview Details:
- Candidate: ${candidateDetails.firstName} ${candidateDetails.lastName}
- Position: ${candidateDetails.position}
- Department: ${(candidateDetails as any).department || 'N/A'}
- Type: ${data.type}
- Duration: ${data.duration} minutes
${data.meetingLink ? `- Meeting Link: ${data.meetingLink}` : ''}
${data.location && data.type === 'IN_PERSON' ? `- Location: ${data.location}` : ''}

Candidate Contact:
- Email: ${candidateDetails.email}
- Phone: ${candidateDetails.phone || 'N/A'}

${data.notes ? `Notes:\n${data.notes}` : ''}

Please use the HR system to record interview feedback.
        `.trim();
        
        // Prepare attendee list
        const attendees: string[] = [];
        if (candidateDetails.email) attendees.push(candidateDetails.email);
        if (interviewerDetails.email) attendees.push(interviewerDetails.email);
        
        // Create the calendar event
        const calendarEvent = await calendarService.createEvent({
          summary: `Interview: ${candidateDetails.firstName} ${candidateDetails.lastName} - ${candidateDetails.position}`,
          description,
          location: data.type === 'IN_PERSON' ? data.location : data.meetingLink,
          startDateTime,
          endDateTime,
          attendees,
          sendNotifications: true,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 }, // 1 day before
              { method: 'email', minutes: 60 }, // 1 hour before
              { method: 'popup', minutes: 15 } // 15 minutes before
            ]
          }
        });
        
        googleEventId = calendarEvent.id;
        console.log('[INTERVIEW] Google Calendar event created successfully:', googleEventId);
        
        // Update interview with calendar event ID
        if (googleEventId) {
          await storage.updateInterview(interview.id, {
            googleEventId
          });
        }
      }
    } catch (calendarError: any) {
      console.error('[INTERVIEW] Failed to create Google Calendar event:', calendarError);
      // Send a warning in the response but don't fail the interview creation
      res.locals.calendarWarning = `Interview scheduled but calendar event creation failed: ${calendarError.message}`;
    }

    // Send immediate confirmation emails (from the logged-in user's email)
    await sendInterviewScheduledEmails(interview, (req as any).user?.email);

    // Update candidate status to INTERVIEW
    await storage.updateCandidate(data.candidateId, {
      status: 'INTERVIEW'
    });

    console.log('[INTERVIEW SCHEDULED] Interview created:', {
      interviewId: interview.id,
      candidate: data.candidateId,
      interviewer: data.interviewerId,
      scheduledDate: data.scheduledDate,
      remindersEnabled: data.sendReminders
    });

    res.json(interview);
  } catch (error) {
    console.error('[INTERVIEW SCHEDULE ERROR]', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid interview data', 
        details: error.errors 
      });
    }

    res.status(500).json({ 
      error: 'Failed to schedule interview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Submit interview feedback
router.post('/feedback', requireAuth, async (req, res) => {
  try {
    const data = insertInterviewFeedbackSchema.parse({
      ...req.body,
      interviewerId: req.user ? (req.user as any).id : '', // Use authenticated user as interviewer
    });
    
    const feedback = await storage.createInterviewFeedback(data);

    // Update interview status to COMPLETED
    await storage.updateInterview(data.interviewId, {
      status: 'COMPLETED',
      rating: data.overallRating,
    });

    // If recommendation is HIRE or NO_HIRE, update candidate status
    if (data.recommendation === 'HIRE') {
      const interview = await storage.getInterviewById(data.interviewId);
      if (interview) {
        await storage.updateCandidate(interview.candidateId, {
          status: 'OFFER'
        });
      }
    } else if (data.recommendation === 'NO_HIRE') {
      const interview = await storage.getInterviewById(data.interviewId);
      if (interview) {
        await storage.updateCandidate(interview.candidateId, {
          status: 'REJECTED'
        });
      }
    }

    console.log('[INTERVIEW FEEDBACK] Feedback submitted:', {
      feedbackId: feedback.id,
      interviewId: data.interviewId,
      recommendation: data.recommendation,
      overallRating: data.overallRating
    });

    res.json(feedback);
  } catch (error) {
    console.error('[INTERVIEW FEEDBACK ERROR]', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid feedback data', 
        details: error.errors 
      });
    }

    res.status(500).json({ 
      error: 'Failed to submit feedback',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check for calendar conflicts before scheduling (managers only)
router.post('/check-conflicts', requireAuth, requireManager, async (req, res) => {
  try {
    const { candidateId, interviewerId, scheduledDate, duration } = req.body;
    
    // Get participant emails
    const candidate = await storage.getCandidateById(candidateId);
    const interviewer = await storage.getUserById(interviewerId);
    
    if (!candidate || !interviewer) {
      return res.status(400).json({ 
        error: 'Invalid candidate or interviewer' 
      });
    }
    
    // Check for conflicts
    const conflictDetector = getConflictDetector(storage);
    const startTime = new Date(scheduledDate);
    const endTime = new Date(startTime.getTime() + (duration || 60) * 60 * 1000);
    
    const participants = [
      ...(interviewer.email ? [interviewer.email] : []),
      ...(candidate.email ? [candidate.email] : [])
    ];
    
    const conflictResult = await conflictDetector.checkConflicts(
      participants,
      startTime,
      endTime
    );
    
    // Format the response
    const formattedConflicts = conflictResult.conflicts.map(c => ({
      message: conflictDetector.formatConflictMessage(c),
      type: c.type,
      severity: c.severity,
      start: c.start,
      end: c.end
    }));
    
    res.json({
      hasConflicts: conflictResult.hasConflicts,
      conflicts: formattedConflicts,
      suggestedTimes: conflictResult.suggestedTimes,
      warnings: conflictResult.warnings
    });
  } catch (error) {
    console.error('[CHECK CONFLICTS ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to check conflicts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all interviews
router.get('/', requireAuth, async (req, res) => {
  try {
    const interviews = await storage.getAllInterviews();
    res.json(interviews);
  } catch (error) {
    console.error('[GET INTERVIEWS ERROR]', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Get interview by ID with feedback
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const interview = await storage.getInterviewById(req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const feedback = await storage.getInterviewFeedback(req.params.id);
    
    res.json({
      ...interview,
      feedback
    });
  } catch (error) {
    console.error('[GET INTERVIEW ERROR]', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Update interview (reschedule, cancel, etc.)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    // First get the existing interview
    const existingInterview = await storage.getInterviewById(req.params.id);
    if (!existingInterview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Update the interview in storage
    const interview = await storage.updateInterview(req.params.id, req.body);

    // If there's a calendar event ID and the date/time/duration changed, update the calendar
    if (existingInterview.googleEventId && (
      req.body.scheduledDate || 
      req.body.duration || 
      req.body.location || 
      req.body.meetingLink ||
      req.body.status === 'CANCELLED'
    )) {
      try {
        const GoogleCalendarService = (await import('../services/google-calendar-service')).default;
        const calendarService = new GoogleCalendarService();
        await calendarService.initialize();

        if (req.body.status === 'CANCELLED') {
          // Delete the calendar event if interview is cancelled
          await calendarService.deleteEvent(existingInterview.googleEventId);
          console.log('[INTERVIEW] Google Calendar event deleted:', existingInterview.googleEventId);
        } else {
          // Update the calendar event
          const updatedInterview = await storage.getInterviewById(req.params.id);
          if (updatedInterview) {
            const startDateTime = new Date(updatedInterview.scheduledDate);
            const endDateTime = new Date(startDateTime.getTime() + updatedInterview.duration * 60 * 1000);

            await calendarService.updateEvent(existingInterview.googleEventId, {
              start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/New_York'
              },
              end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/New_York'
              },
              location: updatedInterview.location || updatedInterview.meetingLink,
            });
            console.log('[INTERVIEW] Google Calendar event updated:', existingInterview.googleEventId);
          }
        }
      } catch (calendarError) {
        console.error('[INTERVIEW] Failed to update Google Calendar event:', calendarError);
        // Don't fail the interview update if calendar update fails
      }
    }

    res.json(interview);
  } catch (error) {
    console.error('[UPDATE INTERVIEW ERROR]', error);
    res.status(400).json({ error: 'Failed to update interview' });
  }
});

// Delete interview 
router.delete('/:id', requireAuth, requireManager, async (req, res) => {
  try {
    // First get the interview to check for calendar event
    const interview = await storage.getInterviewById(req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Delete from Google Calendar if there's an event
    if (interview.googleEventId) {
      try {
        const GoogleCalendarService = (await import('../services/google-calendar-service')).default;
        const calendarService = new GoogleCalendarService();
        await calendarService.initialize();
        
        await calendarService.deleteEvent(interview.googleEventId);
        console.log('[INTERVIEW] Google Calendar event deleted:', interview.googleEventId);
      } catch (calendarError) {
        console.error('[INTERVIEW] Failed to delete Google Calendar event:', calendarError);
        // Continue with interview deletion even if calendar deletion fails
      }
    }

    // Delete the interview from storage
    await storage.deleteInterview(req.params.id);
    
    res.json({ success: true, message: 'Interview deleted successfully' });
  } catch (error) {
    console.error('[DELETE INTERVIEW ERROR]', error);
    res.status(400).json({ error: 'Failed to delete interview' });
  }
});

// Get interviews for a specific candidate
router.get('/candidate/:candidateId', requireAuth, async (req, res) => {
  try {
    const interviews = await storage.getInterviewsByCandidate(req.params.candidateId);
    res.json(interviews);
  } catch (error) {
    console.error('[GET CANDIDATE INTERVIEWS ERROR]', error);
    res.status(500).json({ error: 'Failed to fetch candidate interviews' });
  }
});

// Send interview scheduled emails
async function sendInterviewScheduledEmails(interview: any, fromUserEmail?: string) {
  try {
    // Get candidate and interviewer details
    const candidate = await storage.getCandidateById(interview.candidateId);
    const interviewer = await storage.getUserById(interview.interviewerId);

    if (!candidate || !interviewer) {
      console.error('Missing candidate or interviewer data for email');
      return;
    }

    const interviewDate = new Date(interview.scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const interviewTime = new Date(interview.scheduledDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Import email service
    const { emailService } = await import('../email-service');

    // Email HTML to candidate
    const candidateHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Interview Scheduled - ROOF-ER</h2>
        <p>Dear ${candidate.firstName} ${candidate.lastName},</p>
        <p>Your interview has been scheduled for the <strong>${candidate.position}</strong> position at ROOF-ER.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Interview Details</h3>
          <p><strong>Date:</strong> ${interviewDate}</p>
          <p><strong>Time:</strong> ${interviewTime}</p>
          <p><strong>Duration:</strong> ${interview.duration} minutes</p>
          <p><strong>Type:</strong> ${interview.type}</p>
          ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
          ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${interview.meetingLink}">${interview.meetingLink}</a></p>` : ''}
          <p><strong>Interviewer:</strong> ${interviewer.firstName} ${interviewer.lastName}</p>
          ${interview.notes ? `<p><strong>Notes:</strong> ${interview.notes}</p>` : ''}
        </div>
        <p>If you need to reschedule or have any questions, please contact us immediately.</p>
        <p>We look forward to meeting with you!</p>
        <p>Best regards,<br>ROOF-ER Hiring Team</p>
      </div>
    `;

    // Send email to candidate (from the logged-in user's email)
    await emailService.sendEmail({
      to: candidate.email,
      subject: `Interview Scheduled - ${candidate.position} at ROOF-ER`,
      html: candidateHtml,
      candidateId: candidate.id,
      interviewId: interview.id,
      fromUserEmail: fromUserEmail || process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com',
    });

    // Email HTML to interviewer
    const interviewerHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Interview Scheduled</h2>
        <p>Hello ${interviewer.firstName},</p>
        <p>You have an interview scheduled with <strong>${candidate.firstName} ${candidate.lastName}</strong> for the <strong>${candidate.position}</strong> position.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Interview Details</h3>
          <p><strong>Date:</strong> ${interviewDate}</p>
          <p><strong>Time:</strong> ${interviewTime}</p>
          <p><strong>Duration:</strong> ${interview.duration} minutes</p>
          <p><strong>Type:</strong> ${interview.type}</p>
          ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
          ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${interview.meetingLink}">${interview.meetingLink}</a></p>` : ''}
        </div>
        <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">Candidate Information</h3>
          <p><strong>Name:</strong> ${candidate.firstName} ${candidate.lastName}</p>
          <p><strong>Email:</strong> ${candidate.email}</p>
          <p><strong>Phone:</strong> ${candidate.phone}</p>
        </div>
        ${interview.notes ? `<p><strong>Interview Notes:</strong> ${interview.notes}</p>` : ''}
        <p>Please review the candidate's profile before the interview.</p>
        <p>Best regards,<br>ROOF-ER HR System</p>
      </div>
    `;

    // Send email to interviewer (from the logged-in user's email)
    await emailService.sendEmail({
      to: interviewer.email,
      subject: `Interview Scheduled - ${candidate.firstName} ${candidate.lastName}`,
      html: interviewerHtml,
      interviewId: interview.id,
      fromUserEmail: fromUserEmail || process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com',
    });

    console.log('[INTERVIEW] Confirmation emails sent to candidate and interviewer');

  } catch (error) {
    console.error('Failed to send interview scheduled emails:', error);
  }
}

export default router;