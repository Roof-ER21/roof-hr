import { Router } from 'express';
import { googleServicesManager } from '../services/google-services-manager';
import { serviceAccountAuth } from '../services/service-account-auth';
import { requireAuth, checkRole } from '../middleware/auth';
import { db } from '../db';
import { toolInventory, candidates, users, documents, calendarEvents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize Google services on server start
googleServicesManager.initialize().catch(console.error);

// Check service account status
router.get('/service-account-status', requireAuth, async (req, res) => {
  try {
    const isConfigured = serviceAccountAuth.isConfigured();
    const serviceAccountEmail = serviceAccountAuth.getServiceAccountEmail();
    const userEmail = (req as any).user?.email;
    
    res.json({ 
      isConfigured,
      serviceAccountEmail,
      userEmail,
      message: isConfigured 
        ? 'Service account is configured. Google features will work automatically for logged-in users.' 
        : 'Service account not configured. Users need individual API keys.'
    });
  } catch (error: any) {
    console.error('Error checking service account status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test Google services connection
router.get('/test-connection', requireAuth, checkRole(['ADMIN']), async (req, res) => {
  try {
    const status = await googleServicesManager.testConnection();
    res.json({ success: true, status });
  } catch (error: any) {
    console.error('Google services test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// OAuth code exchange endpoint
router.post('/exchange-code', requireAuth, checkRole(['ADMIN']), async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Service account doesn't need OAuth code exchange - tokens are automatic
    // This endpoint is only for OAuth flows, which we don't use with service accounts
    res.status(400).json({
      error: 'OAuth code exchange not needed with service account authentication',
      message: 'The system uses service account authentication which handles tokens automatically.'
    });
  } catch (error: any) {
    console.error('Error in exchange-code endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gmail Routes
router.post('/gmail/send', requireAuth, async (req, res) => {
  try {
    const { to, subject, html, text, cc, bcc, attachments } = req.body;
    const userEmail = (req as any).user?.email; // Get logged-in user's email
    
    const result = await googleServicesManager.getGmailService().sendEmail({
      to,
      subject,
      html,
      text,
      cc,
      bcc,
      attachments,
      userEmail // Pass user email for impersonation
    });
    res.json(result);
  } catch (error: any) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/gmail/inbox', requireAuth, async (req, res) => {
  try {
    const { query = 'is:unread', maxResults = 10 } = req.query;
    const userEmail = (req as any).user?.email;
    
    // If service account is configured, get emails for the logged-in user
    if (userEmail && serviceAccountAuth.isConfigured()) {
      try {
        const gmail = await serviceAccountAuth.getGmailForUser(userEmail);
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query as string,
          maxResults: parseInt(maxResults as string)
        });
        
        const messages = response.data.messages || [];
        const emails = [];
        
        for (const message of messages) {
          if (message.id) {
            const emailResponse = await gmail.users.messages.get({
              userId: 'me',
              id: message.id
            });
            emails.push(emailResponse.data);
          }
        }
        
        return res.json(emails);
      } catch (error) {
        console.warn('[Gmail] Failed to fetch user inbox, falling back:', error);
      }
    }
    
    // Fallback to system account
    const emails = await googleServicesManager.getGmailService().getEmails(
      query as string,
      parseInt(maxResults as string)
    );
    res.json(emails);
  } catch (error: any) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Google Calendar Routes
router.post('/calendar/events', requireAuth, async (req, res) => {
  try {
    const userEmail = (req as any).user?.email;
    
    // Try to use user's calendar if service account is configured
    if (userEmail && serviceAccountAuth.isConfigured()) {
      try {
        const calendar = await serviceAccountAuth.getCalendarForUser(userEmail);
        const event = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: req.body
        });
        return res.json(event.data);
      } catch (error) {
        console.warn('[Calendar] Failed to create event as user, falling back:', error);
      }
    }
    
    // Fallback to system account
    const event = await googleServicesManager.getCalendarService().createEvent(req.body);
    res.json(event);
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create calendar event with local database tracking
router.post('/calendar/user-events', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userEmail = user?.email;
    const { type, title, description, startDate, endDate, location, allDay, addGoogleMeet, ptoType, candidateId, interviewId } = req.body;

    // Validate required fields
    if (!type || !title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields: type, title, startDate, endDate' });
    }

    let googleEventId = null;
    let meetLink = null;

    // Create event in Google Calendar
    if (userEmail && serviceAccountAuth.isConfigured()) {
      try {
        const calendar = await serviceAccountAuth.getCalendarForUser(userEmail);

        const eventData: any = {
          summary: title,
          description: description || '',
          start: allDay
            ? { date: new Date(startDate).toISOString().split('T')[0] }
            : { dateTime: new Date(startDate).toISOString(), timeZone: 'America/New_York' },
          end: allDay
            ? { date: new Date(endDate).toISOString().split('T')[0] }
            : { dateTime: new Date(endDate).toISOString(), timeZone: 'America/New_York' },
          location: location || undefined,
        };

        // Add Google Meet if requested
        if (addGoogleMeet) {
          eventData.conferenceData = {
            createRequest: {
              requestId: uuidv4(),
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          };
        }

        const googleEvent = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventData,
          conferenceDataVersion: addGoogleMeet ? 1 : 0,
        });

        googleEventId = googleEvent.data.id;
        meetLink = googleEvent.data.hangoutLink || null;
      } catch (error) {
        console.warn('[Calendar] Failed to create Google Calendar event:', error);
      }
    }

    // Save to local database
    const eventId = uuidv4();
    const [newEvent] = await db.insert(calendarEvents).values({
      id: eventId,
      userId: String(user.id),
      googleEventId,
      type,
      title,
      description: description || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location: location || null,
      meetLink,
      allDay: allDay || false,
      ptoType: ptoType || null,
      candidateId: candidateId || null,
      interviewId: interviewId || null,
    }).returning();

    res.json(newEvent);
  } catch (error: any) {
    console.error('Error creating user calendar event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update calendar event
router.put('/calendar/user-events/:eventId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userEmail = user?.email;
    const { eventId } = req.params;
    const { title, description, startDate, endDate, location, allDay, type, ptoType } = req.body;

    // Find the event and verify ownership
    const [existingEvent] = await db.select().from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, String(user.id))));

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found or not authorized' });
    }

    // Update Google Calendar if linked
    if (existingEvent.googleEventId && userEmail && serviceAccountAuth.isConfigured()) {
      try {
        const calendar = await serviceAccountAuth.getCalendarForUser(userEmail);

        const eventData: any = {
          summary: title || existingEvent.title,
          description: description !== undefined ? description : existingEvent.description,
          start: (allDay !== undefined ? allDay : existingEvent.allDay)
            ? { date: new Date(startDate || existingEvent.startDate).toISOString().split('T')[0] }
            : { dateTime: new Date(startDate || existingEvent.startDate).toISOString(), timeZone: 'America/New_York' },
          end: (allDay !== undefined ? allDay : existingEvent.allDay)
            ? { date: new Date(endDate || existingEvent.endDate).toISOString().split('T')[0] }
            : { dateTime: new Date(endDate || existingEvent.endDate).toISOString(), timeZone: 'America/New_York' },
          location: location !== undefined ? location : existingEvent.location,
        };

        await calendar.events.update({
          calendarId: 'primary',
          eventId: existingEvent.googleEventId,
          requestBody: eventData,
        });
      } catch (error) {
        console.warn('[Calendar] Failed to update Google Calendar event:', error);
      }
    }

    // Update local database
    const [updatedEvent] = await db.update(calendarEvents)
      .set({
        title: title || existingEvent.title,
        description: description !== undefined ? description : existingEvent.description,
        startDate: startDate ? new Date(startDate) : existingEvent.startDate,
        endDate: endDate ? new Date(endDate) : existingEvent.endDate,
        location: location !== undefined ? location : existingEvent.location,
        allDay: allDay !== undefined ? allDay : existingEvent.allDay,
        type: type || existingEvent.type,
        ptoType: ptoType !== undefined ? ptoType : existingEvent.ptoType,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, eventId))
      .returning();

    res.json(updatedEvent);
  } catch (error: any) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete calendar event
router.delete('/calendar/user-events/:eventId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userEmail = user?.email;
    const { eventId } = req.params;

    // Find the event and verify ownership
    const [existingEvent] = await db.select().from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, String(user.id))));

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found or not authorized' });
    }

    // Delete from Google Calendar if linked
    if (existingEvent.googleEventId && userEmail && serviceAccountAuth.isConfigured()) {
      try {
        const calendar = await serviceAccountAuth.getCalendarForUser(userEmail);
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: existingEvent.googleEventId,
        });
      } catch (error) {
        console.warn('[Calendar] Failed to delete Google Calendar event:', error);
      }
    }

    // Delete from local database
    await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId));

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's local calendar events
router.get('/calendar/user-events', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { timeMin, timeMax } = req.query;

    let query = db.select().from(calendarEvents).where(eq(calendarEvents.userId, String(user.id)));

    const events = await query;

    // Filter by date range if provided
    let filteredEvents = events;
    if (timeMin || timeMax) {
      const startFilter = timeMin ? new Date(timeMin as string) : new Date(0);
      const endFilter = timeMax ? new Date(timeMax as string) : new Date('2099-12-31');
      filteredEvents = events.filter(event => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        return eventStart >= startFilter && eventEnd <= endFilter;
      });
    }

    res.json(filteredEvents);
  } catch (error: any) {
    console.error('Error fetching user calendar events:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/calendar/events', requireAuth, async (req, res) => {
  try {
    const userEmail = (req as any).user?.email;
    
    // Try to get user's calendar events if service account is configured
    if (userEmail && serviceAccountAuth.isConfigured()) {
      try {
        const calendar = await serviceAccountAuth.getCalendarForUser(userEmail);
        const response = await calendar.events.list({
          calendarId: 'primary',
          ...req.query
        });
        return res.json(response.data.items || []);
      } catch (error) {
        console.warn('[Calendar] Failed to fetch user events, falling back:', error);
      }
    }
    
    // Fallback to system account
    const events = await googleServicesManager.getCalendarService().getEvents(req.query);
    res.json(events);
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/calendar/schedule-interview', requireAuth, async (req, res) => {
  try {
    const { candidateId, interviewDetails } = req.body;
    
    // Get candidate data
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, candidateId));
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Schedule the interview
    const event = await googleServicesManager.getCalendarService().createInterviewEvent(
      candidate,
      interviewDetails
    );

    // Update candidate status
    await db.update(candidates)
      .set({ 
        status: 'INTERVIEW',
        notes: `Interview scheduled: ${new Date(interviewDetails.date).toLocaleString()}. Google Calendar Event ID: ${event.id}`
      })
      .where(eq(candidates.id, candidateId));

    res.json({ success: true, event });
  } catch (error: any) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/calendar/check-availability', requireAuth, async (req, res) => {
  try {
    const availability = await googleServicesManager.getCalendarService().checkAvailability(req.body);
    res.json(availability);
  } catch (error: any) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: error.message });
  }
});

