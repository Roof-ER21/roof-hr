import { Router } from 'express';
import { googleServicesManager } from '../services/google-services-manager';
import { serviceAccountAuth } from '../services/service-account-auth';
import { requireAuth, checkRole } from '../middleware/auth';
import { db } from '../db';
import { toolInventory, candidates, users, documents } from '@shared/schema';
import { eq } from 'drizzle-orm';

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