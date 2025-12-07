import { googleServicesManager } from './google-services-manager';
import { storage } from '../storage';
import { EventEmitter } from 'events';
import cron from 'node-cron';

interface SyncConfig {
  enabled: boolean;
  interval: string; // cron expression
  lastSync?: Date;
  errors?: string[];
}

interface SyncStatus {
  service: string;
  status: 'pending' | 'syncing' | 'success' | 'error';
  lastSync?: Date;
  nextSync?: Date;
  error?: string;
}

class GoogleSyncOrchestrator extends EventEmitter {
  private syncConfigs: Map<string, SyncConfig> = new Map();
  private syncTasks: Map<string, any> = new Map();
  private hrFolderId: string | null = null;
  private syncStatus: Map<string, SyncStatus> = new Map();

  constructor() {
    super();
    this.initializeConfigs();
  }

  private initializeConfigs() {
    // Define sync configurations for each service
    this.syncConfigs.set('drive-hr-folder', {
      enabled: true,
      interval: '*/15 * * * *', // Every 15 minutes
    });
    
    this.syncConfigs.set('sheets-inventory', {
      enabled: true,
      interval: '*/10 * * * *', // Every 10 minutes
    });
    
    this.syncConfigs.set('sheets-employees', {
      enabled: true,
      interval: '*/10 * * * *', // Every 10 minutes
    });
    
    this.syncConfigs.set('calendar-pto', {
      enabled: true,
      interval: '*/5 * * * *', // Every 5 minutes
    });
    
    this.syncConfigs.set('calendar-interviews', {
      enabled: true,
      interval: '*/5 * * * *', // Every 5 minutes
    });
    
    this.syncConfigs.set('drive-coi-documents', {
      enabled: true,
      interval: '0 8,12,16 * * *', // Three times a day
    });
  }

  async initialize() {
    console.log('[Google Sync] Initializing Google Sync Orchestrator...');
    
    try {
      // Initialize Google services first
      await googleServicesManager.initialize();
      
      // Set up HR folder structure
      await this.setupHRFolderStructure();
      
      // Start all sync tasks
      await this.startAllSyncTasks();
      
      console.log('[Google Sync] Orchestrator initialized successfully');
    } catch (error) {
      console.error('[Google Sync] Initialization failed:', error);
      throw error;
    }
  }

  private async setupHRFolderStructure() {
    const driveService = googleServicesManager.getDriveService();
    
    try {
      // Create or get main HR folder
      const hrFolderName = 'ROOF-ER HR Management';
      let hrFolder = await driveService.findFolderByName(hrFolderName);
      
      if (!hrFolder) {
        console.log('[Google Sync] Creating HR folder structure...');
        hrFolder = await driveService.createFolder(hrFolderName);
      }
      
      this.hrFolderId = hrFolder.id;
      
      // Create subfolder structure
      const subfolders = [
        'Employees',
        'Candidates',
        'Documents',
        'Performance Reviews',
        'PTO Records',
        'Tools & Equipment',
        'COI Documents',
        'Contracts',
        'Onboarding',
        'Training',
        'Policies'
      ];
      
      for (const subfolder of subfolders) {
        const existing = await driveService.findFolderByName(subfolder, this.hrFolderId || undefined);
        if (!existing) {
          await driveService.createFolder(subfolder, this.hrFolderId || undefined);
          console.log(`[Google Sync] Created subfolder: ${subfolder}`);
        }
      }
      
      console.log('[Google Sync] HR folder structure ready');
    } catch (error) {
      console.error('[Google Sync] Failed to set up HR folder structure:', error);
      throw error;
    }
  }

  private async startAllSyncTasks() {
    for (const [name, config] of Array.from(this.syncConfigs.entries())) {
      if (config.enabled) {
        this.startSyncTask(name, config);
      }
    }
  }

  private startSyncTask(name: string, config: SyncConfig) {
    // Clear existing task if any
    if (this.syncTasks.has(name)) {
      const task = this.syncTasks.get(name);
      task.stop();
    }
    
    // Schedule new task
    const task = cron.schedule(config.interval, async () => {
      await this.executeSyncTask(name);
    });
    
    this.syncTasks.set(name, task);
    
    // Execute immediately on start
    this.executeSyncTask(name);
    
    console.log(`[Google Sync] Started sync task: ${name} (${config.interval})`);
  }