// My Calendar - Combined view of Google Calendar + Interviews + PTO for logged-in user
router.get('/calendar/my-events', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const userEmail = user?.email;
    const { timeMin, timeMax } = req.query;

    // Set default time range (current month)
    const now = new Date();
    const defaultTimeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultTimeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const startDate = timeMin ? new Date(timeMin as string) : new Date(defaultTimeMin);
    const endDate = timeMax ? new Date(timeMax as string) : new Date(defaultTimeMax);

    const events: any[] = [];

    // 1. Fetch Google Calendar events for the user
    if (userEmail && serviceAccountAuth.isConfigured()) {
      try {
        const calendar = await serviceAccountAuth.getCalendarForUser(userEmail);
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });

        for (const item of (response.data.items || [])) {
          events.push({
            id: item.id,
            type: 'MEETING',
            title: item.summary || 'Untitled',
            description: item.description,
            startDate: item.start?.dateTime || item.start?.date,
            endDate: item.end?.dateTime || item.end?.date,
            location: item.location,
            meetingLink: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri,
            source: 'google_calendar',
            color: 'green'
          });
        }
      } catch (calError) {
        console.warn('[My Calendar] Failed to fetch Google Calendar events:', calError);
      }
    }

    // 2. Fetch user's interviews (as interviewer)
    try {
      const { storage } = await import('../storage');
      const allInterviews = await storage.getAllInterviews();
      const userInterviews = allInterviews.filter((interview: any) => {
        const interviewDate = new Date(interview.scheduledDate);
        return (
          interview.interviewerId === user.id &&
          interviewDate >= startDate &&
          interviewDate <= endDate &&
          interview.status !== 'CANCELLED'
        );
      });

      for (const interview of userInterviews) {
        const candidate = await storage.getCandidateById(interview.candidateId);
        events.push({
          id: interview.id,
          type: 'INTERVIEW',
          title: `Interview: ${candidate?.firstName} ${candidate?.lastName} - ${candidate?.position}`,
          description: interview.notes,
          startDate: interview.scheduledDate,
          endDate: new Date(new Date(interview.scheduledDate).getTime() + interview.duration * 60000).toISOString(),
          location: interview.location,
          meetingLink: interview.meetingLink,
          candidateId: interview.candidateId,
          interviewType: interview.type,
          source: 'interview',
          color: 'blue'
        });
      }
    } catch (intError) {
      console.warn('[My Calendar] Failed to fetch interviews:', intError);
    }

    // 3. Fetch user's approved PTO
    try {
      const { storage } = await import('../storage');
      const allPto = await storage.getAllPtoRequests();
      const userPto = allPto.filter((pto: any) => {
        const ptoStart = new Date(pto.startDate);
        const ptoEnd = new Date(pto.endDate);
        return (
          pto.employeeId === user.id &&
          pto.status === 'APPROVED' &&
          ptoEnd >= startDate &&
          ptoStart <= endDate
        );
      });

      for (const pto of userPto) {
        events.push({
          id: pto.id,
          type: 'PTO',
          title: `PTO: ${pto.type}`,
          description: pto.reason,
          startDate: pto.startDate,
          endDate: pto.endDate,
          ptoType: pto.type,
          days: pto.days,
          source: 'pto',
          color: 'red'
        });
      }
    } catch (ptoError) {
      console.warn('[My Calendar] Failed to fetch PTO:', ptoError);
    }

    // 4. Fetch user-created events from calendarEvents table
    try {
      const userCreatedEvents = await db.select().from(calendarEvents).where(eq(calendarEvents.userId, String(user.id)));

      // Filter by date range
      const filteredUserEvents = userCreatedEvents.filter(event => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        return eventEnd >= startDate && eventStart <= endDate;
      });

      for (const event of filteredUserEvents) {
        events.push({
          id: event.id.toString(),
          googleEventId: event.googleEventId,
          type: event.type as 'MEETING' | 'PTO' | 'INTERVIEW' | 'OTHER',
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          meetLink: event.meetLink,
          allDay: event.allDay,
          ptoType: event.ptoType,
          userId: event.userId,
          source: 'user-events',
          color: event.type === 'PTO' ? 'red' : event.type === 'INTERVIEW' ? 'blue' : 'green'
        });
      }
    } catch (userEventError) {
      console.warn('[My Calendar] Failed to fetch user-created events:', userEventError);
    }

    // Sort events by start date
    events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    res.json(events);
  } catch (error: any) {
    console.error('Error fetching my calendar events:', error);
    res.status(500).json({ error: error.message });
  }
});

