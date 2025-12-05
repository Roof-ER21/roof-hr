import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertDocumentSchema, insertDocumentVersionSchema, insertDocumentAccessLogSchema, insertDocumentAcknowledgmentSchema } from '@shared/schema';
import { googleDriveService } from '../services/google-drive-service';
import { googleDocsService } from '../services/google-docs-service';

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

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

// Get all documents with filtering and role-based access
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, status, visibility, search } = req.query;
    
    // Get documents based on user role and visibility
    const documents = await storage.getDocuments({
      category: category as string,
      status: status as string,
      visibility: visibility as string,
      search: search as string,
      userRole: req.user.role,
    });

    res.json(documents);
  } catch (error) {
    console.error('[DOCUMENTS GET ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to fetch documents',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get document by ID with access logging
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await storage.getDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check visibility permissions
    if (!hasDocumentAccess(document, req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Log access
    await storage.createDocumentAccessLog({
      documentId: id,
      userId: req.user.id,
      action: 'VIEW',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json(document);
  } catch (error) {
    console.error('[DOCUMENT GET ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to fetch document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new document (Admin/Manager only)
router.post('/', requireManager, async (req, res) => {
  try {
    const documentData = insertDocumentSchema.parse({
      ...req.body,
      createdBy: req.user.id,
    });
    
    const document = await storage.createDocument(documentData);

    console.log('[DOCUMENT CREATED]', {
      documentId: document.id,
      name: document.name,
      category: document.category,
      createdBy: req.user.email
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('[DOCUMENT CREATE ERROR]', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid document data', 
        details: error.errors 
      });
    }

    res.status(500).json({ 
      error: 'Failed to create document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update document (Admin/Manager only)
router.put('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingDocument = await storage.getDocumentById(id);
    if (!existingDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const updateData = insertDocumentSchema.partial().parse(req.body);
    
    // Create version entry if file is being updated
    if (updateData.fileUrl && updateData.fileUrl !== existingDocument.fileUrl) {
      await storage.createDocumentVersion({
        documentId: id,
        version: updateData.version || existingDocument.version,
        fileUrl: updateData.fileUrl,
        changeLog: req.body.changeLog || 'File updated',
        createdBy: req.user.id,
      });
    }

    const document = await storage.updateDocument(id, updateData);

    console.log('[DOCUMENT UPDATED]', {
      documentId: id,
      updatedBy: req.user.email,
      changes: Object.keys(updateData)
    });

    res.json(document);
  } catch (error) {
    console.error('[DOCUMENT UPDATE ERROR]', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid document data', 
        details: error.errors 
      });
    }

    res.status(500).json({ 
      error: 'Failed to update document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download document with access logging
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await storage.getDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check visibility permissions
    if (!hasDocumentAccess(document, req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Log download
    await storage.createDocumentAccessLog({
      documentId: id,
      userId: req.user.id,
      action: 'DOWNLOAD',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Increment download count
    await storage.updateDocument(id, {
      downloadCount: document.downloadCount + 1
    });

    console.log('[DOCUMENT DOWNLOADED]', {
      documentId: id,
      name: document.name,
      downloadedBy: req.user.email
    });

    res.json({ 
      fileUrl: document.fileUrl,
      fileName: document.originalName 
    });
  } catch (error) {
    console.error('[DOCUMENT DOWNLOAD ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to download document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Acknowledge document (Employee action)
router.post('/:id/acknowledge', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { signature, notes } = req.body;
    
    const document = await storage.getDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if already acknowledged
    const existingAck = await storage.getDocumentAcknowledgment(id, req.user.id);
    if (existingAck) {
      return res.status(409).json({ error: 'Document already acknowledged' });
    }

    const acknowledgment = await storage.createDocumentAcknowledgment({
      documentId: id,
      employeeId: req.user.id,
      signature: signature || `${req.user.firstName} ${req.user.lastName}`,
      notes,
    });

    console.log('[DOCUMENT ACKNOWLEDGED]', {
      documentId: id,
      documentName: document.name,
      acknowledgedBy: req.user.email
    });

    res.status(201).json(acknowledgment);
  } catch (error) {
    console.error('[DOCUMENT ACKNOWLEDGE ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to acknowledge document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get document versions
router.get('/:id/versions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await storage.getDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check visibility permissions
    if (!hasDocumentAccess(document, req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const versions = await storage.getDocumentVersions(id);
    res.json(versions);
  } catch (error) {
    console.error('[DOCUMENT VERSIONS ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to fetch document versions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get document analytics (Admin/Manager only)
router.get('/:id/analytics', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [accessLogs, acknowledgments] = await Promise.all([
      storage.getDocumentAccessLogs(id),
      storage.getDocumentAcknowledgments(id)
    ]);

    const analytics = {
      totalViews: accessLogs.filter(log => log.action === 'VIEW').length,
      totalDownloads: accessLogs.filter(log => log.action === 'DOWNLOAD').length,
      uniqueViewers: new Set(accessLogs.map(log => log.userId)).size,
      acknowledgmentRate: acknowledgments.length, // Could calculate percentage if needed
      recentActivity: accessLogs.slice(0, 10), // Last 10 activities
    };

    res.json(analytics);
  } catch (error) {
    console.error('[DOCUMENT ANALYTICS ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to fetch document analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Sync documents from Google Drive
router.post('/sync-from-drive', requireAuth, requireManager, async (req, res) => {
  try {
    // Initialize the drive service if not already initialized
    await googleDriveService.initialize();
    
    // List files from HR Documents folder
    const files = await googleDriveService.listFiles('HR Documents');
    
    // Process each file
    let syncedCount = 0;
    for (const file of files) {
      // Skip folders
      if (file.mimeType === 'application/vnd.google-apps.folder') continue;
      
      // Check if document already exists by Drive ID
      const existingDoc = await storage.getDocumentByDriveId(file.id);
      
      if (!existingDoc) {
        // Determine category based on folder structure or file name
        let category = 'OTHER';
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes('policy')) category = 'POLICY';
        else if (lowerName.includes('procedure')) category = 'PROCEDURE';
        else if (lowerName.includes('form')) category = 'FORM';
        else if (lowerName.includes('training')) category = 'TRAINING';
        else if (lowerName.includes('contract')) category = 'CONTRACT';
        else if (lowerName.includes('template')) category = 'TEMPLATE';
        else if (lowerName.includes('coi')) category = 'COI';
        
        // Create document entry
        await storage.createDocument({
          name: file.name,
          category,
          description: `Imported from Google Drive on ${new Date().toLocaleDateString()}`,
          content: '',
          visibility: 'ALL',
          status: 'ACTIVE',
          driveFileId: file.id,
          fileUrl: file.webViewLink || '',
          uploadedBy: req.user.id,
          version: 1,
          expirationDate: null
        });
        syncedCount++;
      }
    }
    
    // Get updated documents list
    const documents = await storage.getDocuments({
      userRole: req.user.role
    });
    
    res.json({ 
      message: `Synced ${syncedCount} new documents from Google Drive`,
      newDocuments: syncedCount,
      totalDocuments: documents.length,
      documents 
    });
  } catch (error) {
    console.error('Error syncing from Google Drive:', error);
    res.status(500).json({ error: 'Failed to sync documents from Google Drive' });
  }
});

// Delete document (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await storage.getDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await storage.deleteDocument(id);

    // Log deletion
    await storage.createDocumentAccessLog({
      documentId: id,
      userId: req.user.id,
      action: 'DELETE',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    console.log('[DOCUMENT DELETED]', {
      documentId: id,
      name: document.name,
      deletedBy: req.user.email
    });

    res.status(204).send();
  } catch (error) {
    console.error('[DOCUMENT DELETE ERROR]', error);
    res.status(500).json({ 
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to check document access permissions
function hasDocumentAccess(document: any, userRole: string): boolean {
  switch (document.visibility) {
    case 'PUBLIC':
      return true;
    case 'EMPLOYEE':
      return ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(userRole);
    case 'MANAGER':
      return ['MANAGER', 'ADMIN'].includes(userRole);
    case 'ADMIN':
      return userRole === 'ADMIN';
    default:
      return false;
  }
}

export default router;