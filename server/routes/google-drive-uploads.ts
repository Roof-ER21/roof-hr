import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { insertCandidateSchema, insertCoiDocumentSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { googleDriveService } from '../services/google-drive-service';
import { googleSyncEnhanced } from '../services/google-sync-enhanced';
import { SusanResumeParser } from '../services/susan-ai/resume-parser';
import { extractResumeText } from '../services/resume-text-extractor';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Extend Express Request type to include user
interface AuthRequest extends Omit<Request, 'user'> {
  user?: {
    id: number;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
}

// Position mapping for resume categories
const CATEGORY_POSITIONS: Record<string, string> = {
  'insurance-sales': 'Insurance Sales',
  'retail-closer': 'Retail Closer',
  'retail-marketing': 'Retail Marketing',
  'office': 'Office',
  'production-coordinator': 'Production Coordinator',
  'field-tech': 'Field Tech'
};

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept PDFs and common document formats
    if (file.mimetype === 'application/pdf' ||
        file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word documents and image files are allowed'));
    }
  }
});

// Middleware
function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireHROrManager(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // HR, Managers, and Territory Managers can manage documents
  if (!['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'TERRITORY_SALES_MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'HR or Manager access required' });
  }

  next();
}

// Upload candidate with resume to Google Drive
router.post('/api/candidates/upload-with-resume', requireAuth as any, requireHROrManager as any, upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!; // User exists due to requireAuth middleware
    const candidateData = req.body;
    
    console.log('[Candidate Upload] Starting candidate creation with resume upload');
    console.log('[Candidate Upload] Candidate data:', candidateData);
    
    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }
    
    console.log('[Candidate Upload] Resume file received:', req.file.originalname, 'Size:', req.file.size);

    // Initialize Google Drive service if not already done
    if (!googleDriveService.isInitialized()) {
      await googleDriveService.initialize();
    }

    // Find or create Recruitment folder in HR System
    const hrRootFolder = await googleDriveService.findFolderByName('ROOF-ER HR System');
    if (!hrRootFolder) {
      return res.status(500).json({ error: 'HR System folder not found in Google Drive' });
    }

    let recruitmentFolder = await googleDriveService.findFolderByName('Recruitment', hrRootFolder.id);
    if (!recruitmentFolder) {
      recruitmentFolder = await googleDriveService.createFolder('Recruitment', hrRootFolder.id);
      console.log('[Candidate Upload] Created Recruitment folder');
    }

    // Create candidate folder
    const candidateFolderName = `${candidateData.firstName}_${candidateData.lastName}_${Date.now()}`;
    const candidateFolder = await googleDriveService.createFolder(candidateFolderName, recruitmentFolder.id);
    console.log('[Candidate Upload] Created candidate folder:', candidateFolder.id);

    // Upload resume to Google Drive
    const resumeFileName = `Resume_${candidateData.firstName}_${candidateData.lastName}_${Date.now()}.${req.file.originalname.split('.').pop()}`;

    const driveFile = await googleDriveService.uploadFile({
      name: resumeFileName,
      mimeType: req.file.mimetype,
      content: req.file.buffer,
      parentFolderId: candidateFolder.id,
      description: `Resume for ${candidateData.firstName} ${candidateData.lastName} - Position: ${candidateData.position || 'Not specified'}`
    });

    console.log('[Candidate Upload] Resume uploaded to Google Drive:', driveFile.id, 'Link:', driveFile.webViewLink);

    // Create candidate in database with Google Drive resume URL
    const candidate = await storage.createCandidate({
      firstName: candidateData.firstName,
      lastName: candidateData.lastName,
      email: candidateData.email,
      phone: candidateData.phone,
      position: candidateData.position || 'Roofing Specialist',
      resumeUrl: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
      status: 'SCREENING',
      stage: candidateData.stage || 'Initial Review',
      appliedDate: new Date(),
      notes: candidateData.notes || `Resume uploaded to Google Drive: ${driveFile.webViewLink}`
    });
    
    console.log('[Candidate Upload] Candidate created:', candidate.id);

    // TODO: Susan AI will parse resume and extract information
    // Note: Susan AI integration is pending - for now the candidate is created with provided data
    console.log('[Candidate Upload] Susan AI resume parsing will be integrated to extract skills and experience');

    res.json({
      success: true,
      candidate: {
        ...candidate,
        googleDriveUrl: driveFile.webViewLink,
        googleDriveFolderId: candidateFolder.id
      },
      message: `Candidate ${candidateData.firstName} ${candidateData.lastName} created successfully with resume uploaded to Google Drive`
    });
  } catch (error: any) {
    console.error('[Candidate Upload] Error:', error);
    console.error('[Candidate Upload] Error stack:', error.stack);
    
    res.status(500).json({ 
      error: error.message || 'Failed to upload candidate with resume',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Upload COI document for existing employee
router.post('/api/coi-documents/upload-for-employee', requireAuth as any, requireHROrManager as any, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!; // User exists due to requireAuth middleware
    const { employeeName, type, issueDate, expirationDate, notes } = req.body;
    
    console.log('[COI Upload] Starting COI upload for employee:', employeeName, 'Type:', type);
    
    if (!req.file) {
      return res.status(400).json({ error: 'COI document file is required' });
    }
    
    console.log('[COI Upload] File received:', req.file.originalname, 'Size:', req.file.size);

    // Find employee by name (firstName + lastName)
    const nameParts = employeeName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    console.log('[COI Upload] Searching for employee:', firstName, lastName);
    
    // Find employee in the database
    const employees = await storage.getAllUsers();
    const employee = employees.find(e => 
      e.firstName?.toLowerCase() === firstName.toLowerCase() && 
      e.lastName?.toLowerCase() === lastName.toLowerCase()
    );
    
    if (!employee) {
      return res.status(404).json({ error: `Employee ${employeeName} not found` });
    }
    
    console.log('[COI Upload] Employee found:', employee.id, employee.email);

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
      description: `COI Document - ${type} - Valid: ${issueDate} to ${expirationDate}`
    });
    
    console.log('[COI Upload] File uploaded to Google Drive successfully:', driveFile.id, 'Link:', driveFile.webViewLink);

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
      employeeId: employee.id,
      type: type as 'WORKERS_COMP' | 'GENERAL_LIABILITY',
      documentUrl: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
      issueDate,
      expirationDate,
      notes,
      uploadedBy: String(user.id),
      status,
      alertFrequency
    } as any);
    
    console.log('[COI Upload] COI document created successfully. ID:', document.id, 'Google Drive ID:', driveFile.id);
    
    res.json({
      success: true,
      document: {
        ...document,
        googleDriveUrl: driveFile.webViewLink
      },
      message: `COI document for ${employee.firstName} ${employee.lastName} uploaded successfully`
    });
  } catch (error: any) {
    console.error('[COI Upload] Error uploading COI document:', error);
    console.error('[COI Upload] Error stack:', error.stack);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid document data', details: error.errors });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to upload COI document',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================================================
// RESUME UPLOADER ENDPOINTS (for new Resume Uploader page)
// ============================================================================

/**
 * Upload a resume with AI-powered parsing
 * Creates a candidate automatically from resume content
 * Works with or without Google Drive configured
 */
router.post('/api/resumes/upload', requireAuth as any, requireHROrManager as any, upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!; // User exists due to requireAuth middleware
    const { category, assignedTo } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    if (!category || !CATEGORY_POSITIONS[category]) {
      return res.status(400).json({
        error: 'Invalid category. Must be one of: insurance-sales, retail-sales, office'
      });
    }

    const position = CATEGORY_POSITIONS[category];
    console.log('[Resume Upload] Processing:', req.file.originalname, 'Category:', category, 'Position:', position);

    // 1. Extract text from resume FIRST (works without Google Drive)
    let parsedData: any = { firstName: 'Unknown', lastName: 'Candidate' };
    let resumeText = '';
    try {
      resumeText = await extractResumeText(req.file.buffer, req.file.mimetype);
      console.log('[Resume Upload] Extracted text, length:', resumeText.length);

      // 2. Use Susan AI to parse resume
      const resumeParser = new SusanResumeParser();
      parsedData = await resumeParser.parseResume(resumeText);
      // Store the raw resume text in parsedData so Susan can read it later
      parsedData.rawResumeText = resumeText;
      console.log('[Resume Upload] Parsed data:', JSON.stringify(parsedData).slice(0, 200));
    } catch (parseError: any) {
      console.error('[Resume Upload] Parse error (continuing with defaults):', parseError.message);
      // Try to get name from filename as fallback
      const filename = req.file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
      const nameParts = filename.split(/[_\-\s]+/);
      if (nameParts.length >= 2) {
        parsedData.firstName = nameParts[0];
        parsedData.lastName = nameParts.slice(1).join(' ');
      }
    }

    // 3. Try to upload to Google Drive (optional - works without it)
    let resumeUrl = '';
    let googleDriveResumeId = '';
    let googleDriveFolderId = '';
    let driveConfigured = false;

    // Check for Google credentials BEFORE trying to initialize (fail-safe)
    const hasGoogleCredentials = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_CREDENTIALS_PATH ||
      process.env.GOOGLE_CLIENT_EMAIL
    );

    if (hasGoogleCredentials) {
      try {
        // Try to initialize Google Drive
        if (!googleDriveService.isInitialized()) {
          await googleDriveService.initialize();
        }

        const hrRootFolder = await googleDriveService.findFolderByName('ROOF-ER HR System');
        if (hrRootFolder) {
          driveConfigured = true;

          let resumeUploadsFolder = await googleDriveService.findFolderByName('Resume Uploads', hrRootFolder.id);
          if (!resumeUploadsFolder) {
            resumeUploadsFolder = await googleDriveService.createFolder('Resume Uploads', hrRootFolder.id);
            console.log('[Resume Upload] Created Resume Uploads folder');
          }

          let categoryFolder = await googleDriveService.findFolderByName(position, resumeUploadsFolder.id);
          if (!categoryFolder) {
            categoryFolder = await googleDriveService.createFolder(position, resumeUploadsFolder.id);
            console.log('[Resume Upload] Created category folder:', position);
          }

          const timestamp = Date.now();
          const fileExt = req.file.originalname.split('.').pop() || 'pdf';
          const fileName = `${parsedData.firstName}_${parsedData.lastName}_${timestamp}.${fileExt}`;

          const driveFile = await googleDriveService.uploadFile({
            name: fileName,
            mimeType: req.file.mimetype,
            content: req.file.buffer,
            parentFolderId: categoryFolder.id,
            description: `Resume for ${parsedData.firstName} ${parsedData.lastName} - ${position}`
          });

          resumeUrl = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;
          googleDriveResumeId = driveFile.id;
          googleDriveFolderId = categoryFolder.id;
          console.log('[Resume Upload] Uploaded to Drive:', driveFile.id);
        }
      } catch (driveError: any) {
        console.log('[Resume Upload] Google Drive error (continuing without):', driveError.message);
      }
    } else {
      console.log('[Resume Upload] Google Drive credentials not configured, skipping cloud storage');
    }

    // 4. Local storage fallback if Google Drive not configured
    if (!resumeUrl && req.file) {
      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'resumes');
        await fs.promises.mkdir(uploadsDir, { recursive: true });

        const safeFilename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = path.join(uploadsDir, safeFilename);
        await fs.promises.writeFile(filePath, req.file.buffer);

        resumeUrl = `/uploads/resumes/${safeFilename}`;
        console.log('[Resume Upload] Saved locally:', resumeUrl);
      } catch (localError: any) {
        console.error('[Resume Upload] Local storage error:', localError.message);
      }
    }

    // 5. Create candidate record with placeholder values for required fields
    // Note: email and phone are NOT NULL in schema, so use placeholders if not extracted
    const placeholderEmail = parsedData.email?.trim() || `candidate_${Date.now()}@placeholder.local`;
    const placeholderPhone = parsedData.phone?.trim() || '(000) 000-0000';

    const candidate = await storage.createCandidate({
      firstName: parsedData.firstName || 'Unknown',
      lastName: parsedData.lastName || 'Candidate',
      email: placeholderEmail,
      phone: placeholderPhone,
      position: position,
      resumeUrl: resumeUrl || null,
      status: 'APPLIED',
      stage: 'Application Review',
      appliedDate: new Date(),
      parsedResumeData: JSON.stringify(parsedData),
      notes: `Auto-created from resume upload (${req.file.originalname}). Skills: ${(parsedData.skills || []).join(', ')}${!parsedData.email ? ' [Email not extracted]' : ''}${!parsedData.phone ? ' [Phone not extracted]' : ''}`
    });

    console.log('[Resume Upload] Candidate created:', candidate.id, candidate.firstName, candidate.lastName);

    // 6. Handle sourcer assignment if provided
    let assignedSourcer = null;
    if (assignedTo) {
      try {
        // Update candidate with assignedTo
        await storage.updateCandidate(candidate.id, { assignedTo });

        // Create HR assignment record for tracking
        await storage.createHrAssignment({
          type: 'CANDIDATE',
          assigneeId: candidate.id,
          hrMemberId: assignedTo,
          assignedBy: user.id,
          role: 'PRIMARY',
          status: 'ACTIVE',
          notes: `Assigned during resume upload by ${user.firstName} ${user.lastName}`,
          startDate: new Date(),
          tasksCompleted: 0,
        });

        // Get sourcer details for response
        const sourcerUser = await storage.getUserById(assignedTo);
        if (sourcerUser) {
          assignedSourcer = {
            id: sourcerUser.id,
            firstName: sourcerUser.firstName,
            lastName: sourcerUser.lastName,
            screenerColor: (sourcerUser as any).screenerColor || '#6B7280'
          };
        }

        console.log('[Resume Upload] Candidate assigned to sourcer:', assignedTo);
      } catch (assignError: any) {
        console.error('[Resume Upload] Assignment error (continuing):', assignError.message);
      }
    }

    res.json({
      success: true,
      candidate: {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        position: candidate.position,
        resumeUrl: candidate.resumeUrl,
        status: candidate.status,
        stage: candidate.stage,
        assignedTo: assignedTo || null,
        sourcer: assignedSourcer
      },
      googleDriveUrl: resumeUrl || null,
      driveConfigured,
      message: `Candidate ${parsedData.firstName} ${parsedData.lastName} created from resume${!driveConfigured ? ' (Google Drive not configured - resume not stored in cloud)' : ''}${assignedSourcer ? ` and assigned to ${assignedSourcer.firstName} ${assignedSourcer.lastName}` : ''}`
    });

  } catch (error: any) {
    console.error('[Resume Upload] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to upload resume',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Sync resumes from a Google Drive folder
 * Reads all resumes from a source folder and creates candidates
 */
router.post('/api/resumes/sync-from-drive', requireAuth as any, requireHROrManager as any, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!; // User exists due to requireAuth middleware
    const { category, sourceFolderId } = req.body;

    if (!category || !CATEGORY_POSITIONS[category]) {
      return res.status(400).json({
        error: 'Invalid category. Must be one of: insurance-sales, retail-sales, office'
      });
    }

    const position = CATEGORY_POSITIONS[category];
    console.log('[Resume Sync] Starting sync for category:', category, 'Position:', position);

    // Initialize Google Drive
    if (!googleDriveService.isInitialized()) {
      await googleDriveService.initialize();
    }

    // Determine source folder
    const sourceFolder = sourceFolderId || process.env.RESUME_SYNC_SOURCE_FOLDER;
    if (!sourceFolder) {
      return res.status(400).json({
        error: 'Source folder not configured. Set RESUME_SYNC_SOURCE_FOLDER or provide sourceFolderId'
      });
    }

    // Find the category subfolder in source
    const categoryFolder = await googleDriveService.findFolderByName(position, sourceFolder);
    if (!categoryFolder) {
      return res.status(404).json({
        error: `Folder "${position}" not found in source folder`
      });
    }

    console.log('[Resume Sync] Found category folder:', categoryFolder.id);

    // List files in the category folder
    const files = await googleDriveService.listFiles({
      q: `'${categoryFolder.id}' in parents and trashed=false and (mimeType='application/pdf' or mimeType contains 'document' or mimeType contains 'word')`,
      pageSize: 50
    });

    console.log('[Resume Sync] Found', files.length, 'files in folder');

    // Get existing candidates to avoid duplicates
    const existingCandidates = await storage.getAllCandidates();
    const processedDriveIds = new Set(
      existingCandidates
        .filter((c: any) => c.googleDriveResumeId)
        .map((c: any) => c.googleDriveResumeId)
    );

    const results: any[] = [];
    const errors: any[] = [];
    const resumeParser = new SusanResumeParser();

    for (const file of files) {
      // Skip if already processed
      if (processedDriveIds.has(file.id)) {
        console.log('[Resume Sync] Skipping already processed:', file.name);
        continue;
      }

      try {
        console.log('[Resume Sync] Processing:', file.name);

        // Download file content
        const fileBuffer = await googleDriveService.downloadFile(file.id);

        // Extract and parse
        const resumeText = await extractResumeText(fileBuffer, file.mimeType || 'application/pdf');
        const parsedData = await resumeParser.parseResume(resumeText);

        // Create candidate with placeholder values for required fields
        const syncPlaceholderEmail = parsedData.email?.trim() || `candidate_${Date.now()}@placeholder.local`;
        const syncPlaceholderPhone = parsedData.phone?.trim() || '(000) 000-0000';

        const candidate = await storage.createCandidate({
          firstName: parsedData.firstName || 'Unknown',
          lastName: parsedData.lastName || 'Candidate',
          email: syncPlaceholderEmail,
          phone: syncPlaceholderPhone,
          position: position,
          resumeUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          status: 'APPLIED',
          stage: 'Application Review',
          appliedDate: new Date(),
          parsedResumeData: JSON.stringify(parsedData),
          notes: `Synced from Google Drive. Original file: ${file.name}. Skills: ${(parsedData.skills || []).join(', ')}`
        });

        results.push({
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          position: candidate.position,
          resumeUrl: candidate.resumeUrl
        });

        console.log('[Resume Sync] Created candidate:', candidate.id, candidate.firstName, candidate.lastName);

      } catch (fileError: any) {
        console.error(`[Resume Sync] Failed to process ${file.name}:`, fileError.message);
        errors.push({ file: file.name, error: fileError.message });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      skipped: files.length - results.length - errors.length,
      errors: errors.length,
      candidates: results,
      errorDetails: errors.length > 0 ? errors : undefined,
      message: `Processed ${results.length} new resumes from ${position} folder`
    });

  } catch (error: any) {
    console.error('[Resume Sync] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to sync from Drive',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Get recent candidates by source and position for the Resume Uploader UI
 */
router.get('/api/resumes/recent', requireAuth as any, requireHROrManager as any, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!; // User exists due to requireAuth middleware
    const { category, limit = 20 } = req.query;

    const allCandidates = await storage.getAllCandidates();

    // Filter by source (Resume Upload or Google Drive Sync)
    let filtered = allCandidates.filter((c: any) =>
      c.source === 'Resume Upload' || c.source === 'Google Drive Sync'
    );

    // Filter by category/position if specified
    if (category && CATEGORY_POSITIONS[category as string]) {
      const position = CATEGORY_POSITIONS[category as string];
      filtered = filtered.filter((c: any) => c.position === position);
    }

    // Sort by most recent first and limit
    filtered.sort((a: any, b: any) =>
      new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
    );

    const limited = filtered.slice(0, Number(limit));

    res.json({
      success: true,
      candidates: limited.map((c: any) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        position: c.position,
        resumeUrl: c.resumeUrl,
        status: c.status,
        stage: c.stage,
        source: c.source,
        appliedDate: c.appliedDate
      })),
      total: filtered.length
    });

  } catch (error: any) {
    console.error('[Resume Recent] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get recent resumes' });
  }
});

export default router;