// Team PTO - For managers to see team members' approved PTO
router.get('/calendar/team-pto', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { timeMin, timeMax, department } = req.query;

    // Only managers and admins can view team PTO
    if (!['ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TRUE_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Manager access required to view team PTO' });
    }

    // Set default time range (current month)
    const now = new Date();
    const defaultTimeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultTimeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const startDate = timeMin ? new Date(timeMin as string) : new Date(defaultTimeMin);
    const endDate = timeMax ? new Date(timeMax as string) : new Date(defaultTimeMax);

    const events: any[] = [];

    try {
      const { storage } = await import('../storage');
      const allPto = await storage.getAllPtoRequests();
      const allUsers = await storage.getAllUsers();

      // Filter by department if specified, otherwise get all approved PTO
      const filteredPto = allPto.filter((pto: any) => {
        const ptoStart = new Date(pto.startDate);
        const ptoEnd = new Date(pto.endDate);
        const employee = allUsers.find((u: any) => u.id === pto.employeeId);

        // Exclude the current user's own PTO (they can see that in my-events)
        if (pto.employeeId === user.id) return false;

        // Check date range
        if (ptoEnd < startDate || ptoStart > endDate) return false;

        // Check status
        if (pto.status !== 'APPROVED') return false;

        // Filter by department if specified
        if (department && employee?.department !== department) return false;

        return true;
      });

      for (const pto of filteredPto) {
        const employee = allUsers.find((u: any) => u.id === pto.employeeId);
        events.push({
          id: pto.id,
          type: 'TEAM_PTO',
          title: `${employee?.firstName} ${employee?.lastName} - ${pto.type}`,
          description: `${employee?.firstName} ${employee?.lastName} is on ${pto.type} leave`,
          startDate: pto.startDate,
          endDate: pto.endDate,
          ptoType: pto.type,
          days: pto.days,
          employeeId: pto.employeeId,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
          department: employee?.department,
          source: 'team_pto',
          color: 'purple'
        });
      }
    } catch (ptoError) {
      console.warn('[Team PTO] Failed to fetch team PTO:', ptoError);
    }

    // Sort events by start date
    events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    res.json(events);
  } catch (error: any) {
    console.error('Error fetching team PTO:', error);
    res.status(500).json({ error: error.message });
  }
});