  private async executeSyncTask(name: string) {
    console.log(`[Google Sync] Executing sync: ${name}`);
    
    this.updateSyncStatus(name, 'syncing');
    
    try {
      switch (name) {
        case 'drive-hr-folder':
          await this.syncHRFolderDocuments();
          break;
        case 'sheets-inventory':
          await this.syncInventoryWithSheets();
          break;
        case 'sheets-employees':
          await this.syncEmployeesWithSheets();
          break;
        case 'calendar-pto':
          await this.syncPTOWithCalendar();
          break;
        case 'calendar-interviews':
          await this.syncInterviewsWithCalendar();
          break;
        case 'drive-coi-documents':
          await this.syncCOIDocuments();
          break;
      }
      
      this.updateSyncStatus(name, 'success', new Date());
      this.emit('sync-complete', { task: name, status: 'success' });
    } catch (error: any) {
      console.error(`[Google Sync] Error in ${name}:`, error);
      this.updateSyncStatus(name, 'error', new Date(), error.message);
      this.emit('sync-error', { task: name, error: error.message });
    }
  }

  private updateSyncStatus(service: string, status: SyncStatus['status'], lastSync?: Date, error?: string) {
    this.syncStatus.set(service, {
      service,
      status,
      lastSync: lastSync || this.syncStatus.get(service)?.lastSync,
      error
    });
  }

