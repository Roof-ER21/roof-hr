import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { insertCoiDocumentSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { googleDriveService } from '../services/google-drive-service';
import { googleSyncEnhanced } from '../services/google-sync-enhanced';
import { parseCOIDocument, COIParsedData } from '../services/document-parser';
import { matchEmployeeFromName, MatchResult } from '../services/employee-matcher';

// Local storage path for COI documents when Google Drive is not configured
const COI_LOCAL_STORAGE_PATH = path.join(process.cwd(), 'uploads', 'coi');

// Ensure local storage directory exists
function ensureLocalStorageDir(): void {
  if (!fs.existsSync(COI_LOCAL_STORAGE_PATH)) {
    fs.mkdirSync(COI_LOCAL_STORAGE_PATH, { recursive: true });
    console.log('[COI] Created local storage directory:', COI_LOCAL_STORAGE_PATH);
  }
}

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDFs and images
    if (file.mimetype === 'application/pdf' || 
        file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

// Middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireHROrManager(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has access (super admin email fallback)
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  // HR, Managers, and Territory Managers can manage COI documents
  const allowedRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'  // Legacy
  ];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'HR or Manager access required' });
  }

  next();
}

// Helper function to auto-calculate COI expiration status based on current date
function calculateCoiStatus(expirationDate: string | null): 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' {
  if (!expirationDate) return 'ACTIVE';

  const expDate = new Date(expirationDate);
  const today = new Date();
  const daysUntilExpiration = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiration <= 0) {
    return 'EXPIRED';
  } else if (daysUntilExpiration <= 30) {
    return 'EXPIRING_SOON';
  }
  return 'ACTIVE';
}

// Add auto-calculated status to COI documents
function enrichCoiDocuments(documents: any[]) {
  return documents.map(doc => ({
    ...doc,
    // Override stored status with calculated status based on current date
    status: calculateCoiStatus(doc.expirationDate),
    // Add days until expiration for frontend use
    daysUntilExpiration: doc.expirationDate
      ? Math.floor((new Date(doc.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null
  }));
}

// Get all COI documents
router.get('/api/coi-documents', requireAuth, requireHROrManager, async (req, res) => {
  try {
    // Set no-cache headers to prevent browser caching stale data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const documents = await storage.getAllCoiDocuments();
    console.log(`[COI Documents] Returning ${documents.length} documents from database`);
    // Auto-calculate status based on current date
    res.json(enrichCoiDocuments(documents));
  } catch (error) {
    console.error('Error fetching COI documents:', error);
    res.status(500).json({ error: 'Failed to fetch COI documents' });
  }
});

// Get COI documents for specific employee
router.get('/api/coi-documents/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    // Users can view their own documents, HR/managers can view any
    if (user.id !== req.params.employeeId &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'TERRITORY_SALES_MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Can only view your own COI documents' });
    }

    const documents = await storage.getCoiDocumentsByEmployeeId(req.params.employeeId);
    // Auto-calculate status based on current date
    res.json(enrichCoiDocuments(documents));
  } catch (error) {
    console.error('Error fetching employee COI documents:', error);
    res.status(500).json({ error: 'Failed to fetch COI documents' });
  }
});

// Get expiring COI documents
router.get('/api/coi-documents/expiring/:days', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const days = parseInt(req.params.days);
    if (isNaN(days)) {
      return res.status(400).json({ error: 'Invalid days parameter' });
    }

    const documents = await storage.getExpiringCoiDocuments(days);
    // Auto-calculate status based on current date
    res.json(enrichCoiDocuments(documents));
  } catch (error) {
    console.error('Error fetching expiring COI documents:', error);
    res.status(500).json({ error: 'Failed to fetch expiring COI documents' });
  }
});

// Get COI document by ID
router.get('/api/coi-documents/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const document = await storage.getCoiDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'COI document not found' });
    }

    // Check access permissions
    if (document.employeeId !== user.id &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'TERRITORY_SALES_MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching COI document:', error);
    res.status(500).json({ error: 'Failed to fetch COI document' });
  }
});

