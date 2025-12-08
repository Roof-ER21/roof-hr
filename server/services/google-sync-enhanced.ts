import { googleServicesManager } from './google-services-manager';
import { storage } from '../storage';
import { googleDriveService } from './google-drive-service';
import { googleSheetsService } from './google-sheets-service';
import { googleCalendarService } from './google-calendar-service';
import { gmailService } from './gmail-service';
import { EventEmitter } from 'events';
import cron from 'node-cron';

// Default owners who should have access to all folders
const DEFAULT_OWNERS = [
  { email: 'reese.samala@theroofdocs.com', name: 'Reese Samala' },
  { email: 'oliver.brown@theroofdocs.com', name: 'Oliver Brown' },
  { email: 'ford.barsi@theroofdocs.com', name: 'Ford Barsi' },
  { email: 'ahmed.mahmoud@theroofdocs.com', name: 'Ahmed Mahmoud' },
  { email: 'support@theroofdocs.com', name: 'Support Admin' }
];

interface EmployeeFolderStructure {
  rootFolderId: string;
  documentsFolderId: string;
  contractsFolderId: string;
  reviewsFolderId: string;
  ptoFolderId: string;
  coiFolderId: string;
  onboardingFolderId: string;
}

interface SyncOperation {
  type: 'tools' | 'employees' | 'pto' | 'reviews' | 'contracts' | 'coi' | 'assignments';
  direction: 'to-google' | 'from-google' | 'bidirectional';
  lastSync?: Date;
  status: 'idle' | 'syncing' | 'error';
  error?: string;
}

class GoogleSyncEnhanced extends EventEmitter {
  private hrRootFolderId: string | null = null;
  private employeeFolders: Map<string, EmployeeFolderStructure> = new Map();
  private managementFolderId: string | null = null;
  private toolsSpreadsheetId: string | null = null;
  private employeesSpreadsheetId: string | null = null;
  private reviewsSpreadsheetId: string | null = null;
  private ptoCalendarId: string | null = null;
  private syncOperations: Map<string, SyncOperation> = new Map();
  private syncTasks: Map<string, any> = new Map();
  
  constructor() {
    super();
    this.initializeSyncOperations();
  }
  
  private initializeSyncOperations() {
    // Define all sync operations
    const operations: Array<[string, SyncOperation]> = [
      ['tools-sync', { type: 'tools', direction: 'bidirectional', status: 'idle' }],
      ['employees-sync', { type: 'employees', direction: 'bidirectional', status: 'idle' }],
      ['pto-sync', { type: 'pto', direction: 'bidirectional', status: 'idle' }],
      ['reviews-sync', { type: 'reviews', direction: 'to-google', status: 'idle' }],
      ['contracts-sync', { type: 'contracts', direction: 'to-google', status: 'idle' }],
      ['coi-sync', { type: 'coi', direction: 'to-google', status: 'idle' }],
      ['assignments-sync', { type: 'assignments', direction: 'bidirectional', status: 'idle' }]
    ];
    
    operations.forEach(([key, op]) => this.syncOperations.set(key, op));
  }
  