  async syncHRFolderDocuments() {
    const driveService = googleServicesManager.getDriveService();
    
    // Get all documents from HR folder
    const files = await driveService.listFiles({
      q: `'${this.hrFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, modifiedTime, mimeType, parents)',
    });
    
    // Process and categorize documents
    for (const file of files) {
      // Update local database with file metadata
      await this.updateLocalFileRecord(file);
    }
    
    console.log(`[Google Sync] Synced ${files.length} documents from HR folder`);
  }

  async syncInventoryWithSheets() {
    const sheetsService = googleServicesManager.getSheetsService();
    
    // Get or create inventory spreadsheet
    let spreadsheetId = await this.getOrCreateSpreadsheet('ROOF-ER Inventory Management');
    
    // Get all inventory from database
    const inventory = await storage.getAllToolInventory();
    
    // Prepare data for sheets
    const headers = ['ID', 'Name', 'Category', 'Quantity', 'Available', 'Location', 'Condition', 'Last Updated'];
    const rows = inventory.map(item => [
      item.id,
      item.name,
      item.category,
      item.quantity,
      item.availableQuantity,
      item.location || '',
      item.condition,
      new Date(item.updatedAt).toISOString()
    ]);
    
    // Update sheet
    await sheetsService.updateSheet(spreadsheetId, 'Inventory', [headers, ...rows]);
    
    // Read back from sheet for bidirectional sync
    const sheetData = await sheetsService.getSheetData(spreadsheetId, 'Inventory!A2:H');
    
    // Update local database with any changes from sheets
    for (const row of sheetData) {
      if (row[0]) { // If ID exists
        const updates: any = {
          quantity: parseInt(row[3]) || 0,
          availableQuantity: parseInt(row[4]) || 0,
          location: row[5],
          condition: row[6]
        };
        
        await storage.updateToolInventory(row[0], updates);
      }
    }
    
    console.log(`[Google Sync] Synced ${inventory.length} inventory items with Google Sheets`);
  }

  async syncEmployeesWithSheets() {
    const sheetsService = googleServicesManager.getSheetsService();
    
    // Get or create employees spreadsheet
    let spreadsheetId = await this.getOrCreateSpreadsheet('ROOF-ER Employee Directory');
    
    // Get all employees from database
    const employees = await storage.getAllUsers();
    
    // Prepare data for sheets
    const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Department', 'Position', 'Role', 'Employment Type', 'Status', 'Shirt Size'];
    const rows = employees.map(emp => [
      emp.id,
      emp.email,
      emp.firstName,
      emp.lastName,
      emp.department || '',
      emp.position || '',
      emp.role,
      emp.employmentType || '',
      emp.isActive ? 'Active' : 'Inactive',
      emp.shirtSize || ''
    ]);
    
    // Update sheet
    await sheetsService.updateSheet(spreadsheetId, 'Employees', [headers, ...rows]);
    
    // Read back for bidirectional sync
    const sheetData = await sheetsService.getSheetData(spreadsheetId, 'Employees!A2:J');
    
    // Update local database with changes
    for (const row of sheetData) {
      if (row[0] && row[1]) { // If ID and email exist
        const updates: any = {
          department: row[4],
          position: row[5],
          shirtSize: row[9]
        };
        
        // Only update if there are actual changes
        const existingUser = employees.find(e => e.id === row[0]);
        if (existingUser) {
          const hasChanges = Object.keys(updates).some(key => 
            updates[key] !== existingUser[key as keyof typeof existingUser]
          );
          
          if (hasChanges) {
            await storage.updateUser(row[0], updates);
          }
        }
      }
    }
    
    console.log(`[Google Sync] Synced ${employees.length} employees with Google Sheets`);
  }

  async syncPTOWithCalendar() {
    const calendarService = googleServicesManager.getCalendarService();
    
    // Get or create PTO calendar
    let calendarId = await this.getOrCreateCalendar('ROOF-ER PTO Calendar');
    
    // Get all approved PTO requests
    const ptoRequests = await storage.getAllPtoRequests();
    const approvedRequests = ptoRequests.filter(req => req.status === 'APPROVED');
    
    for (const request of approvedRequests) {
      const employee = await storage.getUserById(request.employeeId);
      if (!employee) continue;
      
      const eventId = `pto-${request.id}`;
      
      // Check if event already exists
      try {
        await calendarService.getEvent(calendarId, eventId);
        // Event exists, update it
        await calendarService.updateEventWithId(calendarId, eventId, {
          summary: `${employee.firstName} ${employee.lastName} - Leave`,
          description: request.reason || 'PTO Request',
          start: { date: request.startDate },
          end: { date: request.endDate },
        });
      } catch (error) {
        // Event doesn't exist, create it
        await calendarService.createEventWithId(calendarId, {
          id: eventId,
          summary: `${employee.firstName} ${employee.lastName} - Leave`,
          description: request.reason || 'PTO Request',
          start: { date: request.startDate },
          end: { date: request.endDate },
        });
      }
    }
    
    console.log(`[Google Sync] Synced ${approvedRequests.length} PTO requests with Google Calendar`);
  }

  async syncInterviewsWithCalendar() {
    const calendarService = googleServicesManager.getCalendarService();
    
    // Get or create interviews calendar
    let calendarId = await this.getOrCreateCalendar('ROOF-ER Interview Schedule');
    
    // Get all scheduled interviews
    const interviews = await storage.getAllInterviews();
    const scheduledInterviews = interviews.filter(int => int.status === 'SCHEDULED');
    
    for (const interview of scheduledInterviews) {
      const candidate = await storage.getCandidateById(interview.candidateId);
      if (!candidate) continue;
      
      const eventId = `interview-${interview.id}`;
      
      // Prepare event data
      const eventData = {
        summary: `Interview: ${candidate.firstName} ${candidate.lastName} - ${candidate.position}`,
        description: `Interview Type: ${interview.type}\nNotes: ${interview.notes || 'N/A'}`,
        start: { dateTime: interview.scheduledDate.toISOString() },
        end: { dateTime: new Date(interview.scheduledDate.getTime() + 60 * 60 * 1000).toISOString() },
        attendees: interview.interviewerId ?
          await this.getAttendeeEmails([interview.interviewerId]) : []
      };

      try {
        await calendarService.getEvent(calendarId, eventId);
        // Update existing event
        await calendarService.updateEventWithId(calendarId, eventId, eventData);
      } catch (error) {
        // Create new event
        await calendarService.createEventWithId(calendarId, {
          id: eventId,
          ...eventData
        });
      }
    }
    
    console.log(`[Google Sync] Synced ${scheduledInterviews.length} interviews with Google Calendar`);
  }

  async syncCOIDocuments() {
    const driveService = googleServicesManager.getDriveService();
    
    // Get COI folder
    const coiFolders = await driveService.searchFolders('COI Documents', this.hrFolderId || undefined);
    if (!coiFolders || coiFolders.length === 0) return;

    const coiFolderId = coiFolders[0].id;
    
    // List all COI documents
    const files = await driveService.listFiles({
      q: `'${coiFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, modifiedTime, description)',
    });
    
    // Get all COI documents from database
    const coiDocs = await storage.getAllCOIDocuments();
    
    // Sync files with database
    for (const file of files) {
      // Parse COI info from filename or description
      const employeeMatch = file.name.match(/(.+?)[-_]/);
      if (employeeMatch) {
        const employeeName = employeeMatch[1].trim();
        
        // Find or create COI document record
        const existingDoc = coiDocs.find(doc => 
          doc.googleDriveFileId === file.id
        );
        
        if (!existingDoc) {
          // Create new COI document record
          const employee = await storage.getUserByName(employeeName);
          if (employee) {
            await storage.createCOIDocument({
              employeeId: employee.id,
              type: file.name.includes('WC') ? 'WORKERS_COMP' : 'GENERAL_LIABILITY',
              googleDriveFileId: file.id,
              fileName: file.name,
              uploadedAt: new Date(file.modifiedTime),
              status: 'ACTIVE'
            });
          }
        }
      }
    }
    
    // Check for expired COI documents
    const now = new Date();
    for (const doc of coiDocs) {
      if (doc.expirationDate && new Date(doc.expirationDate) < now) {
        // Send expiration alert
        await this.sendCOIExpirationAlert(doc);
      }
    }
    
    console.log(`[Google Sync] Synced ${files.length} COI documents`);
  }