// Create new COI document with file upload
router.post('/api/coi-documents/upload', requireAuth, requireHROrManager, upload.single('file'), async (req, res) => {
  try {
    const currentUser = req.user!;
    const { employeeId, type, issueDate, expirationDate, notes } = req.body;

    console.log('[COI Upload] Starting upload for employee:', employeeId, 'Type:', type);
    
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    
    console.log('[COI Upload] File received:', req.file.originalname, 'Size:', req.file.size);

    // Get employee details
    const employee = await storage.getUserById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log('[COI Upload] Employee found:', employee.firstName, employee.lastName);

    // Get or create employee folder structure
    const employeeFolders = await googleSyncEnhanced.getOrCreateEmployeeFolder(employee);
    if (!employeeFolders || !employeeFolders.coiFolderId) {
      console.error('[COI Upload] Failed to get employee folder structure:', employeeFolders);
      throw new Error('Failed to get employee COI folder');
    }
    
    console.log('[COI Upload] Employee folder structure obtained, COI folder ID:', employeeFolders.coiFolderId);

    // Upload file to Google Drive
    const fileName = `COI_${type}_${employee.lastName}_${Date.now()}.${req.file.originalname.split('.').pop()}`;
    console.log('[COI Upload] Uploading to Google Drive with filename:', fileName);
    
    const driveFile = await googleDriveService.uploadFile({
      name: fileName,
      mimeType: req.file.mimetype,
      content: req.file.buffer,
      parentFolderId: employeeFolders.coiFolderId,
      description: `COI Document - ${type} - Expires: ${expirationDate}`
    });
    
    console.log('[COI Upload] File uploaded to Google Drive successfully:', driveFile.id, 'Link:', driveFile.webViewLink);

    // Create database record with Google Drive info
    // Store the Google Drive view link as the document URL for easy access
    const data = insertCoiDocumentSchema.parse({
      employeeId,
      type,
      documentUrl: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
      issueDate,
      expirationDate,
      notes,
      uploadedBy: currentUser.id,
      status: 'ACTIVE'
    });

    console.log('[COI Upload] Creating database record with Google Drive link');

    // Check expiration date to set initial status
    const expDate = new Date(expirationDate);
    const today = new Date();
    const daysUntilExpiration = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';
    let alertFrequency: 'MONTH_BEFORE' | 'TWO_WEEKS' | 'ONE_WEEK' | 'DAILY' | null = null;

    if (daysUntilExpiration <= 0) {
      status = 'EXPIRED';
      alertFrequency = 'DAILY';
    } else if (daysUntilExpiration <= 6) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'DAILY';
    } else if (daysUntilExpiration <= 7) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'ONE_WEEK';
    } else if (daysUntilExpiration <= 14) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'TWO_WEEKS';
    } else if (daysUntilExpiration <= 30) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'MONTH_BEFORE';
    }

    const document = await storage.createCoiDocument({
      ...data,
      type: data.type as 'WORKERS_COMP' | 'GENERAL_LIABILITY',
      status,
      alertFrequency,
      googleDriveId: driveFile.id // Store Drive ID for deduplication
    });

    console.log('[COI Upload] COI document created successfully. ID:', document.id, 'Google Drive ID:', driveFile.id);

    // Emit real-time update for COI sync across all clients
    if (req.app.locals.io) {
      req.app.locals.io.emit('coi:updated', {
        action: 'created',
        documentId: document.id,
        uploadedBy: req.user?.email
      });
    }

    res.json({
      ...document,
      googleDriveUrl: driveFile.webViewLink // Include direct link for frontend
    });
  } catch (error: any) {
    console.error('[COI Upload] Error uploading COI document:', error);
    console.error('[COI Upload] Error stack:', error.stack);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid document data', details: error.errors });
    }
    
    // Provide more specific error messages
    if (error.message.includes('Google Drive')) {
      return res.status(500).json({ 
        error: 'Failed to upload file to Google Drive. Please check Google Drive integration.',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to upload COI document',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create new COI document (without file - for backward compatibility)
router.post('/api/coi-documents', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const user = req.user!;
    const data = insertCoiDocumentSchema.parse({
      ...req.body,
      uploadedBy: user.id,
      status: 'ACTIVE' // New documents start as active
    });

    // Check expiration date to set initial status
    const expirationDate = new Date(data.expirationDate);
    const today = new Date();
    const daysUntilExpiration = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';
    let alertFrequency: 'MONTH_BEFORE' | 'TWO_WEEKS' | 'ONE_WEEK' | 'DAILY' | null = null;

    if (daysUntilExpiration <= 0) {
      status = 'EXPIRED';
      alertFrequency = 'DAILY'; // Daily alerts after expiration
    } else if (daysUntilExpiration <= 6) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'DAILY'; // Daily alerts for 6 days before expiration
    } else if (daysUntilExpiration <= 7) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'ONE_WEEK'; // Alert at 1 week
    } else if (daysUntilExpiration <= 14) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'TWO_WEEKS'; // Alert at 2 weeks
    } else if (daysUntilExpiration <= 30) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'MONTH_BEFORE'; // Alert at 1 month
    }

    const document = await storage.createCoiDocument({
      ...data,
      type: data.type as 'WORKERS_COMP' | 'GENERAL_LIABILITY',
      status,
      alertFrequency
    });

    // Emit real-time update for COI sync across all clients
    if (req.app.locals.io) {
      req.app.locals.io.emit('coi:updated', {
        action: 'created',
        documentId: document.id,
        uploadedBy: req.user?.email
      });
    }

    res.json(document);
  } catch (error: any) {
    console.error('Error creating COI document:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid document data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create COI document' });
  }
});