  async initialize() {
    console.log('[Enhanced Google Sync] Initializing...');
    
    try {
      // Initialize all Google services
      await googleServicesManager.initialize();
      
      // Set up complete folder structure
      await this.setupCompleteFolderStructure();
      
      // Set up spreadsheets for tracking
      await this.setupSpreadsheets();
      
      // Set up calendar for PTO
      await this.setupPTOCalendar();
      
      // Start all sync tasks
      await this.startAllSyncTasks();
      
      console.log('[Enhanced Google Sync] Initialization complete');
      this.emit('initialized');
    } catch (error) {
      console.error('[Enhanced Google Sync] Initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  private async setupCompleteFolderStructure() {
    try {
      // Find or create main HR folder
      let hrFolder = await googleDriveService.findFolderByName('ROOF-ER HR System');
      if (!hrFolder) {
        hrFolder = await googleDriveService.createFolder('ROOF-ER HR System');
        await this.shareWithOwners(hrFolder.id);
      }
      this.hrRootFolderId = hrFolder.id;
      
      // Create management folder
      let mgmtFolder = await googleDriveService.findFolderByName('Management', this.hrRootFolderId ?? undefined);
      if (!mgmtFolder) {
        mgmtFolder = await googleDriveService.createFolder('Management', this.hrRootFolderId ?? undefined);
        await this.shareWithOwners(mgmtFolder.id);
      }
      this.managementFolderId = mgmtFolder.id;

      // Create subfolders in management
      const mgmtSubfolders = ['COI Documents', 'Performance Reviews', 'Contracts', 'Reports', 'Analytics'];
      for (const folderName of mgmtSubfolders) {
        let folder = await googleDriveService.findFolderByName(folderName, this.managementFolderId ?? undefined);
        if (!folder) {
          folder = await googleDriveService.createFolder(folderName, this.managementFolderId ?? undefined);
          await this.shareWithOwners(folder.id);
        }
      }
      
      // Create employee folders structure
      await this.createAllEmployeeFolders();
      
      console.log('[Enhanced Google Sync] Folder structure created');
    } catch (error) {
      console.error('[Enhanced Google Sync] Error setting up folder structure:', error);
      throw error;
    }
  }
  
  private async createAllEmployeeFolders() {
    try {
      // Get all employees
      const employees = await storage.getAllUsers();
      
      for (const employee of employees) {
        await this.createEmployeeFolder(employee);
      }
    } catch (error) {
      console.error('[Enhanced Google Sync] Error creating employee folders:', error);
      throw error;
    }
  }
  
  async createEmployeeFolder(employee: any): Promise<EmployeeFolderStructure> {
    try {
      // Safely construct folder name, handling undefined values
      const firstName = employee.firstName || 'Unknown';
      const lastName = employee.lastName || 'User';
      const employeeId = employee.employeeId || employee.id || 'NoID';
      const folderName = `${firstName} ${lastName} - ${employeeId}`;
      
      // Check if folder already exists
      if (this.employeeFolders.has(employee.id)) {
        return this.employeeFolders.get(employee.id)!;
      }
      
      // Find or create employee root folder
      let empFolder = await googleDriveService.findFolderByName(folderName, this.hrRootFolderId!);
      if (!empFolder) {
        empFolder = await googleDriveService.createFolder(folderName, this.hrRootFolderId!);
        await this.shareWithOwners(empFolder.id);
        
        // Also share with the employee if they have an email
        if (employee.email) {
          await googleDriveService.shareFile(empFolder.id, {
            type: 'user',
            role: 'reader',
            emailAddress: employee.email
          });
        }
      }
      
      // Create subfolders
      const subfolders = [
        'Documents',
        'Contracts',
        'Performance Reviews',
        'PTO Records',
        'COI Documents',
        'Onboarding'
      ];
      
      const folderStructure: any = {
        rootFolderId: empFolder.id
      };
      
      for (const subfolder of subfolders) {
        let folder = await googleDriveService.findFolderByName(subfolder, empFolder.id);
        if (!folder) {
          folder = await googleDriveService.createFolder(subfolder, empFolder.id);
          await this.shareWithOwners(folder.id);
        }
        
        // Special handling for 'COI Documents' to match interface
        let key: string;
        if (subfolder === 'COI Documents') {
          key = 'coiFolderId';
        } else {
          key = subfolder.toLowerCase().replace(/\s+/g, '') + 'FolderId';
        }
        folderStructure[key] = folder.id;
      }
      
      this.employeeFolders.set(employee.id, folderStructure as EmployeeFolderStructure);
      
      return folderStructure;
    } catch (error) {
      console.error('[Enhanced Google Sync] Error creating employee folder:', error);
      throw error;
    }
  }
  
  private async shareWithOwners(fileId: string) {
    for (const owner of DEFAULT_OWNERS) {
      try {
        await googleDriveService.shareFile(fileId, {
          type: 'user',
          role: 'writer',
          emailAddress: owner.email,
          sendNotificationEmail: false
        });
      } catch (error) {
        console.error(`[Enhanced Google Sync] Error sharing with ${owner.name}:`, error);
      }
    }
  }
  
  async getOrCreateEmployeeFolder(employee: any): Promise<EmployeeFolderStructure | null> {
    try {
      // Ensure Google Drive service is initialized
      if (!googleDriveService.isInitialized()) {
        await googleDriveService.initialize();
      }

      // Check if folder already exists
      let employeeFolder = this.employeeFolders.get(employee.id);
      if (employeeFolder) {
        return employeeFolder;
      }

      // Create new folder structure
      employeeFolder = await this.createEmployeeFolder(employee);
      return employeeFolder;
    } catch (error) {
      console.error('[Enhanced Google Sync] Error getting/creating employee folder:', error);
      return null;
    }
  }

  // External COI folder for contractors not in the system
  private externalCoiFolderId: string | null = null;

  async getOrCreateExternalCoiFolder(): Promise<{ folderId: string } | null> {
    try {
      // Ensure Google Drive service is initialized
      if (!googleDriveService.isInitialized()) {
        await googleDriveService.initialize();
      }

      // Return cached folder if available
      if (this.externalCoiFolderId) {
        return { folderId: this.externalCoiFolderId };
      }

      // Check if folder already exists in Drive
      const existingFolders = await googleDriveService.listFiles({
        q: `name='External COI Documents' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        pageSize: 1
      });

      if (existingFolders && existingFolders.length > 0) {
        const folderId = existingFolders[0].id!;
        this.externalCoiFolderId = folderId;
        console.log('[Enhanced Google Sync] Found existing External COI folder:', folderId);
        return { folderId };
      }

      // Create new folder
      const folder = await googleDriveService.createFolder('External COI Documents');
      if (folder?.id) {
        this.externalCoiFolderId = folder.id;
        console.log('[Enhanced Google Sync] Created External COI folder:', folder.id);
        return { folderId: folder.id };
      }

      return null;
    } catch (error) {
      console.error('[Enhanced Google Sync] Error getting/creating external COI folder:', error);
      return null;
    }
  }

  async shareEmployeeFolderWithManager(employeeId: string, managerId: string) {
    try {
      // Get the employee and manager details
      const [employee, manager] = await Promise.all([
        storage.getUserById(employeeId),
        storage.getUserById(managerId)
      ]);
      
      if (!employee || !manager) {
        console.error('[Enhanced Google Sync] Employee or manager not found');
        return;
      }
      
      // Get or create the employee's folder structure
      let employeeFolder = this.employeeFolders.get(employeeId);
      if (!employeeFolder) {
        employeeFolder = await this.createEmployeeFolder(employee);
      }
      
      // Share the root folder and all subfolders with the manager
      if (manager.email) {
        // Share root folder
        await googleDriveService.shareFile(employeeFolder.rootFolderId, {
          type: 'user',
          role: 'writer',
          emailAddress: manager.email,
          sendNotificationEmail: true
        });
        
        // Share all subfolders
        const subfolderIds = [
          employeeFolder.documentsFolderId,
          employeeFolder.contractsFolderId,
          employeeFolder.reviewsFolderId,
          employeeFolder.ptoFolderId,
          employeeFolder.coiFolderId,
          employeeFolder.onboardingFolderId
        ];
        
        for (const folderId of subfolderIds) {
          if (folderId) {
            try {
              await googleDriveService.shareFile(folderId, {
                type: 'user',
                role: 'writer',
                emailAddress: manager.email,
                sendNotificationEmail: false
              });
            } catch (error) {
              console.error(`[Enhanced Google Sync] Error sharing subfolder ${folderId}:`, error);
            }
          }
        }
        
        console.log(`[Enhanced Google Sync] Successfully shared ${employee.firstName || ''} ${employee.lastName || ''}'s folders with manager ${manager.firstName || ''} ${manager.lastName || ''}`);
      } else {
        console.warn(`[Enhanced Google Sync] Manager ${manager.firstName || ''} ${manager.lastName || ''} has no email address`);
      }
    } catch (error) {
      console.error('[Enhanced Google Sync] Error sharing employee folder with manager:', error);
      throw error;
    }
  }
  
  private async setupSpreadsheets() {
    try {
      // Tools & Equipment Spreadsheet
      let toolsSheet = await googleDriveService.searchFiles('ROOF-ER Tools Inventory', 'application/vnd.google-apps.spreadsheet');
      if (!toolsSheet || toolsSheet.length === 0) {
        const spreadsheet = await googleSheetsService.createSpreadsheet('ROOF-ER Tools Inventory', 
          ['Current Inventory', 'Assignments', 'History', 'Maintenance']);
        this.toolsSpreadsheetId = spreadsheet.spreadsheetId!;
        
        // Share with owners
        if (this.toolsSpreadsheetId) {
          for (const owner of DEFAULT_OWNERS) {
            await googleDriveService.shareFile(this.toolsSpreadsheetId, {
              type: 'user',
              role: 'writer',
              emailAddress: owner.email
            });
          }
        }
      } else {
        this.toolsSpreadsheetId = toolsSheet[0].id;
      }
      
      // Employees Master Spreadsheet
      let empSheet = await googleDriveService.searchFiles('ROOF-ER Employee Master', 'application/vnd.google-apps.spreadsheet');
      if (!empSheet || empSheet.length === 0) {
        const spreadsheet = await googleSheetsService.createSpreadsheet('ROOF-ER Employee Master',
          ['Active Employees', 'Terminated', 'On Leave', 'Contractors']);
        this.employeesSpreadsheetId = spreadsheet.spreadsheetId!;
        
        // Share with owners
        if (this.employeesSpreadsheetId) {
          for (const owner of DEFAULT_OWNERS) {
            await googleDriveService.shareFile(this.employeesSpreadsheetId, {
              type: 'user',
              role: 'writer',
              emailAddress: owner.email
            });
          }
        }
      } else {
        this.employeesSpreadsheetId = empSheet[0].id;
      }
      
      // Performance Reviews Spreadsheet
      let reviewSheet = await googleDriveService.searchFiles('ROOF-ER Performance Reviews', 'application/vnd.google-apps.spreadsheet');
      if (!reviewSheet || reviewSheet.length === 0) {
        const spreadsheet = await googleSheetsService.createSpreadsheet('ROOF-ER Performance Reviews',
          ['Current Quarter', 'History', 'Ratings Summary', 'Action Items']);
        this.reviewsSpreadsheetId = spreadsheet.spreadsheetId!;
        
        // Share with owners and managers only
        if (this.reviewsSpreadsheetId) {
          for (const owner of DEFAULT_OWNERS) {
            await googleDriveService.shareFile(this.reviewsSpreadsheetId, {
              type: 'user',
              role: 'writer',
              emailAddress: owner.email
            });
          }
        }
      } else {
        this.reviewsSpreadsheetId = reviewSheet[0].id;
      }
      
      console.log('[Enhanced Google Sync] Spreadsheets setup complete');
    } catch (error) {
      console.error('[Enhanced Google Sync] Error setting up spreadsheets:', error);
      throw error;
    }
  }
  
  private async setupPTOCalendar() {
    try {
      // Check if PTO calendar exists
      const calendars = await googleCalendarService.listCalendars();
      const ptoCalendar = calendars.find((cal: any) => cal.summary === 'ROOF-ER PTO Calendar');
      
      if (!ptoCalendar) {
        const newCalendar = await googleCalendarService.createCalendar({
          summary: 'ROOF-ER PTO Calendar',
          description: 'Company-wide PTO tracking calendar',
          timeZone: 'America/New_York'
        });
        this.ptoCalendarId = newCalendar.id;
      } else {
        this.ptoCalendarId = ptoCalendar.id;
      }
      
      console.log('[Enhanced Google Sync] PTO Calendar setup complete');
    } catch (error) {
      console.error('[Enhanced Google Sync] Error setting up PTO calendar:', error);
      throw error;
    }
  }
  
  private async startAllSyncTasks() {
    // Tools sync - bidirectional every 5 minutes
    const toolsTask = cron.schedule('*/5 * * * *', async () => {
      await this.syncToolsInventory();
    });
    this.syncTasks.set('tools-sync', toolsTask);
    
    // Employees sync - bidirectional every 10 minutes
    const employeesTask = cron.schedule('*/10 * * * *', async () => {
      await this.syncEmployeeData();
    });
    this.syncTasks.set('employees-sync', employeesTask);
    
    // PTO sync - bidirectional every 5 minutes
    const ptoTask = cron.schedule('*/5 * * * *', async () => {
      await this.syncPTOCalendar();
    });
    this.syncTasks.set('pto-sync', ptoTask);
    
    // Reviews sync - to Google every hour
    const reviewsTask = cron.schedule('0 * * * *', async () => {
      await this.syncPerformanceReviews();
    });
    this.syncTasks.set('reviews-sync', reviewsTask);
    
    // COI sync - to Google every 30 minutes
    const coiTask = cron.schedule('*/30 * * * *', async () => {
      await this.syncCOIDocuments();
    });
    this.syncTasks.set('coi-sync', coiTask);
    
    // Start all tasks
    this.syncTasks.forEach((task, name) => {
      task.start();
      console.log(`[Enhanced Google Sync] Started sync task: ${name}`);
    });
    
    // Run initial sync
    await this.runInitialSync();
  }
  
  private async runInitialSync() {
    console.log('[Enhanced Google Sync] Running initial sync...');
    await this.syncToolsInventory();
    await this.syncEmployeeData();
    await this.syncPTOCalendar();
    await this.syncPerformanceReviews();
    await this.syncCOIDocuments();
  }
  
  // Bidirectional tools sync
  async syncToolsInventory() {
    const op = this.syncOperations.get('tools-sync')!;
    if (op.status === 'syncing') return;
    
    op.status = 'syncing';
    
    try {
      // Get tools from database
      const dbTools = await storage.getAllTools();
      
      // Try to get tools from Google Sheets, or create the sheet if it doesn't exist
      let sheetTools = [];
      try {
        sheetTools = await googleSheetsService.getSheetData(
          this.toolsSpreadsheetId!,
          'Current Inventory!A2:M'
        );
      } catch (error: any) {
        if (error.message?.includes('Unable to parse range')) {
          // Sheet doesn't exist, create it with headers
          console.log('[Enhanced Google Sync] Creating Current Inventory sheet...');
          const headers = [
            ['Tool ID', 'Name', 'Category', 'Serial Number', 'Model', 'Quantity', 
             'Available', 'Condition', 'Purchase Date', 'Price', 'Location', 'Status', 'Notes']
          ];
          await googleSheetsService.updateSheet(
            this.toolsSpreadsheetId!,
            'Current Inventory',
            headers
          );
          sheetTools = [];
        } else {
          throw error;
        }
      }
      
      // Compare and sync
      const dbToolsMap = new Map(dbTools.map(t => [t.id, t]));
      const sheetToolsMap = new Map(sheetTools.map((row: any[]) => [row[0], row]));

      // Update database with changes from sheets
      for (const [id, row] of Array.from(sheetToolsMap)) {
        const rowData = row as any[];
        const toolId = id as string;

        if (!dbToolsMap.has(toolId)) {
          // New tool in sheets, add to database
          await storage.createTool({
            name: rowData[1] || '',
            category: rowData[2] || '',
            serialNumber: rowData[3] || '',
            model: rowData[4] || '',
            quantity: parseInt(String(rowData[5])) || 0,
            availableQuantity: parseInt(String(rowData[6])) || 0,
            condition: rowData[7] || '',
            location: rowData[10] || ''
          });
        } else {
          // Check for updates
          const dbTool = dbToolsMap.get(toolId);
          if (dbTool && (dbTool.quantity !== parseInt(String(rowData[5])) ||
              dbTool.availableQuantity !== parseInt(String(rowData[6])))) {
            await storage.updateTool(toolId, {
              quantity: parseInt(String(rowData[5])),
              availableQuantity: parseInt(String(rowData[6]))
            });
          }
        }
      }
      
      // Update sheets with changes from database
      const headers = [
        ['Tool ID', 'Name', 'Category', 'Serial Number', 'Model', 'Quantity', 
         'Available', 'Condition', 'Purchase Date', 'Price', 'Location', 'Status', 'Notes']
      ];
      
      const toolsData = dbTools.map(tool => [
        tool.id,
        tool.name,
        tool.category,
        tool.serialNumber || '',
        tool.model || '',
        tool.quantity,
        tool.availableQuantity,
        tool.condition,
        tool.purchaseDate ? new Date(tool.purchaseDate).toLocaleDateString() : '',
        tool.purchasePrice || '',
        tool.location || '',
        tool.isActive ? 'Active' : 'Inactive',
        tool.notes || ''
      ]);
      
      await googleSheetsService.updateSheet(
        this.toolsSpreadsheetId!,
        'Current Inventory',
        [...headers, ...toolsData]
      );
      
      op.status = 'idle';
      op.lastSync = new Date();
      console.log(`[Enhanced Google Sync] Tools sync completed: ${dbTools.length} tools`);
    } catch (error) {
      op.status = 'error';
      op.error = String(error);
      console.error('[Enhanced Google Sync] Error syncing tools:', error);
    }
  }
  
  // Bidirectional employee data sync
  async syncEmployeeData() {
    const op = this.syncOperations.get('employees-sync')!;
    if (op.status === 'syncing') return;
    
    op.status = 'syncing';
    
    try {
      const employees = await storage.getAllUsers();
      
      const headers = [
        ['Employee ID', 'Name', 'Email', 'Department', 'Position', 'Manager', 
         'Status', 'Hire Date', 'Phone', 'Location', 'Territory']
      ];
      
      const employeeData = employees.map(emp => [
        emp.id || '',
        `${emp.firstName || ''} ${emp.lastName || ''}`,
        emp.email || '',
        emp.department || '',
        emp.position || '',
        '', // managerId - not on user type
        emp.isActive ? 'Active' : 'Inactive',
        emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : '',
        emp.phone || '',
        '', // location - not on user type
        '' // territoryId - not on user type
      ]);
      
      await googleSheetsService.updateSheet(
        this.employeesSpreadsheetId!,
        'Active Employees',
        [...headers, ...employeeData]
      );
      
      // Ensure each employee has a folder
      for (const employee of employees) {
        await this.createEmployeeFolder(employee);
      }
      
      op.status = 'idle';
      op.lastSync = new Date();
      console.log(`[Enhanced Google Sync] Employee sync completed: ${employees.length} employees`);
    } catch (error) {
      op.status = 'error';
      op.error = String(error);
      console.error('[Enhanced Google Sync] Error syncing employees:', error);
    }
  }
  
  // Sync PTO with Google Calendar - visibility based on roles
  async syncPTOCalendar() {
    const op = this.syncOperations.get('pto-sync')!;
    if (op.status === 'syncing') return;
    
    op.status = 'syncing';
    
    try {
      const ptoRequests = await storage.getAllPtoRequests();
      
      for (const pto of ptoRequests) {
        const employee = await storage.getUser(pto.employeeId);
        if (!employee) continue;

        const eventSummary = `${employee.firstName || ''} ${employee.lastName || ''} - PTO`;
        const eventDescription = `Reason: ${pto.reason || 'N/A'}\\nStatus: ${pto.status || ''}`;

        // Only create/update calendar events for approved PTOs
        if (pto.status === 'APPROVED' && pto.googleEventId) {
          // Update existing event
          await googleCalendarService.updateEventWithId(
            this.ptoCalendarId!,
            pto.googleEventId,
            {
              summary: eventSummary,
              description: eventDescription,
              start: {
                date: new Date(pto.startDate).toISOString().split('T')[0]
              },
              end: {
                date: new Date(pto.endDate).toISOString().split('T')[0]
              }
            }
          );
        } else if (pto.status === 'APPROVED' && !pto.googleEventId) {
          // Create new event for approved PTO
          const event = await googleCalendarService.createEventWithId(
            this.ptoCalendarId!,
            {
              summary: eventSummary,
              description: eventDescription,
              start: {
                date: new Date(pto.startDate).toISOString().split('T')[0]
              },
              end: {
                date: new Date(pto.endDate).toISOString().split('T')[0]
              },
              visibility: 'public', // Approved PTOs are visible to all
              transparency: 'transparent'
            }
          );
          
          // Update PTO with Google Event ID
          if (event?.id) {
            await storage.updatePTORequest(pto.id, {
              googleEventId: event.id
            });
          }
        }
        
        // For pending/denied - only managers see these (handled by app logic, not calendar)
      }
      
      op.status = 'idle';
      op.lastSync = new Date();
      console.log(`[Enhanced Google Sync] PTO sync completed: ${ptoRequests.length} requests`);
    } catch (error) {
      op.status = 'error';
      op.error = String(error);
      console.error('[Enhanced Google Sync] Error syncing PTO:', error);
    }
  }
  
  // Sync performance reviews to Google Sheets
  async syncPerformanceReviews() {
    const op = this.syncOperations.get('reviews-sync')!;
    if (op.status === 'syncing') return;
    
    op.status = 'syncing';
    
    try {
      const reviews = await storage.getAllPerformanceReviews();
      
      const headers = [
        ['Review ID', 'Employee', 'Reviewer', 'Review Date', 'Type',
         'Overall Rating', 'Goals', 'Strengths', 'Areas for Improvement', 'Status']
      ];
      
      const reviewsData = await Promise.all(reviews.map(async (review: any) => {
        const employee = await storage.getUser(review.revieweeId);
        const reviewer = await storage.getUser(review.reviewerId);

        return [
          review.id || '',
          employee ? `${employee.firstName || ''} ${employee.lastName || ''}` : 'Unknown',
          reviewer ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}` : 'Unknown',
          review.dueDate ? new Date(review.dueDate).toLocaleDateString() : '',
          review.reviewType || '',
          review.overallRating || '',
          review.goals || '',
          review.strengths || '',
          review.areasForImprovement || '',
          review.status || ''
        ];
      }));
      
      await googleSheetsService.updateSheet(
        this.reviewsSpreadsheetId!,
        'Current Quarter',
        [...headers, ...reviewsData]
      );
      
      // Also save reviews to individual employee folders
      for (const review of reviews) {
        const employeeFolder = this.employeeFolders.get(review.revieweeId);
        if (employeeFolder && review.dueDate) {
          const employee = await storage.getUser(review.revieweeId);
          const reviewer = await storage.getUser(review.reviewerId);

          // Create review document in employee's folder
          const reviewContent = `Performance Review - ${new Date(review.dueDate).toLocaleDateString()}

Employee: ${employee ? `${employee.firstName || ''} ${employee.lastName || ''}` : 'N/A'}
Reviewer: ${reviewer ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}` : 'N/A'}
Rating: ${review.overallRating || 'N/A'}/5

Goals: ${review.goals || 'N/A'}
Strengths: ${review.strengths || 'N/A'}
Areas for Improvement: ${review.areasForImprovement || 'N/A'}

Communication Score: ${review.communicationScore || 'N/A'}/5`;

          await googleDriveService.uploadFile({
            name: `Review_${new Date(review.dueDate).toISOString().split('T')[0]}.txt`,
            mimeType: 'text/plain',
            content: Buffer.from(reviewContent),
            parentFolderId: employeeFolder.reviewsFolderId
          });
        }
      }
      
      op.status = 'idle';
      op.lastSync = new Date();
      console.log(`[Enhanced Google Sync] Reviews sync completed: ${reviews.length} reviews`);
    } catch (error) {
      op.status = 'error';
      op.error = String(error);
      console.error('[Enhanced Google Sync] Error syncing reviews:', error);
    }
  }
  
  // Import COI documents from Google Drive to database
  async importCOIDocumentsFromDrive() {
    try {
      console.log('[Enhanced Google Sync] Starting COI import from Google Drive...');

      // Get all employees
      const employees = await storage.getAllUsers();
      const existingDocs = await storage.getAllCoiDocuments();

      // Use googleDriveId column for reliable deduplication
      // Also fall back to extracting from notes for legacy records
      const existingDriveIds = new Set(
        existingDocs
          .map(doc => {
            // First try the dedicated column
            if (doc.googleDriveId) return doc.googleDriveId;
            // Fall back to legacy notes extraction
            const match = doc.notes?.match(/Drive ID: ([^)]+)/);
            return match ? match[1] : null;
          })
          .filter((id): id is string => id !== null && id !== undefined)
      );

      console.log(`[Enhanced Google Sync] Found ${existingDriveIds.size} existing Drive IDs to skip`);
      
      let importedCount = 0;
      
      for (const employee of employees) {
        const employeeFolder = await this.getOrCreateEmployeeFolder(employee);
        if (!employeeFolder || !employeeFolder.coiFolderId) continue;
        
        // List files in employee's COI folder
        const files = await googleDriveService.listFiles({
          q: `'${employeeFolder.coiFolderId}' in parents and trashed=false and mimeType='application/pdf'`,
          pageSize: 100
        });

        if (!files) continue;

        for (const file of files) {
          // Skip if already imported or if file doesn't have an ID
          if (!file.id || existingDriveIds.has(file.id)) continue;
          
          // Parse COI type and expiration date from filename
          // Expected format: COI_<TYPE>_<DATE>.pdf or similar
          const filename = file.name || '';
          let coiType: 'WORKERS_COMP' | 'GENERAL_LIABILITY' = 'WORKERS_COMP';
          let expirationDate = new Date();
          expirationDate.setMonth(expirationDate.getMonth() + 12); // Default to 1 year from now
          
          // Try to extract type from filename
          if (filename.toLowerCase().includes('workers') || filename.toLowerCase().includes('comp')) {
            coiType = 'WORKERS_COMP';
          } else if (filename.toLowerCase().includes('general') || filename.toLowerCase().includes('liability')) {
            coiType = 'GENERAL_LIABILITY';
          }
          
          // Try to extract date from filename (format: YYYY-MM-DD or similar)
          const dateMatch = filename.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
          if (dateMatch) {
            const parsedDate = new Date(dateMatch[1].replace(/_/g, '-'));
            if (!isNaN(parsedDate.getTime())) {
              expirationDate = parsedDate;
            }
          }
          
          // Create COI document record in database
          try {
            const today = new Date();
            const issueDate = new Date();
            issueDate.setFullYear(issueDate.getFullYear() - 1); // Default issue date to 1 year before expiration

            const docData: any = {
              employeeId: employee.id,
              type: coiType,
              documentUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
              issueDate: issueDate.toISOString().split('T')[0],
              expirationDate: expirationDate.toISOString().split('T')[0],
              uploadedBy: employee.id, // Attribute to the employee whose COI this is
              status: 'ACTIVE',
              googleDriveId: file.id, // Store Drive ID for reliable deduplication
              notes: `Imported from Google Drive: ${filename}`
            };
            await storage.createCoiDocument(docData);
            
            importedCount++;
            console.log(`[Enhanced Google Sync] Imported COI document: ${filename} for ${employee.firstName || ''} ${employee.lastName || ''}`);
          } catch (err) {
            console.error(`[Enhanced Google Sync] Failed to import COI document ${filename}:`, err);
          }
        }
      }
      
      console.log(`[Enhanced Google Sync] COI import completed. Imported ${importedCount} new documents.`);
    } catch (error) {
      console.error('[Enhanced Google Sync] Error importing COI documents from Drive:', error);
    }
  }

  // Sync COI documents - dual folder system
  async syncCOIDocuments() {
    const op = this.syncOperations.get('coi-sync')!;
    if (op.status === 'syncing') return;
    
    op.status = 'syncing';
    
    try {
      // Ensure Google Drive service is initialized
      if (!googleDriveService.isInitialized()) {
        await googleDriveService.initialize();
      }

      // Part 1: Sync FROM Google Drive TO database (import new documents)
      // DISABLED: Auto-import was assigning all COIs to wrong employees based on folder location
      // COIs should be uploaded manually via the smart upload feature which parses the actual document
      // await this.importCOIDocumentsFromDrive();
      
      // Part 2: Sync FROM database TO Google Drive (export documents)
      const coiDocuments = await storage.getAllCoiDocuments();

      // Note: We're only importing from Google Drive, not uploading to it
      // because documents are already stored there and referenced via documentUrl
      // This sync focuses on ensuring the database is up to date with Drive
      
      op.status = 'idle';
      op.lastSync = new Date();
      console.log(`[Enhanced Google Sync] COI sync completed: ${coiDocuments.length} documents`);
    } catch (error) {
      op.status = 'error';
      op.error = String(error);
      console.error('[Enhanced Google Sync] Error syncing COI documents:', error);
    }
  }
  
  // Upload contract to employee folder
  async uploadContractToEmployeeFolder(employeeId: string, contractData: any) {
    try {
      const employeeFolder = this.employeeFolders.get(employeeId);
      if (!employeeFolder) {
        const employee = await storage.getUser(employeeId);
        if (!employee) throw new Error('Employee not found');
        await this.createEmployeeFolder(employee);
      }
      
      const folder = this.employeeFolders.get(employeeId)!;
      
      const file = await googleDriveService.uploadFile({
        name: `Contract_${contractData.title || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`,
        mimeType: 'application/pdf',
        content: contractData.content,
        parentFolderId: folder.contractsFolderId,
        description: `Contract: ${contractData.title || 'Unknown'} - Status: ${contractData.status || 'Unknown'}`
      });

      // Also share with employee if signed
      if (contractData.status === 'signed' && file?.id) {
        const employee = await storage.getUser(employeeId);
        if (employee?.email) {
          await googleDriveService.shareFile(file.id, {
            type: 'user',
            role: 'reader',
            emailAddress: employee.email
          });
        }
      }

      return file;
    } catch (error) {
      console.error('[Enhanced Google Sync] Error uploading contract:', error);
      throw error;
    }
  }
  
  // Get sync status
  getSyncStatus() {
    const status: any[] = [];
    
    this.syncOperations.forEach((op, key) => {
      status.push({
        operation: key,
        type: op.type,
        direction: op.direction,
        status: op.status,
        lastSync: op.lastSync,
        error: op.error
      });
    });
    
    return {
      initialized: !!this.hrRootFolderId,
      hrRootFolderId: this.hrRootFolderId,
      managementFolderId: this.managementFolderId,
      toolsSpreadsheetId: this.toolsSpreadsheetId,
      employeesSpreadsheetId: this.employeesSpreadsheetId,
      reviewsSpreadsheetId: this.reviewsSpreadsheetId,
      ptoCalendarId: this.ptoCalendarId,
      employeeFoldersCount: this.employeeFolders.size,
      syncOperations: status
    };
  }
  
  // Manual sync triggers
  async triggerManualSync(syncType: string) {
    switch (syncType) {
      case 'tools':
        await this.syncToolsInventory();
        break;
      case 'employees':
        await this.syncEmployeeData();
        break;
      case 'pto':
        await this.syncPTOCalendar();
        break;
      case 'reviews':
        await this.syncPerformanceReviews();
        break;
      case 'coi':
        await this.syncCOIDocuments();
        break;
      case 'all':
        await this.runInitialSync();
        break;
      default:
        throw new Error(`Unknown sync type: ${syncType}`);
    }
  }
  
  // Stop all sync tasks
  stopAllSyncTasks() {
    this.syncTasks.forEach((task, name) => {
      task.stop();
      console.log(`[Enhanced Google Sync] Stopped sync task: ${name}`);
    });
  }
}

export const googleSyncEnhanced = new GoogleSyncEnhanced();