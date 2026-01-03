/**
 * Equipment Receipt Routes
 * API endpoints for creating, viewing, and signing equipment receipts
 */

import express from 'express';
import { equipmentReceiptService } from '../services/equipment-receipt-service';
import { storage } from '../storage';

const router = express.Router();

// Middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireManager(req: any, res: any, next: any) {
  // Ahmed always has manager access (super admin email fallback)
  if (req.user?.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  const managerRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'
  ];

  if (!managerRoles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Manager or admin access required' });
  }
  next();
}

/**
 * Create a new equipment receipt
 * POST /api/equipment-receipts
 */
router.post('/api/equipment-receipts', requireAuth, requireManager, async (req: any, res) => {
  try {
    const { employeeId, employeeName, position, startDate, items } = req.body;

    if (!employeeId || !employeeName || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const receipt = await equipmentReceiptService.createReceipt({
      employeeId,
      employeeName,
      position: position || 'Employee',
      startDate: startDate ? new Date(startDate) : undefined,
      items,
      createdBy: req.user.id,
    });

    res.json(receipt);
  } catch (error: any) {
    console.error('[Equipment Receipt] Create error:', error);
    res.status(500).json({ error: error.message || 'Failed to create receipt' });
  }
});

/**
 * Get a receipt by ID
 * GET /api/equipment-receipts/:id
 */
router.get('/api/equipment-receipts/:id', requireAuth, async (req, res) => {
  try {
    const receipt = await equipmentReceiptService.getReceipt(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json(receipt);
  } catch (error: any) {
    console.error('[Equipment Receipt] Get error:', error);
    res.status(500).json({ error: error.message || 'Failed to get receipt' });
  }
});

/**
 * Get receipts for an employee
 * GET /api/equipment-receipts/employee/:employeeId
 */
router.get('/api/equipment-receipts/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const receipts = await equipmentReceiptService.getEmployeeReceipts(req.params.employeeId);
    res.json(receipts);
  } catch (error: any) {
    console.error('[Equipment Receipt] Get employee receipts error:', error);
    res.status(500).json({ error: error.message || 'Failed to get receipts' });
  }
});

/**
 * Get pending receipts
 * GET /api/equipment-receipts/pending
 */
router.get('/api/equipment-receipts/pending', requireAuth, requireManager, async (req, res) => {
  try {
    const receipts = await equipmentReceiptService.getPendingReceipts();
    res.json(receipts);
  } catch (error: any) {
    console.error('[Equipment Receipt] Get pending error:', error);
    res.status(500).json({ error: error.message || 'Failed to get pending receipts' });
  }
});

/**
 * Sign a receipt
 * PATCH /api/equipment-receipts/:id/sign
 */
router.patch('/api/equipment-receipts/:id/sign', requireAuth, async (req: any, res) => {
  try {
    const { signatureData, trainingAcknowledged } = req.body;

    if (!signatureData) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    // Get client IP
    const signatureIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    const receipt = await equipmentReceiptService.signReceipt(req.params.id, {
      signatureData,
      signatureIp,
      trainingAcknowledged: trainingAcknowledged === true,
    });

    res.json(receipt);
  } catch (error: any) {
    console.error('[Equipment Receipt] Sign error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign receipt' });
  }
});

/**
 * Download receipt PDF
 * GET /api/equipment-receipts/:id/pdf
 */
router.get('/api/equipment-receipts/:id/pdf', requireAuth, async (req, res) => {
  try {
    const receipt = await equipmentReceiptService.getReceipt(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    if (!receipt.pdfUrl) {
      // Generate PDF if not already generated
      const pdfPath = await equipmentReceiptService.generatePDF(receipt);
      return res.redirect(pdfPath);
    }

    res.redirect(receipt.pdfUrl);
  } catch (error: any) {
    console.error('[Equipment Receipt] PDF error:', error);
    res.status(500).json({ error: error.message || 'Failed to get PDF' });
  }
});

// ============================================================================
// PUBLIC TOKEN-BASED SIGNING ROUTES (No Auth Required)
// ============================================================================

/**
 * Get receipt by signing token (PUBLIC - no auth required)
 * Checks if signing is locked (before start date)
 * GET /api/equipment-receipts/token/:token
 */
router.get('/api/equipment-receipts/token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const tokenRecord = await storage.getEquipmentReceiptToken(token);
    if (!tokenRecord) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    // Check if token has expired
    if (new Date() > new Date(tokenRecord.expiresAt)) {
      return res.status(410).json({ error: 'This link has expired. Please contact HR for a new link.' });
    }

    // Check if already signed
    if (tokenRecord.usedAt) {
      return res.status(400).json({ error: 'This equipment receipt has already been signed.' });
    }

    const receipt = await equipmentReceiptService.getReceipt(tokenRecord.receiptId);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Check if signing is locked (before start date)
    const now = new Date();
    const startDate = new Date(tokenRecord.startDate);
    startDate.setHours(0, 0, 0, 0); // Start of day

    if (now < startDate) {
      return res.json({
        locked: true,
        unlockDate: tokenRecord.startDate,
        receipt: receipt,
      });
    }

    return res.json({
      locked: false,
      receipt: receipt,
    });
  } catch (error: any) {
    console.error('[Equipment Receipt] Token get error:', error);
    res.status(500).json({ error: error.message || 'Failed to get receipt' });
  }
});

/**
 * Sign receipt via token (PUBLIC - no auth required)
 * Validates token and date lock before allowing signature
 * POST /api/equipment-receipts/token/:token/sign
 */
router.post('/api/equipment-receipts/token/:token/sign', async (req: any, res) => {
  try {
    const { token } = req.params;
    const { signatureData, trainingAcknowledged } = req.body;

    if (!signatureData) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    const tokenRecord = await storage.getEquipmentReceiptToken(token);
    if (!tokenRecord) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    // Check if token has expired
    if (new Date() > new Date(tokenRecord.expiresAt)) {
      return res.status(410).json({ error: 'This link has expired. Please contact HR for a new link.' });
    }

    // Check if already signed
    if (tokenRecord.usedAt) {
      return res.status(400).json({ error: 'This equipment receipt has already been signed.' });
    }

    // Check date lock
    const now = new Date();
    const startDate = new Date(tokenRecord.startDate);
    startDate.setHours(0, 0, 0, 0);

    if (now < startDate) {
      return res.status(403).json({
        error: `Signing is not available until ${startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`
      });
    }

    // Get client IP
    const signatureIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    // Sign the receipt
    const receipt = await equipmentReceiptService.signReceipt(tokenRecord.receiptId, {
      signatureData,
      signatureIp: typeof signatureIp === 'string' ? signatureIp : signatureIp[0],
      trainingAcknowledged: trainingAcknowledged === true,
    });

    // Mark token as used
    await storage.markEquipmentReceiptTokenUsed(token);

    console.log(`[Equipment Receipt] Signed via token: ${token.substring(0, 8)}... by IP ${signatureIp}`);

    return res.json(receipt);
  } catch (error: any) {
    console.error('[Equipment Receipt] Token sign error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign receipt' });
  }
});

export default router;