// Update COI document
router.patch('/api/coi-documents/:id', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const document = await storage.getCoiDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'COI document not found' });
    }
    
    // Update status based on new expiration date if provided
    let updateData = { ...req.body };
    
    if (req.body.expirationDate) {
      const expirationDate = new Date(req.body.expirationDate);
      const today = new Date();
      const daysUntilExpiration = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiration <= 0) {
        updateData.status = 'EXPIRED';
        updateData.alertFrequency = 'DAILY'; // Daily alerts after expiration
      } else if (daysUntilExpiration <= 6) {
        updateData.status = 'EXPIRING_SOON';
        updateData.alertFrequency = 'DAILY'; // Daily alerts for 6 days before expiration
      } else if (daysUntilExpiration <= 7) {
        updateData.status = 'EXPIRING_SOON';
        updateData.alertFrequency = 'ONE_WEEK'; // Alert at 1 week
      } else if (daysUntilExpiration <= 14) {
        updateData.status = 'EXPIRING_SOON';
        updateData.alertFrequency = 'TWO_WEEKS'; // Alert at 2 weeks
      } else if (daysUntilExpiration <= 30) {
        updateData.status = 'EXPIRING_SOON';
        updateData.alertFrequency = 'MONTH_BEFORE'; // Alert at 1 month
      } else {
        updateData.status = 'ACTIVE';
        updateData.alertFrequency = null; // No alerts for documents expiring > 30 days
      }
    }
    
    const updatedDocument = await storage.updateCoiDocument(req.params.id, updateData);

    // Emit real-time update for COI sync across all clients
    if (req.app.locals.io) {
      req.app.locals.io.emit('coi:updated', {
        action: 'updated',
        documentId: req.params.id,
        updatedBy: req.user?.email
      });
    }

    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating COI document:', error);
    res.status(500).json({ error: 'Failed to update COI document' });
  }
});

// Delete COI document
router.delete('/api/coi-documents/:id', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const documentId = req.params.id;
    await storage.deleteCoiDocument(documentId);

    // Emit real-time update for COI sync across all clients
    if (req.app.locals.io) {
      req.app.locals.io.emit('coi:updated', {
        action: 'deleted',
        documentId: documentId,
        deletedBy: req.user?.email
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting COI document:', error);
    res.status(500).json({ error: 'Failed to delete COI document' });
  }
});

// Send COI expiration alerts
router.post('/api/coi-documents/send-alerts', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const expiringDocuments = await storage.getExpiringCoiDocuments(30);
    const alertsSent: any[] = [];
    
    for (const doc of expiringDocuments) {
      const expirationDate = new Date(doc.expirationDate);
      const today = new Date();
      const daysUntilExpiration = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine if alert should be sent based on frequency
      let shouldSendAlert = false;
      const lastAlertSent = doc.lastAlertSent ? new Date(doc.lastAlertSent) : null;
      const hoursSinceLastAlert = lastAlertSent ? 
        (today.getTime() - lastAlertSent.getTime()) / (1000 * 60 * 60) : Infinity;
      
      if (daysUntilExpiration <= 0) {
        // Expired - send daily alerts
        shouldSendAlert = hoursSinceLastAlert >= 24;
      } else if (daysUntilExpiration <= 6) {
        // 6 days before expiration - send daily alerts
        shouldSendAlert = hoursSinceLastAlert >= 24;
      } else if (daysUntilExpiration === 7 && hoursSinceLastAlert >= 24) {
        // 1 week before - send alert
        shouldSendAlert = true;
      } else if (daysUntilExpiration === 14 && hoursSinceLastAlert >= 24 * 7) {
        // 2 weeks before - send alert
        shouldSendAlert = true;
      } else if (daysUntilExpiration === 30 && !lastAlertSent) {
        // 1 month before - send initial alert
        shouldSendAlert = true;
      }
      
      if (shouldSendAlert) {
        // Here you would send the actual alert (email, notification, etc.)
        // For now, we'll just track that an alert was sent
        
        await storage.updateCoiDocument(doc.id, {
          lastAlertSent: new Date()
        });
        
        alertsSent.push({
          documentId: doc.id,
          employeeId: doc.employeeId,
          type: doc.type,
          daysUntilExpiration,
          alertType: doc.alertFrequency
        });
      }
    }
    
    res.json({
      success: true,
      alertsSent: alertsSent.length,
      alerts: alertsSent
    });
  } catch (error) {
    console.error('Error sending COI alerts:', error);
    res.status(500).json({ error: 'Failed to send COI alerts' });
  }
});

// Trigger COI alerts manually (for testing and immediate processing)
router.post('/api/coi-documents/trigger-alerts', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const { coiAlertService } = await import('../services/coi-alert-service');
    await coiAlertService.checkAndSendAlerts();
    const summary = await coiAlertService.getAlertSummary();
    
    res.json({
      success: true,
      message: 'COI alerts triggered successfully',
      summary
    });
  } catch (error) {
    console.error('Error triggering COI alerts:', error);
    res.status(500).json({ error: 'Failed to trigger COI alerts' });
  }
});

