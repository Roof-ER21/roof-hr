/**
 * Equipment Receipt Routes
 * API endpoints for creating, viewing, and signing equipment receipts
 */

import express from 'express';
import { equipmentReceiptService } from '../services/equipment-receipt-service';

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

export default router;