  private async getOrCreateSpreadsheet(name: string): Promise<string> {
    const sheetsService = googleServicesManager.getSheetsService();
    const driveService = googleServicesManager.getDriveService();
    
    // Search for existing spreadsheet
    const files = await driveService.searchFiles(name, 'application/vnd.google-apps.spreadsheet');
    
    if (files && files.length > 0) {
      return files[0].id;
    }
    
    // Create new spreadsheet
    const spreadsheet = await sheetsService.createSpreadsheet(name);
    
    // Move to HR folder
    if (this.hrFolderId) {
      await driveService.moveFile(spreadsheet.spreadsheetId!, this.hrFolderId);
    }
    
    return spreadsheet.spreadsheetId!;
  }

  private async getOrCreateCalendar(name: string): Promise<string> {
    const calendarService = googleServicesManager.getCalendarService();
    
    // List all calendars
    const calendars = await calendarService.listCalendars();

    // Find existing calendar
    const existing = calendars.find((cal: any) => cal.summary === name);
    if (existing) {
      return existing.id;
    }
    
    // Create new calendar
    const calendar = await calendarService.createCalendar({
      summary: name,
      description: `Automated calendar for ${name}`,
      timeZone: 'America/New_York'
    });
    
    return calendar.id;
  }

  private async getAttendeeEmails(userIds: string[]): Promise<any[]> {
    const attendees = [];
    for (const userId of userIds) {
      const user = await storage.getUserById(userId);
      if (user && user.email) {
        attendees.push({ email: user.email });
      }
    }
    return attendees;
  }

  private async updateLocalFileRecord(file: any) {
    // Update or create file record in database
    // This would be implemented based on your file tracking needs
  }

  private async sendCOIExpirationAlert(doc: any) {
    const employee = await storage.getUserById(doc.employeeId);
    if (!employee) return;
    
    // Send email alert
    const gmailService = googleServicesManager.getGmailService();
    
    // Get managers and HR
    const managers = await storage.getUsersByRole('MANAGER');
    const admins = await storage.getUsersByRole('ADMIN');
    
    const recipients = [...managers, ...admins].map(u => u.email).filter(Boolean);
    
    if (recipients.length > 0) {
      await gmailService.sendEmail({
        to: recipients.join(','),
        subject: `COI Document Expiring - ${employee.firstName} ${employee.lastName}`,
        text: `
          The COI document for ${employee.firstName} ${employee.lastName} has expired or is expiring soon.

          Document Type: ${doc.type}
          Employee: ${employee.firstName} ${employee.lastName}
          Expiration Date: ${doc.expirationDate}

          Please ensure the employee provides updated documentation.
        `
      });
    }
  }

  getSyncStatus(): SyncStatus[] {
    return Array.from(this.syncStatus.values());
  }

  async forceSyncAll() {
    console.log('[Google Sync] Forcing sync of all services...');
    for (const name of Array.from(this.syncConfigs.keys())) {
      await this.executeSyncTask(name);
    }
  }

  async forceSyncService(service: string) {
    if (this.syncConfigs.has(service)) {
      await this.executeSyncTask(service);
    }
  }

  stopAllSyncTasks() {
    for (const [name, task] of Array.from(this.syncTasks.entries())) {
      task.stop();
      console.log(`[Google Sync] Stopped sync task: ${name}`);
    }
    this.syncTasks.clear();
  }
}

export const googleSyncOrchestrator = new GoogleSyncOrchestrator();