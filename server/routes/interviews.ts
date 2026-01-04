import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertInterviewSchema, insertInterviewFeedbackSchema, insertInterviewReminderSchema } from '@shared/schema';
import { getConflictDetector } from '../services/calendar-conflict-detector';
import { timezoneService } from '../services/timezone-service';

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

  // Ahmed always has manager access (super admin email fallback)
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  const managerRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'
  ];

  if (!managerRoles.includes(req.user.role)) {
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

    // Check interviewer availability if interviewerId is provided
    if (data.interviewerId && interviewer) {
      const scheduledDate = new Date(data.scheduledDate);

      // Get interviewer's timezone for proper time comparison
      const interviewerTimezone = await timezoneService.getUserTimezone(data.interviewerId);

      // Get day of week in interviewer's timezone (not UTC)
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: interviewerTimezone
      });
      const dayName = dayFormatter.format(scheduledDate);
      const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
      const dayOfWeek = dayMap[dayName] ?? scheduledDate.getDay();

      // Get interviewer's availability slots
      const availability = await storage.getInterviewAvailabilityByInterviewer(data.interviewerId);
      const daySlots = availability.filter((a: any) => a.dayOfWeek === dayOfWeek && a.isActive);

      if (daySlots.length === 0) {
        // No availability set for this day
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Find days with availability
        const availableDays = [...new Set(availability.filter((a: any) => a.isActive).map((a: any) => a.dayOfWeek))];
        const availableDayNames = availableDays.map(d => dayNames[d as number]).join(', ');

        return res.status(400).json({
          error: 'Outside interviewer availability',
          message: `${interviewer.firstName} ${interviewer.lastName} is not available on ${dayNames[dayOfWeek]}s.`,
          availableDays: availableDayNames || 'No availability set',
          suggestion: availableDayNames ? `They are available on: ${availableDayNames}` : 'Please contact them to set up their availability.'
        });
      }

      // Get scheduled time in interviewer's timezone (not UTC)
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: interviewerTimezone
      });
      const scheduledTimeParts = timeFormatter.formatToParts(scheduledDate);
      const scheduledHour = parseInt(scheduledTimeParts.find(p => p.type === 'hour')?.value || '0');
      const scheduledMinute = parseInt(scheduledTimeParts.find(p => p.type === 'minute')?.value || '0');
      const scheduledTimeStr = `${scheduledHour.toString().padStart(2, '0')}:${scheduledMinute.toString().padStart(2, '0')}`;

      // Calculate end time in interviewer's timezone
      const endDate = new Date(scheduledDate.getTime() + data.duration * 60 * 1000);
      const endTimeParts = timeFormatter.formatToParts(endDate);
      const endHour = parseInt(endTimeParts.find(p => p.type === 'hour')?.value || '0');
      const endMinute = parseInt(endTimeParts.find(p => p.type === 'minute')?.value || '0');
      const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      // Helper to convert 24hr to 12hr format
      const formatTime12Hour = (time24: string): string => {
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
      };

      const isWithinSlot = daySlots.some((slot: any) => {
        return scheduledTimeStr >= slot.startTime && endTimeStr <= slot.endTime;
      });

      if (!isWithinSlot) {
        // Format available slots for display
        const availableSlots = daySlots.map((slot: any) =>
          `${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}`
        ).join(', ');

        return res.status(400).json({
          error: 'Outside interviewer availability',
          message: `The selected time (${formatTime12Hour(scheduledTimeStr)} - ${formatTime12Hour(endTimeStr)}) is outside ${interviewer.firstName}'s available hours.`,
          availableSlots,
          suggestion: `Available times: ${availableSlots}`
        });
      }

      // Check for existing interviews at this time
      const existingInterviews = await storage.getInterviewsByInterviewer(data.interviewerId);
      const scheduledStart = scheduledDate.getTime();
      const scheduledEnd = scheduledStart + data.duration * 60 * 1000;

      const conflictingInterview = existingInterviews.find((interview: any) => {
        if (interview.status === 'CANCELLED') return false;
        const interviewStart = new Date(interview.scheduledDate).getTime();
        const interviewEnd = interviewStart + interview.duration * 60 * 1000;
        // Check if times overlap
        return scheduledStart < interviewEnd && scheduledEnd > interviewStart;
      });

      if (conflictingInterview && !data.forceSchedule) {
        const conflictCandidate = await storage.getCandidateById(conflictingInterview.candidateId);
        const conflictTime = new Date(conflictingInterview.scheduledDate);

        return res.status(409).json({
          error: 'Interviewer has existing appointment',
          message: `${interviewer.firstName} ${interviewer.lastName} already has an interview scheduled at ${formatTime12Hour(
            `${conflictTime.getHours().toString().padStart(2, '0')}:${conflictTime.getMinutes().toString().padStart(2, '0')}`
          )} with ${conflictCandidate ? `${conflictCandidate.firstName} ${conflictCandidate.lastName}` : 'another candidate'}.`,
          existingInterview: {
            time: conflictTime.toISOString(),
            candidateName: conflictCandidate ? `${conflictCandidate.firstName} ${conflictCandidate.lastName}` : 'Unknown',
            duration: conflictingInterview.duration
          }
        });
      }
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

    // Create Google Calendar event in the interviewer's calendar using impersonation
    let googleEventId: string | undefined;
    try {
      // Import and initialize the service account-based calendar service
      const GoogleCalendarService = (await import('../services/google-calendar-service')).default;
      const calendarService = new GoogleCalendarService();

      // Initialize with service account
      await calendarService.initialize();
      console.log('[INTERVIEW] Calendar service initialized successfully');

      // Get candidate and interviewer info for attendees
      const candidateDetails = await storage.getCandidateById(data.candidateId);
      const interviewerDetails = data.interviewerId ? await storage.getUserById(data.interviewerId) : null;

      console.log('[INTERVIEW] Calendar event details:', {
        candidateId: data.candidateId,
        interviewerId: data.interviewerId,
        candidateEmail: candidateDetails?.email,
        interviewerEmail: interviewerDetails?.email,
        interviewType: data.type,
        scheduledDate: data.scheduledDate
      });

      if (candidateDetails && interviewerDetails && interviewerDetails.email) {
        const startDateTime = new Date(data.scheduledDate);
        const endDateTime = new Date(startDateTime.getTime() + data.duration * 60 * 1000);

        // Get interviewer's timezone (fallback to 'America/New_York')
        const interviewerTimezone = await timezoneService.getUserTimezone(data.interviewerId!);

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

        // Prepare attendee list (both candidate and interviewer)
        const attendees: string[] = [];
        if (candidateDetails.email) attendees.push(candidateDetails.email);
        if (interviewerDetails.email) attendees.push(interviewerDetails.email);

        let calendarEvent: any;
        let autoMeetLink: string | undefined;

        // For VIDEO interviews, auto-generate Google Meet link in the interviewer's calendar
        if (data.type === 'VIDEO') {
          calendarEvent = await calendarService.createEventWithMeetForUser(
            interviewerDetails.email, // Create in the interviewer's calendar
            {
              summary: `Interview: ${candidateDetails.firstName} ${candidateDetails.lastName} - ${candidateDetails.position}`,
              description,
              startDateTime,
              endDateTime,
              attendees,
              sendNotifications: true,
              timeZone: interviewerTimezone
            }
          );

          // Extract the auto-generated Meet link
          autoMeetLink = calendarEvent.meetLink || calendarEvent.hangoutLink;
          if (autoMeetLink) {
            console.log('[INTERVIEW] Auto-generated Google Meet link:', autoMeetLink);
          }
        } else {
          // For PHONE and IN_PERSON, create regular event in the interviewer's calendar
          calendarEvent = await calendarService.createEventForUser(
            interviewerDetails.email, // Create in the interviewer's calendar
            {
              summary: `Interview: ${candidateDetails.firstName} ${candidateDetails.lastName} - ${candidateDetails.position}`,
              description,
              location: data.type === 'IN_PERSON' ? data.location : data.meetingLink,
              startDateTime,
              endDateTime,
              attendees,
              sendNotifications: true,
              timeZone: interviewerTimezone,
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 24 * 60 }, // 1 day before
                  { method: 'email', minutes: 60 }, // 1 hour before
                  { method: 'popup', minutes: 15 } // 15 minutes before
                ]
              }
            }
          );
        }

        googleEventId = calendarEvent.id;
        console.log('[INTERVIEW] Google Calendar event created in interviewer\'s calendar:', googleEventId);

        // Update interview with calendar event ID and auto-generated Meet link (for VIDEO)
        if (googleEventId) {
          const updateData: any = { googleEventId };
          // If VIDEO and we have an auto-generated Meet link, use it (override any manual link)
          if (data.type === 'VIDEO' && autoMeetLink) {
            updateData.meetingLink = autoMeetLink;
          }
          await storage.updateInterview(interview.id, updateData);
        }
      } else if (!interviewerDetails || !interviewerDetails.email) {
        console.warn('[INTERVIEW] Cannot create calendar event: interviewer email not available');
      }
    } catch (calendarError: any) {
      console.error('[INTERVIEW] ❌ Failed to create Google Calendar event:', {
        error: calendarError.message,
        code: calendarError.code,
        status: calendarError.status,
        errors: calendarError.errors,
        stack: calendarError.stack?.split('\n').slice(0, 5).join('\n')
      });
      // Send a warning in the response but don't fail the interview creation
      res.locals.calendarWarning = `Interview scheduled but calendar event creation failed: ${calendarError.message}`;
    }

    // Send immediate confirmation emails (from the logged-in user's email)
    const emailResult = await sendInterviewScheduledEmails(interview, (req as any).user?.email);

    // Log email sending results
    if (!emailResult.success) {
      console.error('[INTERVIEW SCHEDULED] ⚠️ Email notification failures:', {
        interviewId: interview.id,
        errors: emailResult.errors,
      });
      // Store warning for response
      res.locals.emailWarning = `Interview scheduled but email notifications failed: ${emailResult.errors.join(', ')}`;
    }

    // Update candidate status to INTERVIEW
    await storage.updateCandidate(data.candidateId, {
      status: 'INTERVIEW'
    });

    console.log('[INTERVIEW SCHEDULED] Interview created:', {
      interviewId: interview.id,
      candidate: data.candidateId,
      interviewer: data.interviewerId,
      scheduledDate: data.scheduledDate,
      remindersEnabled: data.sendReminders,
      emailsSuccessful: emailResult.success,
    });

    // Build response with warnings if any
    const response: any = { ...interview };
    const warnings: string[] = [];

    if (res.locals.calendarWarning) {
      warnings.push(res.locals.calendarWarning);
    }
    if (res.locals.emailWarning) {
      warnings.push(res.locals.emailWarning);
    }

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    res.json(response);
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