// Google Sheets Routes for Tools Inventory
router.post('/sheets/export-tools', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    // Get all tools from database
    const tools = await db.select().from(toolInventory);
    
    // Export to Google Sheets
    const spreadsheet = await googleServicesManager.getSheetsService().exportToolsInventory(tools);
    
    res.json({ 
      success: true, 
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl
    });
  } catch (error: any) {
    console.error('Error exporting tools to Sheets:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/sheets/import-tools', requireAuth, checkRole(['ADMIN']), async (req, res) => {
  try {
    const { spreadsheetId } = req.body;
    
    // Import tools from Google Sheets
    const tools = await googleServicesManager.getSheetsService().importToolsInventory(spreadsheetId);
    
    // Update database with imported tools
    for (const tool of tools) {
      await db.insert(toolInventory)
        .values({
          ...tool,
          createdBy: (req as any).user.id
        })
        .onConflictDoNothing();
    }
    
    res.json({ success: true, imported: tools.length });
  } catch (error: any) {
    console.error('Error importing tools from Sheets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Google Drive Routes
router.post('/drive/upload', requireAuth, async (req, res) => {
  try {
    const { name, content, mimeType, parentFolderId, description } = req.body;
    const file = await googleServicesManager.getDriveService().uploadFile({
      name,
      content: Buffer.from(content, 'base64'),
      mimeType,
      parentFolderId,
      description
    });
    res.json(file);
  } catch (error: any) {
    console.error('Error uploading to Drive:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/drive/files', requireAuth, async (req, res) => {
  try {
    const files = await googleServicesManager.getDriveService().listFiles(req.query);
    res.json(files);
  } catch (error: any) {
    console.error('Error listing Drive files:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/drive/setup-hr-structure', requireAuth, checkRole(['ADMIN']), async (req, res) => {
  try {
    const structure = await googleServicesManager.getDriveService().setupHRDocumentStructure();
    res.json({ success: true, structure });
  } catch (error: any) {
    console.error('Error setting up HR structure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Google Docs Routes
router.post('/docs/create-contract', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { employeeId, contractDetails } = req.body;
    
    // Get employee data
    const [employee] = await db.select().from(users).where(eq(users.id, employeeId));
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Create contract in Google Docs
    const doc = await googleServicesManager.getDocsService().createEmployeeContract(
      employee,
      contractDetails
    );

    // Save reference in database
    await db.insert(documents).values({
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Employment Contract - ${employee.firstName} ${employee.lastName}`,
      originalName: `contract-${employee.firstName}-${employee.lastName}.docx`,
      category: 'LEGAL',
      type: 'DOC',
      fileUrl: `https://docs.google.com/document/d/${doc.documentId}`,
      fileSize: 0, // Google Docs doesn't provide size
      createdBy: (req as any).user.id,
      visibility: 'ADMIN',
      status: 'APPROVED'
    });

    res.json({ 
      success: true, 
      documentId: doc.documentId,
      documentUrl: `https://docs.google.com/document/d/${doc.documentId}`
    });
  } catch (error: any) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/docs/create-review', requireAuth, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { employeeId, review } = req.body;
    
    // Get employee data
    const [employee] = await db.select().from(users).where(eq(users.id, employeeId));
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Create review in Google Docs
    const doc = await googleServicesManager.getDocsService().createPerformanceReview(
      employee,
      review
    );

    res.json({ 
      success: true, 
      documentId: doc.documentId,
      documentUrl: `https://docs.google.com/document/d/${doc.documentId}`
    });
  } catch (error: any) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/docs/:documentId/export', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { format = 'pdf' } = req.query;

    if (format === 'pdf') {
      const pdfStream = await googleServicesManager.getDocsService().exportToPDF(documentId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="document.pdf"`);
      pdfStream.pipe(res);
    } else if (format === 'html') {
      const html = await googleServicesManager.getDocsService().exportToHTML(documentId);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } else {
      res.status(400).json({ error: 'Invalid format. Use pdf or html' });
    }
  } catch (error: any) {
    console.error('Error exporting document:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;