// Get COI alert summary
router.get('/api/coi-documents/alert-summary', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const { coiAlertService } = await import('../services/coi-alert-service');
    const summary = await coiAlertService.getAlertSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching COI alert summary:', error);
    res.status(500).json({ error: 'Failed to fetch alert summary' });
  }
});

// Manual sync - Import COI documents from Google Drive
router.post('/api/coi-documents/sync-from-drive', requireAuth, requireHROrManager, async (req, res) => {
  try {
    console.log('[COI Sync] Manual sync triggered by user:', req.user?.email);
    
    // Import enhanced Google sync service
    const { googleSyncEnhanced } = await import('../services/google-sync-enhanced');
    
    // Run the import
    await googleSyncEnhanced.importCOIDocumentsFromDrive();
    
    // Get updated document count
    const documents = await storage.getAllCoiDocuments();
    
    res.json({
      success: true,
      message: 'COI documents imported from Google Drive successfully',
      totalDocuments: documents.length
    });
  } catch (error) {
    console.error('Error syncing COI documents from Drive:', error);
    res.status(500).json({ 
      error: 'Failed to sync COI documents from Google Drive',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Manual two-way sync
router.post('/api/coi-documents/sync', requireAuth, requireHROrManager, async (req, res) => {
  try {
    console.log('[COI Sync] Two-way sync triggered by user:', req.user?.email);

    // Import enhanced Google sync service
    const { googleSyncEnhanced } = await import('../services/google-sync-enhanced');

    // Run the full two-way sync
    await googleSyncEnhanced.syncCOIDocuments();

    // Get updated document count
    const documents = await storage.getAllCoiDocuments();

    res.json({
      success: true,
      message: 'Two-way COI sync completed successfully',
      totalDocuments: documents.length
    });
  } catch (error) {
    console.error('Error in two-way COI sync:', error);
    res.status(500).json({
      error: 'Failed to complete two-way COI sync',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================
// SMART UPLOAD - Parse PDF and auto-assign
// ============================================

interface SmartUploadResponse {
  success: boolean;
  parsedData: COIParsedData;
  employeeMatch: MatchResult;
  requiresConfirmation: boolean;
  document?: any;
  message?: string;
}

// Smart upload - parses PDF and auto-assigns to employee
router.post('/api/coi-documents/smart-upload', requireAuth, requireHROrManager, upload.single('file'), async (req, res) => {
  try {
    console.log('[COI Smart Upload] Starting smart upload...');

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    console.log('[COI Smart Upload] File received:', req.file.originalname, 'Size:', req.file.size, 'Type:', req.file.mimetype);

    // Only parse PDFs (images can't be parsed for text without OCR)
    let parsedData: COIParsedData;
    if (req.file.mimetype === 'application/pdf') {
      console.log('[COI Smart Upload] Parsing PDF...');
      parsedData = await parseCOIDocument(req.file.buffer);
      console.log('[COI Smart Upload] Parsed data:', {
        insuredName: parsedData.insuredName,
        rawInsuredName: parsedData.rawInsuredName,
        policyNumber: parsedData.policyNumber,
        effectiveDate: parsedData.effectiveDate,
        expirationDate: parsedData.expirationDate,
        documentType: parsedData.documentType,
        confidence: parsedData.confidence
      });
    } else {
      // For images, return empty parsed data with a flag
      parsedData = {
        insuredName: null,
        rawInsuredName: null,
        policyNumber: null,
        effectiveDate: null,
        expirationDate: null,
        insurerName: null,
        coverageAmounts: {},
        documentType: 'UNKNOWN',
        rawText: 'IMAGE_FILE', // Flag to indicate this was an image
        confidence: 0
      };
      console.log('[COI Smart Upload] Image file detected - cannot extract text from images');
    }

    // Try to match employee using the person name
    console.log('[COI Smart Upload] Attempting employee match...');
    const employeeMatch = await matchEmployeeFromName(parsedData.insuredName);
    console.log('[COI Smart Upload] Employee match result:', {
      matchedEmployee: employeeMatch.matchedEmployee?.firstName + ' ' + employeeMatch.matchedEmployee?.lastName,
      confidence: employeeMatch.confidence,
      matchType: employeeMatch.matchType,
      suggestions: employeeMatch.suggestedEmployees.length
    });

    // Get display name - prefer rawInsuredName which includes company names
    const displayName = parsedData.rawInsuredName || parsedData.insuredName;

    // Always return parsed data for user review - never auto-save
    console.log('[COI Smart Upload] Returning parsed data for user review');
    console.log('[COI Smart Upload] Final result:', {
      insuredName: parsedData.insuredName,
      rawInsuredName: parsedData.rawInsuredName,
      matchedEmployee: employeeMatch.matchedEmployee
        ? `${employeeMatch.matchedEmployee.firstName} ${employeeMatch.matchedEmployee.lastName}`
        : null,
      confidence: employeeMatch.confidence,
      suggestionsCount: employeeMatch.suggestedEmployees.length,
    });

    // Build informative message based on what was found
    let message: string;
    const isImageFile = parsedData.rawText === 'IMAGE_FILE';

    if (isImageFile) {
      message = 'Image files (JPG/PNG) cannot be scanned for text. Please upload a PDF version of the COI, or enter the details manually below.';
    } else if (employeeMatch.matchedEmployee && employeeMatch.confidence >= 80) {
      message = `Matched to ${employeeMatch.matchedEmployee.firstName} ${employeeMatch.matchedEmployee.lastName} (${employeeMatch.confidence}% confidence)`;
    } else if (displayName) {
      message = `Found "${displayName}" - please select employee or enter as external name.`;
    } else {
      message = 'Could not extract insured name from document. Please select employee or enter name manually.';
    }

    const response: SmartUploadResponse = {
      success: true,
      parsedData: {
        ...parsedData,
        // Truncate raw text for response but keep enough for debugging
        rawText: parsedData.rawText?.substring(0, 300) || ''
      },
      employeeMatch,
      requiresConfirmation: true, // Always require confirmation
      message
    };

    res.json(response);

  } catch (error: any) {
    console.error('[COI Smart Upload] Error:', error.message);
    console.error('[COI Smart Upload] Stack:', error.stack);
    res.status(500).json({
      error: 'Smart upload failed',
      details: error.message
    });
  }
});

// Confirm smart upload assignment - saves the document with selected employee OR external name
router.post('/api/coi-documents/confirm-assignment', requireAuth, requireHROrManager, upload.single('file'), async (req, res) => {
  try {
    const currentUser = req.user!;
    const { employeeId, externalName, parsedInsuredName, type, issueDate, expirationDate, notes, policyNumber, insurerName } = req.body;

    console.log('[COI Confirm] Confirming assignment - Employee:', employeeId, 'External:', externalName);

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Must have either employeeId OR externalName
    if (!employeeId && !externalName) {
      return res.status(400).json({ error: 'Either employee selection or external name is required' });
    }

    let employee = null;
    let targetFolderId: string | null = null;
    let displayName = externalName || 'Unknown';

    // If we have an employee, get their folder
    if (employeeId) {
      employee = await storage.getUserById(employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      displayName = `${employee.firstName} ${employee.lastName}`;
      console.log('[COI Confirm] Employee found:', displayName);

      // Get or create employee folder structure (skip if Google Drive not configured)
      if (googleDriveService.isConfigured()) {
        try {
          const employeeFolders = await googleSyncEnhanced.getOrCreateEmployeeFolder(employee);
          if (employeeFolders?.coiFolderId) {
            targetFolderId = employeeFolders.coiFolderId;
          }
        } catch (folderError: any) {
          console.warn('[COI Confirm] Could not get employee folder, will use fallback:', folderError.message);
        }
      }
    }

    // If no employee folder, try external COI folder (only if Google Drive is configured)
    if (!targetFolderId && googleDriveService.isConfigured()) {
      // For external contractors, upload to a general COI folder
      console.log('[COI Confirm] Using external COI folder for:', externalName || displayName);
      try {
        const externalFolders = await googleSyncEnhanced.getOrCreateExternalCoiFolder();
        targetFolderId = externalFolders?.folderId || null;
      } catch (folderError: any) {
        console.warn('[COI Confirm] Could not get external COI folder, will use fallback:', folderError.message);
      }
    }

    // Build file name
    const coiType = type || 'GENERAL_LIABILITY';
    const safeName = (employee?.lastName || externalName || 'External').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `COI_${coiType}_${safeName}_${Date.now()}.${req.file.originalname.split('.').pop()}`;

    let driveFile: { id: string | null; webViewLink: string | null } | null = null;
    let documentUrl = '';
    let googleDriveId: string | null = null;

    // Check if Google Drive is configured
    if (googleDriveService.isConfigured()) {
      try {
        // Try to upload to Google Drive
        if (targetFolderId) {
          driveFile = await googleDriveService.uploadFile({
            name: fileName,
            mimeType: req.file.mimetype,
            content: req.file.buffer,
            parentFolderId: targetFolderId,
            description: `COI Document - ${coiType} - ${displayName}`
          });
        } else {
          // Fallback: upload to root if no folder
          driveFile = await googleDriveService.uploadFile({
            name: fileName,
            mimeType: req.file.mimetype,
            content: req.file.buffer,
            description: `COI Document - ${coiType} - ${displayName}`
          });
        }
        if (driveFile?.id) {
          documentUrl = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;
          googleDriveId = driveFile.id;
          console.log('[COI Confirm] Uploaded to Google Drive:', driveFile.id);
        }
      } catch (driveError: any) {
        console.error('[COI Confirm] Google Drive upload failed, falling back to local storage:', driveError.message);
        // Fall through to local storage
      }
    }

    // If no Google Drive upload, save locally
    if (!driveFile) {
      console.log('[COI Confirm] Using local storage (Google Drive not configured or upload failed)');
      ensureLocalStorageDir();
      const localFilePath = path.join(COI_LOCAL_STORAGE_PATH, fileName);
      fs.writeFileSync(localFilePath, req.file.buffer);
      documentUrl = `/api/coi-documents/local/${fileName}`;
      console.log('[COI Confirm] Saved to local storage:', localFilePath);
    }

    if (!documentUrl) {
      throw new Error('Document URL could not be determined after upload.');
    }

    // Parse dates or use defaults
    const today = new Date();
    const oneYearFromNow = new Date(today);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const finalIssueDate = issueDate || today.toISOString().split('T')[0];
    const finalExpirationDate = expirationDate || oneYearFromNow.toISOString().split('T')[0];

    // Calculate status
    const expDate = new Date(finalExpirationDate);
    const daysUntilExpiration = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';
    let alertFrequency: 'MONTH_BEFORE' | 'TWO_WEEKS' | 'ONE_WEEK' | 'DAILY' | null = null;

    if (daysUntilExpiration <= 0) {
      status = 'EXPIRED';
      alertFrequency = 'DAILY';
    } else if (daysUntilExpiration <= 6) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'DAILY';
    } else if (daysUntilExpiration <= 7) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'ONE_WEEK';
    } else if (daysUntilExpiration <= 14) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'TWO_WEEKS';
    } else if (daysUntilExpiration <= 30) {
      status = 'EXPIRING_SOON';
      alertFrequency = 'MONTH_BEFORE';
    }

    // Create database record - employeeId can be null for external contractors
    const document = await storage.createCoiDocument({
      employeeId: employeeId || null,
      externalName: externalName || null,
      parsedInsuredName: parsedInsuredName || null,
      type: coiType as 'WORKERS_COMP' | 'GENERAL_LIABILITY',
      documentUrl: documentUrl,
      issueDate: finalIssueDate,
      expirationDate: finalExpirationDate,
      notes: notes || `Policy: ${policyNumber || 'Unknown'}. Insurer: ${insurerName || 'Unknown'}`,
      uploadedBy: currentUser.id,
      status,
      alertFrequency,
      googleDriveId: googleDriveId // Store Drive ID for deduplication (null if stored locally)
    });

    console.log('[COI Confirm] Document saved successfully:', document.id);

    res.json({
      success: true,
      document,
      message: `COI document saved for ${displayName}`
    });

  } catch (error: any) {
    console.error('[COI Confirm] Error:', error.message);
    res.status(500).json({
      error: 'Failed to confirm assignment',
      details: error.message
    });
  }
});

// ============================================
// DOCUMENT RETRIEVAL - Download and preview
// ============================================

// Download COI document from Google Drive
router.get('/api/coi-documents/:id/download', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const document = await storage.getCoiDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'COI document not found' });
    }

    // Check access permissions
    if (document.employeeId !== user.id &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'TERRITORY_SALES_MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get file from Google Drive - use documentUrl to extract Drive ID
    const googleDriveId = (document as any).googleDriveId || document.documentUrl?.match(/\/d\/([^/]+)/)?.[1];
    if (!googleDriveId) {
      return res.status(404).json({ error: 'Document file not found in storage' });
    }

    console.log('[COI Download] Downloading file from Google Drive:', googleDriveId);

    const fileContent = await googleDriveService.downloadFile(googleDriveId);

    // Get file metadata for content type
    const fileMetadata = await googleDriveService.getFileMetadata(googleDriveId);
    const mimeType = fileMetadata?.mimeType || 'application/octet-stream';
    const fileName = fileMetadata?.name || `COI_${document.type}_${document.id}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileContent);

  } catch (error: any) {
    console.error('[COI Download] Error:', error.message);
    res.status(500).json({ error: 'Failed to download document', details: error.message });
  }
});

// Get preview URL for COI document
router.get('/api/coi-documents/:id/preview', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const document = await storage.getCoiDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'COI document not found' });
    }

    // Check access permissions
    if (document.employeeId !== user.id &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'TERRITORY_SALES_MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return the Google Drive view URL - extract Drive ID from documentUrl
    const googleDriveId = (document as any).googleDriveId || document.documentUrl?.match(/\/d\/([^/]+)/)?.[1];
    let previewUrl = document.documentUrl;

    if (googleDriveId && !previewUrl) {
      previewUrl = `https://drive.google.com/file/d/${googleDriveId}/preview`;
    }

    // Convert view link to preview link if needed
    if (previewUrl && previewUrl.includes('/view')) {
      previewUrl = previewUrl.replace('/view', '/preview');
    }

    res.json({
      previewUrl,
      documentUrl: document.documentUrl,
      googleDriveId,
      type: document.type,
      employeeId: document.employeeId
    });

  } catch (error: any) {
    console.error('[COI Preview] Error:', error.message);
    res.status(500).json({ error: 'Failed to get preview URL', details: error.message });
  }
});

// Serve locally stored COI files
router.get('/api/coi-documents/local/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(COI_LOCAL_STORAGE_PATH, sanitizedFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type
    const ext = path.extname(sanitizedFilename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error: any) {
    console.error('[COI Local File] Error:', error.message);
    res.status(500).json({ error: 'Failed to serve file', details: error.message });
  }
});

// Get all employees for dropdown selection
router.get('/api/coi-documents/employees/list', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const allUsers = await storage.getAllUsers();
    // Filter to active employees and format for dropdown
    const employees = allUsers
      .filter(u => u.isActive !== false)
      .map(u => ({
        id: u.id,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email,
        fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim()
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    res.json(employees);
  } catch (error: any) {
    console.error('[COI Employees] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// ============================================
// BULK IMPORT - Preview and import from Drive folder
// ============================================

// Default folder ID for bulk COI import
const DEFAULT_BULK_COI_FOLDER = '1brvMwfBzzZ_Q6XXJlPJ8BpIUD1Edlf8u';

interface BulkPreviewItem {
  googleDriveId: string;
  fileName: string;
  webViewLink: string;
  parsedData: COIParsedData;
  employeeMatch: MatchResult;
  alreadyImported: boolean;
}

interface BulkImportItem {
  googleDriveId: string;
  fileName: string;
  webViewLink: string;
  employeeId?: string;
  externalName?: string;
  parsedInsuredName?: string;
  type: 'WORKERS_COMP' | 'GENERAL_LIABILITY';
  issueDate: string;
  expirationDate: string;
  notes?: string;
  policyNumber?: string;
  insurerName?: string;
}

// Bulk preview - scans Drive folder and parses all COIs without saving
router.post('/api/coi-documents/bulk-preview', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const { folderId } = req.body;
    const targetFolderId = folderId || process.env.COI_BULK_IMPORT_FOLDER || DEFAULT_BULK_COI_FOLDER;

    console.log('[COI Bulk Preview] Starting preview for folder:', targetFolderId);
    console.log('[COI Bulk Preview] Triggered by user:', req.user?.email);

    // Initialize Google Drive service
    if (!googleDriveService.isInitialized()) {
      await googleDriveService.initialize();
    }

    if (!googleDriveService.isConfigured()) {
      return res.status(503).json({
        error: 'Google Drive is not configured',
        details: 'Please configure Google Drive credentials to use bulk import'
      });
    }

    // List all PDF files in the folder
    console.log('[COI Bulk Preview] Listing files in folder...');
    const files = await googleDriveService.listFiles({
      q: `'${targetFolderId}' in parents and trashed=false and mimeType='application/pdf'`,
      pageSize: 100
    });

    console.log('[COI Bulk Preview] Found', files?.length || 0, 'PDF files');

    if (!files || files.length === 0) {
      return res.json({
        success: true,
        totalFiles: 0,
        previews: [],
        errors: [],
        alreadyImported: 0,
        message: 'No PDF files found in the specified folder'
      });
    }

    // Get existing COI documents to check for duplicates
    const existingDocs = await storage.getAllCoiDocuments();
    const existingDriveIds = new Set(
      existingDocs
        .map(doc => doc.googleDriveId)
        .filter((id): id is string => id !== null && id !== undefined)
    );
    console.log('[COI Bulk Preview] Found', existingDriveIds.size, 'existing Drive IDs');

    const previews: BulkPreviewItem[] = [];
    const errors: { file: string; error: string }[] = [];
    let alreadyImportedCount = 0;

    // Process each file
    for (const file of files) {
      if (!file.id || !file.name) continue;

      const alreadyImported = existingDriveIds.has(file.id);
      if (alreadyImported) {
        alreadyImportedCount++;
      }

      try {
        console.log('[COI Bulk Preview] Processing:', file.name, alreadyImported ? '(already imported)' : '');

        // Download file content
        const downloadResult = await googleDriveService.downloadFile(file.id);

        // Convert stream to buffer
        let fileBuffer: Buffer;
        if (Buffer.isBuffer(downloadResult)) {
          fileBuffer = downloadResult;
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of downloadResult) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          fileBuffer = Buffer.concat(chunks);
        }

        // Parse the PDF
        const parsedData = await parseCOIDocument(fileBuffer);
        console.log('[COI Bulk Preview] Parsed:', file.name, '- Insured:', parsedData.insuredName, '- Type:', parsedData.documentType);

        // Match to employee
        const employeeMatch = await matchEmployeeFromName(parsedData.insuredName);
        console.log('[COI Bulk Preview] Match result:', employeeMatch.matchedEmployee?.firstName, employeeMatch.matchedEmployee?.lastName, '-', employeeMatch.confidence + '%');

        previews.push({
          googleDriveId: file.id,
          fileName: file.name,
          webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          parsedData: {
            ...parsedData,
            rawText: parsedData.rawText?.substring(0, 200) || '' // Truncate for response size
          },
          employeeMatch,
          alreadyImported
        });

      } catch (fileError: any) {
        console.error('[COI Bulk Preview] Error processing', file.name, ':', fileError.message);
        errors.push({ file: file.name, error: fileError.message });
      }
    }

    console.log('[COI Bulk Preview] Complete. Previews:', previews.length, 'Errors:', errors.length, 'Already imported:', alreadyImportedCount);

    res.json({
      success: true,
      totalFiles: files.length,
      previews,
      errors,
      alreadyImported: alreadyImportedCount
    });

  } catch (error: any) {
    console.error('[COI Bulk Preview] Error:', error.message);
    console.error('[COI Bulk Preview] Stack:', error.stack);
    res.status(500).json({
      error: 'Bulk preview failed',
      details: error.message
    });
  }
});

// Bulk import - saves confirmed COI documents
router.post('/api/coi-documents/bulk-import', requireAuth, requireHROrManager, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { imports } = req.body as { imports: BulkImportItem[] };

    if (!imports || !Array.isArray(imports) || imports.length === 0) {
      return res.status(400).json({ error: 'No imports provided' });
    }

    console.log('[COI Bulk Import] Starting import of', imports.length, 'documents');
    console.log('[COI Bulk Import] Triggered by user:', currentUser.email);

    // Get existing COI documents to prevent duplicates
    const existingDocs = await storage.getAllCoiDocuments();
    const existingDriveIds = new Set(
      existingDocs
        .map(doc => doc.googleDriveId)
        .filter((id): id is string => id !== null && id !== undefined)
    );

    const results: { googleDriveId: string; status: 'imported' | 'skipped' | 'failed'; documentId?: string; error?: string }[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const item of imports) {
      // Validate item
      if (!item.employeeId && !item.externalName) {
        results.push({ googleDriveId: item.googleDriveId, status: 'failed', error: 'Either employee or external name is required' });
        failedCount++;
        continue;
      }

      // Check for duplicate
      if (existingDriveIds.has(item.googleDriveId)) {
        console.log('[COI Bulk Import] Skipping duplicate:', item.fileName);
        results.push({ googleDriveId: item.googleDriveId, status: 'skipped', error: 'Already imported' });
        skippedCount++;
        continue;
      }

      try {
        console.log('[COI Bulk Import] Importing:', item.fileName, 'for', item.employeeId ? `employee ${item.employeeId}` : `external: ${item.externalName}`);

        // Calculate status based on expiration
        const status = calculateCoiStatus(item.expirationDate);

        // Build notes with policy and insurer info
        let notes = item.notes || `Bulk imported from Google Drive: ${item.fileName}`;
        if (item.policyNumber) {
          notes += ` | Policy: ${item.policyNumber}`;
        }
        if (item.insurerName) {
          notes += ` | Insurer: ${item.insurerName}`;
        }

        // Create COI document
        const docData: any = {
          employeeId: item.employeeId || null,
          externalName: item.externalName || null,
          parsedInsuredName: item.parsedInsuredName || null,
          type: item.type,
          documentUrl: item.webViewLink,
          issueDate: item.issueDate,
          expirationDate: item.expirationDate,
          uploadedBy: currentUser.id,
          status,
          googleDriveId: item.googleDriveId,
          notes
        };

        const doc = await storage.createCoiDocument(docData);
        existingDriveIds.add(item.googleDriveId); // Prevent duplicates within same batch

        results.push({ googleDriveId: item.googleDriveId, status: 'imported', documentId: doc.id });
        importedCount++;
        console.log('[COI Bulk Import] Created document:', doc.id);

      } catch (itemError: any) {
        console.error('[COI Bulk Import] Error importing', item.fileName, ':', itemError.message);
        results.push({ googleDriveId: item.googleDriveId, status: 'failed', error: itemError.message });
        failedCount++;
      }
    }

    console.log('[COI Bulk Import] Complete. Imported:', importedCount, 'Skipped:', skippedCount, 'Failed:', failedCount);

    // Emit socket event for real-time refresh
    const io = (req as any).app?.get?.('io');
    if (io) {
      io.emit('coi:updated', { action: 'bulk_import', count: importedCount, importedBy: currentUser.email });
    }

    res.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      failed: failedCount,
      results
    });

  } catch (error: any) {
    console.error('[COI Bulk Import] Error:', error.message);
    console.error('[COI Bulk Import] Stack:', error.stack);
    res.status(500).json({
      error: 'Bulk import failed',
      details: error.message
    });
  }
});

export default router;