// Update interview (reschedule, cancel, complete, no-show, etc.)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { outcomeNotes, ...updateData } = req.body;

    // First get the existing interview
    const existingInterview = await storage.getInterviewById(req.params.id);
    if (!existingInterview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Update the interview in storage
    const interview = await storage.updateInterview(req.params.id, updateData);

    // Handle NO_SHOW: Move candidate to Dead status with "No Show" tag
    if (updateData.status === 'NO_SHOW' && existingInterview.candidateId) {
      try {
        const candidate = await storage.getCandidateById(existingInterview.candidateId);
        if (candidate) {
          // Add "No Show" tag and move to Dead status
          const existingTags = candidate.customTags || [];
          const newTags = existingTags.includes('No Show') ? existingTags : [...existingTags, 'No Show'];

          await storage.updateCandidate(existingInterview.candidateId, {
            status: 'DEAD_BY_CANDIDATE',
            customTags: newTags
          });

          // Add note about the no-show
          const interviewDate = new Date(existingInterview.scheduledDate).toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          await storage.createCandidateNote({
            candidateId: existingInterview.candidateId,
            content: `Interview no-show on ${interviewDate}. Candidate moved to Dead status.`,
            type: 'INTERVIEW',
            createdBy: (req as any).user?.id || 'system'
          });
          console.log('[INTERVIEW] Candidate marked as no-show:', existingInterview.candidateId);
        }
      } catch (candidateError) {
        console.error('[INTERVIEW] Failed to update candidate for no-show:', candidateError);
        // Don't fail the interview update
      }
    }

    // Save outcome notes to candidate profile for COMPLETED or CANCELLED
    if (outcomeNotes && ['COMPLETED', 'CANCELLED'].includes(updateData.status) && existingInterview.candidateId) {
      try {
        const statusLabel = updateData.status === 'COMPLETED' ? 'completed' : 'cancelled';
        await storage.createCandidateNote({
          candidateId: existingInterview.candidateId,
          content: `Interview ${statusLabel}: ${outcomeNotes}`,
          type: 'INTERVIEW',
          createdBy: (req as any).user?.id || 'system'
        });
        console.log('[INTERVIEW] Saved outcome notes to candidate profile');
      } catch (noteError) {
        console.error('[INTERVIEW] Failed to save outcome notes:', noteError);
        // Don't fail the interview update
      }
    }

    // If there's a calendar event ID and the date/time/duration changed, update the calendar
    if (existingInterview.googleEventId && (
      updateData.scheduledDate ||
      updateData.duration ||
      updateData.location ||
      updateData.meetingLink ||
      updateData.status === 'CANCELLED' ||
      updateData.status === 'NO_SHOW'
    )) {
      try {
        const GoogleCalendarService = (await import('../services/google-calendar-service')).default;
        const calendarService = new GoogleCalendarService();
        await calendarService.initialize();

        if (updateData.status === 'CANCELLED' || updateData.status === 'NO_SHOW') {
          // Delete the calendar event if interview is cancelled or no-show
          await calendarService.deleteEvent(existingInterview.googleEventId);
          console.log('[INTERVIEW] Google Calendar event deleted:', existingInterview.googleEventId);
        } else {
          // Update the calendar event
          const updatedInterview = await storage.getInterviewById(req.params.id);
          if (updatedInterview) {
            const startDateTime = new Date(updatedInterview.scheduledDate);
            const endDateTime = new Date(startDateTime.getTime() + updatedInterview.duration * 60 * 1000);

            // Get interviewer's timezone for the updated event
            let interviewerTimezone = 'America/New_York';
            if (updatedInterview.interviewerId) {
              interviewerTimezone = await timezoneService.getUserTimezone(updatedInterview.interviewerId);
            }

            await calendarService.updateEvent(existingInterview.googleEventId, {
              start: {
                dateTime: startDateTime.toISOString(),
                timeZone: interviewerTimezone
              },
              end: {
                dateTime: endDateTime.toISOString(),
                timeZone: interviewerTimezone
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
async function sendInterviewScheduledEmails(interview: any, fromUserEmail?: string): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  let candidateEmailSent = false;
  let interviewerEmailSent = false;

  try {
    // Get candidate and interviewer details
    const candidate = await storage.getCandidateById(interview.candidateId);
    const interviewer = interview.interviewerId ? await storage.getUserById(interview.interviewerId) : null;

    if (!candidate) {
      const error = 'Cannot send emails: Candidate not found';
      console.error(`[INTERVIEW EMAIL] ❌ ${error}`, {
        candidateId: interview.candidateId,
        interviewId: interview.id,
      });
      errors.push(error);
      return { success: false, errors };
    }

    if (!interviewer && interview.interviewerId) {
      const error = 'Cannot send interviewer email: Interviewer not found';
      console.error(`[INTERVIEW EMAIL] ⚠️ ${error}`, {
        interviewerId: interview.interviewerId,
        interviewId: interview.id,
      });
      errors.push(error);
      // Don't return here - still try to send candidate email
    }

    // Get timezones for candidate and interviewer
    const candidateTimezone = candidate.email ? await timezoneService.getUserTimezoneByEmail(candidate.email) : 'America/New_York';
    const interviewerTimezone = interviewer?.email ? await timezoneService.getUserTimezoneByEmail(interviewer.email) : 'America/New_York';

    // Format date and time for candidate (in their timezone)
    const candidateInterviewDate = new Date(interview.scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: candidateTimezone,
    });

    const candidateInterviewTime = new Date(interview.scheduledDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: candidateTimezone,
      timeZoneName: 'short',
    });

    // Format date and time for interviewer (in their timezone)
    const interviewerInterviewDate = new Date(interview.scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: interviewerTimezone,
    });

    const interviewerInterviewTime = new Date(interview.scheduledDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: interviewerTimezone,
      timeZoneName: 'short',
    });

    // Import email service
    const { emailService } = await import('../email-service');

    // Build interviewer info (could be custom interviewer)
    const interviewerName = interviewer
      ? `${interviewer.firstName} ${interviewer.lastName}`
      : interview.customInterviewerName || 'TBD';

    // Email HTML to candidate (with their timezone)
    const candidateHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Interview Scheduled - ROOF-ER</h2>
        <p>Dear ${candidate.firstName} ${candidate.lastName},</p>
        <p>Your interview has been scheduled for the <strong>${candidate.position}</strong> position at ROOF-ER.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Interview Details</h3>
          <p><strong>Date:</strong> ${candidateInterviewDate}</p>
          <p><strong>Time:</strong> ${candidateInterviewTime}</p>
          <p><strong>Duration:</strong> ${interview.duration} minutes</p>
          <p><strong>Type:</strong> ${interview.type}</p>
          ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
          ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${interview.meetingLink}">${interview.meetingLink}</a></p>` : ''}
          <p><strong>Interviewer:</strong> ${interviewerName}</p>
          ${interview.notes ? `<p><strong>Notes:</strong> ${interview.notes}</p>` : ''}
        </div>
        <p>If you need to reschedule or have any questions, please contact us immediately.</p>
        <p>We look forward to meeting with you!</p>
        <p>Best regards,<br>ROOF-ER Hiring Team</p>
      </div>
    `;

    // Send email to candidate (from the logged-in user's email)
    console.log(`[INTERVIEW EMAIL] Sending confirmation email to candidate: ${candidate.email}`);
    try {
      candidateEmailSent = await emailService.sendEmail({
        to: candidate.email,
        subject: `Interview Scheduled - ${candidate.position} at ROOF-ER`,
        html: candidateHtml,
        candidateId: candidate.id,
        interviewId: interview.id,
        fromUserEmail: fromUserEmail || process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com',
      });

      if (candidateEmailSent) {
        console.log(`[INTERVIEW EMAIL] ✅ Candidate email sent successfully to ${candidate.email}`);
      } else {
        const error = `Failed to send email to candidate: ${candidate.email}`;
        console.error(`[INTERVIEW EMAIL] ❌ ${error}`);
        errors.push(error);
      }
    } catch (candidateEmailError: any) {
      const error = `Error sending email to candidate: ${candidateEmailError?.message || 'Unknown error'}`;
      console.error(`[INTERVIEW EMAIL] ❌ ${error}`, candidateEmailError);
      errors.push(error);
    }

    // Send email to interviewer (only if interviewer exists in system) (with their timezone)
    if (interviewer && interviewer.email) {
      const interviewerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Interview Scheduled</h2>
          <p>Hello ${interviewer.firstName},</p>
          <p>You have an interview scheduled with <strong>${candidate.firstName} ${candidate.lastName}</strong> for the <strong>${candidate.position}</strong> position.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Interview Details</h3>
            <p><strong>Date:</strong> ${interviewerInterviewDate}</p>
            <p><strong>Time:</strong> ${interviewerInterviewTime}</p>
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

      console.log(`[INTERVIEW EMAIL] Sending confirmation email to interviewer: ${interviewer.email}`);
      try {
        interviewerEmailSent = await emailService.sendEmail({
          to: interviewer.email,
          subject: `Interview Scheduled - ${candidate.firstName} ${candidate.lastName}`,
          html: interviewerHtml,
          interviewId: interview.id,
          fromUserEmail: fromUserEmail || process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com',
        });

        if (interviewerEmailSent) {
          console.log(`[INTERVIEW EMAIL] ✅ Interviewer email sent successfully to ${interviewer.email}`);
        } else {
          const error = `Failed to send email to interviewer: ${interviewer.email}`;
          console.error(`[INTERVIEW EMAIL] ❌ ${error}`);
          errors.push(error);
        }
      } catch (interviewerEmailError: any) {
        const error = `Error sending email to interviewer: ${interviewerEmailError?.message || 'Unknown error'}`;
        console.error(`[INTERVIEW EMAIL] ❌ ${error}`, interviewerEmailError);
        errors.push(error);
      }
    } else {
      console.log('[INTERVIEW EMAIL] ℹ️ Skipping interviewer email (custom interviewer or no email)');
    }

    // Summary logging
    if (candidateEmailSent || interviewerEmailSent) {
      console.log('[INTERVIEW EMAIL] ✅ Email summary:', {
        interviewId: interview.id,
        candidateEmailSent,
        interviewerEmailSent,
        totalErrors: errors.length,
      });
    }

    return {
      success: (candidateEmailSent || interviewerEmailSent) && errors.length === 0,
      errors,
    };

  } catch (error: any) {
    const errorMsg = `Unexpected error sending interview emails: ${error?.message || 'Unknown error'}`;
    console.error(`[INTERVIEW EMAIL] ❌ ${errorMsg}`, {
      interviewId: interview.id,
      stack: error?.stack,
    });
    errors.push(errorMsg);
    return { success: false, errors };
  }
}

export default router;