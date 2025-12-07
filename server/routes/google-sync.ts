import express, { Request, Response, NextFunction } from 'express';
import { googleSyncOrchestrator } from '../services/google-sync-orchestrator';
import { googleServicesManager } from '../services/google-services-manager';

const router = express.Router();

// Middleware for admin authentication
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }

  next();
}

// Get sync status for all services
router.get('/api/google-sync/status', requireAdmin, async (req, res) => {
  try {
    const status = googleSyncOrchestrator.getSyncStatus();
    res.json({ 
      status,
      services: {
        gmail: true,
        calendar: true,
        drive: true,
        sheets: true,
        docs: true
      }
    });
  } catch (error: any) {
    console.error('[Google Sync API] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Force sync all services
router.post('/api/google-sync/sync-all', requireAdmin, async (req, res) => {
  try {
    console.log('[Google Sync API] Starting full sync...');
    
    // Run sync in background
    googleSyncOrchestrator.forceSyncAll().then(() => {
      console.log('[Google Sync API] Full sync completed');
    }).catch((error) => {
      console.error('[Google Sync API] Full sync failed:', error);
    });
    
    res.json({ 
      message: 'Full synchronization started',
      status: 'in_progress'
    });
  } catch (error: any) {
    console.error('[Google Sync API] Error starting sync:', error);
    res.status(500).json({ error: 'Failed to start synchronization' });
  }
});

// Force sync specific service
router.post('/api/google-sync/sync/:service', requireAdmin, async (req, res) => {
  try {
    const { service } = req.params;
    
    const validServices = [
      'drive-hr-folder',
      'sheets-inventory',
      'sheets-employees',
      'calendar-pto',
      'calendar-interviews',
      'drive-coi-documents'
    ];
    
    if (!validServices.includes(service)) {
      return res.status(400).json({ 
        error: 'Invalid service name',
        validServices 
      });
    }
    
    console.log(`[Google Sync API] Starting sync for ${service}...`);
    
    // Run sync in background
    googleSyncOrchestrator.forceSyncService(service).then(() => {
      console.log(`[Google Sync API] Sync completed for ${service}`);
    }).catch((error) => {
      console.error(`[Google Sync API] Sync failed for ${service}:`, error);
    });
    
    res.json({ 
      message: `Synchronization started for ${service}`,
      service,
      status: 'in_progress'
    });
  } catch (error: any) {
    console.error('[Google Sync API] Error starting service sync:', error);
    res.status(500).json({ error: 'Failed to start service synchronization' });
  }
});

// Test Google services connection
router.get('/api/google-sync/test-connection', requireAdmin, async (req, res) => {
  try {
    const result = await googleServicesManager.testConnection();
    res.json({ 
      connected: true,
      services: result
    });
  } catch (error: any) {
    console.error('[Google Sync API] Connection test failed:', error);
    res.status(500).json({ 
      connected: false,
      error: error.message,
      services: {
        gmail: false,
        calendar: false,
        drive: false,
        sheets: false,
        docs: false
      }
    });
  }
});

// Get HR folder structure
router.get('/api/google-sync/hr-folder', requireAdmin, async (req, res) => {
  try {
    const driveService = googleServicesManager.getDriveService();
    const hrFolderName = 'ROOF-ER HR Management';
    
    const hrFolder = await driveService.findFolderByName(hrFolderName);
    if (!hrFolder) {
      return res.status(404).json({ error: 'HR folder not found' });
    }
    
    const subfolders = await driveService.listFiles({
      q: `'${hrFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name, createdTime, modifiedTime)'
    });
    
    res.json({
      hrFolder: {
        id: hrFolder.id,
        name: hrFolder.name,
        webViewLink: hrFolder.webViewLink
      },
      subfolders
    });
  } catch (error: any) {
    console.error('[Google Sync API] Error getting HR folder:', error);
    res.status(500).json({ error: 'Failed to get HR folder structure' });
  }
});

// Get sync configuration
router.get('/api/google-sync/config', requireAdmin, async (req, res) => {
  try {
    const config = {
      syncIntervals: {
        'drive-hr-folder': '*/15 * * * *',
        'sheets-inventory': '*/10 * * * *',
        'sheets-employees': '*/10 * * * *',
        'calendar-pto': '*/5 * * * *',
        'calendar-interviews': '*/5 * * * *',
        'drive-coi-documents': '0 8,12,16 * * *'
      },
      enabled: true,
      lastInitialized: new Date()
    };
    
    res.json(config);
  } catch (error: any) {
    console.error('[Google Sync API] Error getting config:', error);
    res.status(500).json({ error: 'Failed to get sync configuration' });
  }
});

// Manual upload to Google Drive
router.post('/api/google-sync/upload', requireAdmin, async (req, res) => {
  try {
    const { fileName, fileContent, folderId, mimeType } = req.body;
    
    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'fileName and fileContent are required' });
    }
    
    const driveService = googleServicesManager.getDriveService();
    
    const file = await driveService.uploadFile({
      name: fileName,
      content: Buffer.from(fileContent, 'base64'),
      mimeType: mimeType || 'application/pdf',
      folderId
    });
    
    res.json({
      success: true,
      file: {
        id: file.id,
        name: file.name,
        webViewLink: file.webViewLink
      }
    });
  } catch (error: any) {
    console.error('[Google Sync API] Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Create Google Calendar event
router.post('/api/google-sync/calendar/event', requireAdmin, async (req, res) => {
  try {
    const { summary, description, start, end, attendees, calendarId } = req.body;
    
    if (!summary || !start || !end) {
      return res.status(400).json({ error: 'summary, start, and end are required' });
    }
    
    const calendarService = googleServicesManager.getCalendarService();
    
    const event = await calendarService.createEvent(calendarId || 'primary', {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees
    });
    
    res.json({
      success: true,
      event: {
        id: event.id,
        htmlLink: event.htmlLink,
        summary: event.summary
      }
    });
  } catch (error: any) {
    console.error('[Google Sync API] Error creating event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Update Google Sheet
router.post('/api/google-sync/sheets/update', requireAdmin, async (req, res) => {
  try {
    const { spreadsheetId, range, values } = req.body;
    
    if (!spreadsheetId || !range || !values) {
      return res.status(400).json({ error: 'spreadsheetId, range, and values are required' });
    }
    
    const sheetsService = googleServicesManager.getSheetsService();
    
    const result = await sheetsService.updateSheet(spreadsheetId, range, values);
    
    res.json({
      success: true,
      updatedCells: result.updatedCells,
      updatedRange: result.updatedRange
    });
  } catch (error: any) {
    console.error('[Google Sync API] Error updating sheet:', error);
    res.status(500).json({ error: 'Failed to update Google Sheet' });
  }
});

export default router;