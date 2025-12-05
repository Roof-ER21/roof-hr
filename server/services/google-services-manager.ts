import { googleAuthService } from './google-auth';
import { gmailService } from './gmail-service';
import { googleCalendarService } from './google-calendar-service';
import { googleSheetsService } from './google-sheets-service';
import { googleDriveService } from './google-drive-service';
import { googleDocsService } from './google-docs-service';

class GoogleServicesManager {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('[Google Services] Initializing all Google services...');
      
      // Initialize auth first
      await googleAuthService.initialize();
      
      // Initialize all services
      await Promise.all([
        gmailService.initialize(),
        googleCalendarService.initialize(),
        googleSheetsService.initialize(),
        googleDriveService.initialize(),
        googleDocsService.initialize()
      ]);

      this.initialized = true;
      console.log('[Google Services] All services initialized successfully');
    } catch (error) {
      console.error('[Google Services] Initialization error:', error);
      throw error;
    }
  }

  getGmailService() {
    if (!this.initialized) throw new Error('Google services not initialized');
    return gmailService;
  }

  getCalendarService() {
    if (!this.initialized) throw new Error('Google services not initialized');
    return googleCalendarService;
  }

  getSheetsService() {
    if (!this.initialized) throw new Error('Google services not initialized');
    return googleSheetsService;
  }

  getDriveService() {
    if (!this.initialized) throw new Error('Google services not initialized');
    return googleDriveService;
  }

  getDocsService() {
    if (!this.initialized) throw new Error('Google services not initialized');
    return googleDocsService;
  }

  getAuthService() {
    return googleAuthService;
  }

  async testConnection() {
    try {
      // Test Gmail
      const labels = await gmailService.getLabels();
      console.log('[Google Services] Gmail connected, labels:', labels?.length);

      // Test Calendar
      const events = await googleCalendarService.getEvents({ maxResults: 1 });
      console.log('[Google Services] Calendar connected, events:', events?.length);

      // Test Drive
      const files = await googleDriveService.listFiles({ pageSize: 1 });
      console.log('[Google Services] Drive connected, files:', files?.length);

      return {
        gmail: true,
        calendar: true,
        drive: true,
        sheets: true,
        docs: true
      };
    } catch (error) {
      console.error('[Google Services] Connection test failed:', error);
      throw error;
    }
  }
}

export const googleServicesManager = new GoogleServicesManager();