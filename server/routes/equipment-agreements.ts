import { Router } from 'express';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { EmailService } from '../email-service';

const router = Router();

// Generate a secure token for public form access
function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================
// Admin Routes (Require Authentication)
// ============================================

// Get all equipment agreements (admin view)
router.get('/api/equipment-agreements', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agreements = await storage.getAllEquipmentAgreements();
    res.json(agreements);
  } catch (error: any) {
    console.error('Error fetching equipment agreements:', error);
    res.status(500).json({ error: 'Failed to fetch equipment agreements' });
  }
});

// Get equipment agreement by ID
router.get('/api/equipment-agreements/:id', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agreement = await storage.getEquipmentAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Equipment agreement not found' });
    }

    res.json(agreement);
  } catch (error: any) {
    console.error('Error fetching equipment agreement:', error);
    res.status(500).json({ error: 'Failed to fetch equipment agreement' });
  }
});

// Create a new equipment agreement (HR sends to employee)
router.post('/api/equipment-agreements', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { employeeId, employeeName, employeeEmail, employeeRole, items, employeeStartDate } = req.body;

    if (!employeeName || !employeeEmail || !items) {
      return res.status(400).json({ error: 'Missing required fields: employeeName, employeeEmail, items' });
    }

    // Generate unique access token
    const accessToken = generateAccessToken();

    // Set token expiry to 30 days from now
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 30);

    const agreement = await storage.createEquipmentAgreement({
      employeeId: employeeId || null,
      employeeName,
      employeeEmail,
      employeeRole: employeeRole || null,
      employeeStartDate: employeeStartDate || null,
      accessToken,
      tokenExpiry,
      items: typeof items === 'string' ? items : JSON.stringify(items),
      status: 'PENDING',
      sentBy: req.user.id,
      sentAt: new Date()
    });

    // Send the equipment agreement email
    const formUrl = `${process.env.APP_URL || 'https://roofhr.up.railway.app'}/equipment-agreement/${accessToken}`;
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    try {
      const emailService = new EmailService();
      await emailService.initialize();
      const emailSent = await emailService.sendEquipmentAgreementEmail(
        employeeName,
        employeeEmail,
        formUrl,
        parsedItems
      );

      if (!emailSent) {
        console.warn(`Equipment agreement created but email failed to send to ${employeeEmail}`);
      }
    } catch (emailError) {
      console.error('Error sending equipment agreement email:', emailError);
      // Don't fail the request if email fails - agreement is still created
    }

    res.status(201).json({
      ...agreement,
      formUrl: `/equipment-agreement/${accessToken}`
    });
  } catch (error: any) {
    console.error('Error creating equipment agreement:', error);
    res.status(500).json({ error: 'Failed to create equipment agreement' });
  }
});

// Update equipment agreement
router.patch('/api/equipment-agreements/:id', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agreement = await storage.getEquipmentAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Equipment agreement not found' });
    }

    const updatedAgreement = await storage.updateEquipmentAgreement(req.params.id, req.body);
    res.json(updatedAgreement);
  } catch (error: any) {
    console.error('Error updating equipment agreement:', error);
    res.status(500).json({ error: 'Failed to update equipment agreement' });
  }
});

// Delete equipment agreement
router.delete('/api/equipment-agreements/:id', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agreement = await storage.getEquipmentAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Equipment agreement not found' });
    }

    await storage.deleteEquipmentAgreement(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting equipment agreement:', error);
    res.status(500).json({ error: 'Failed to delete equipment agreement' });
  }
});

// Resend equipment agreement email
router.post('/api/equipment-agreements/:id/resend', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agreement = await storage.getEquipmentAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Equipment agreement not found' });
    }

    // Generate new token if expired
    let accessToken = agreement.accessToken;
    if (agreement.tokenExpiry && new Date(agreement.tokenExpiry) < new Date()) {
      accessToken = generateAccessToken();
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 30);

      await storage.updateEquipmentAgreement(req.params.id, {
        accessToken,
        tokenExpiry,
        sentAt: new Date()
      });
    } else {
      // Update sentAt even if token is still valid
      await storage.updateEquipmentAgreement(req.params.id, {
        sentAt: new Date()
      });
    }

    // Send the equipment agreement email
    const formUrl = `${process.env.APP_URL || 'https://roofhr.up.railway.app'}/equipment-agreement/${accessToken}`;
    const parsedItems = agreement.items ? (typeof agreement.items === 'string' ? JSON.parse(agreement.items) : agreement.items) : [];

    try {
      const emailService = new EmailService();
      await emailService.initialize();
      const emailSent = await emailService.sendEquipmentAgreementEmail(
        agreement.employeeName,
        agreement.employeeEmail,
        formUrl,
        parsedItems
      );

      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send email' });
      }
    } catch (emailError) {
      console.error('Error sending equipment agreement email:', emailError);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.json({
      success: true,
      message: 'Equipment agreement email sent',
      formUrl: `/equipment-agreement/${accessToken}`
    });
  } catch (error: any) {
    console.error('Error resending equipment agreement:', error);
    res.status(500).json({ error: 'Failed to resend equipment agreement' });
  }
});

// ============================================
// Role Equipment Defaults Routes
// ============================================

// Get all role equipment defaults
router.get('/api/role-equipment-defaults', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const defaults = await storage.getAllRoleEquipmentDefaults();
    res.json(defaults);
  } catch (error: any) {
    console.error('Error fetching role equipment defaults:', error);
    res.status(500).json({ error: 'Failed to fetch role equipment defaults' });
  }
});

// Get equipment defaults for a specific role
router.get('/api/role-equipment-defaults/:role', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const defaults = await storage.getRoleEquipmentDefaultByRole(req.params.role);
    if (!defaults) {
      // Return empty items array if no defaults exist for this role
      return res.json({ role: req.params.role, items: '[]' });
    }

    res.json(defaults);
  } catch (error: any) {
    console.error('Error fetching role equipment defaults:', error);
    res.status(500).json({ error: 'Failed to fetch role equipment defaults' });
  }
});

// Create or update role equipment defaults
router.put('/api/role-equipment-defaults/:role', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only admins can update defaults
    if (!['ADMIN', 'TRUE_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { items } = req.body;
    if (!items) {
      return res.status(400).json({ error: 'Missing required field: items' });
    }

    const itemsString = typeof items === 'string' ? items : JSON.stringify(items);
    const defaults = await storage.upsertRoleEquipmentDefault(req.params.role, itemsString);

    res.json(defaults);
  } catch (error: any) {
    console.error('Error updating role equipment defaults:', error);
    res.status(500).json({ error: 'Failed to update role equipment defaults' });
  }
});

// ============================================
// Public Routes (No Authentication Required)
// ============================================

// Get equipment agreement by token (public form access)
router.get('/api/public/equipment-agreement/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const agreement = await storage.getEquipmentAgreementByToken(token);

    if (!agreement) {
      return res.status(404).json({ error: 'Equipment agreement not found or invalid token' });
    }

    // Check token expiry
    if (agreement.tokenExpiry && new Date(agreement.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This form link has expired' });
    }

    // Check if already signed
    if (agreement.status === 'SIGNED') {
      return res.status(200).json({
        ...agreement,
        alreadySigned: true,
        message: 'This equipment agreement has already been signed'
      });
    }

    // Return agreement data (without sensitive fields)
    res.json({
      id: agreement.id,
      employeeName: agreement.employeeName,
      employeeEmail: agreement.employeeEmail,
      employeeRole: agreement.employeeRole,
      employeeStartDate: agreement.employeeStartDate,
      items: agreement.items,
      status: agreement.status,
      createdAt: agreement.createdAt
    });
  } catch (error: any) {
    console.error('Error fetching equipment agreement by token:', error);
    res.status(500).json({ error: 'Failed to fetch equipment agreement' });
  }
});

// Sign equipment agreement (public form submission)
router.post('/api/public/equipment-agreement/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { signatureData, items } = req.body;

    if (!signatureData) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    const agreement = await storage.getEquipmentAgreementByToken(token);

    if (!agreement) {
      return res.status(404).json({ error: 'Equipment agreement not found or invalid token' });
    }

    // Check token expiry
    if (agreement.tokenExpiry && new Date(agreement.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This form link has expired' });
    }

    // Check if already signed
    if (agreement.status === 'SIGNED') {
      return res.status(400).json({ error: 'This equipment agreement has already been signed' });
    }

    // Check if signing is allowed based on start date
    if (agreement.employeeStartDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(agreement.employeeStartDate);
      startDate.setHours(0, 0, 0, 0);

      if (today < startDate) {
        return res.status(403).json({
          error: 'Cannot sign agreement before your start date',
          startDate: agreement.employeeStartDate,
          message: 'You can view this agreement, but signing will be available on your start date.'
        });
      }
    }

    // Get client IP
    const signatureIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    // Update the agreement with signature and items if provided
    const updateData: any = {
      signatureData,
      signatureIp: typeof signatureIp === 'string' ? signatureIp : signatureIp[0],
      signedAt: new Date(),
      status: 'SIGNED'
    };

    // If items were updated (employee checked which items they received)
    if (items) {
      updateData.items = typeof items === 'string' ? items : JSON.stringify(items);
    }

    const signedAgreement = await storage.updateEquipmentAgreement(agreement.id, updateData);

    res.json({
      success: true,
      message: 'Equipment agreement signed successfully',
      signedAt: signedAgreement.signedAt
    });
  } catch (error: any) {
    console.error('Error signing equipment agreement:', error);
    res.status(500).json({ error: 'Failed to sign equipment agreement' });
  }
});

// ============================================
// Equipment Return Scheduling (for termination)
// ============================================

// Schedule equipment return dropoff (public form)
router.patch('/api/public/equipment-checklist/:token/schedule', async (req, res) => {
  try {
    const { token } = req.params;
    const { scheduledDate, scheduledTime, schedulingNotes } = req.body;

    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({ error: 'Scheduled date and time are required' });
    }

    const checklist = await storage.getEquipmentChecklistByToken(token);

    if (!checklist) {
      return res.status(404).json({ error: 'Equipment checklist not found or invalid token' });
    }

    // Check token expiry
    if (checklist.tokenExpiry && new Date(checklist.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This form link has expired' });
    }

    // Update the checklist with scheduling info
    const updatedChecklist = await storage.updateEquipmentChecklist(checklist.id, {
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      schedulingNotes: schedulingNotes || null
    });

    res.json({
      success: true,
      message: 'Equipment return dropoff scheduled successfully',
      scheduledDate: updatedChecklist.scheduledDate,
      scheduledTime: updatedChecklist.scheduledTime
    });
  } catch (error: any) {
    console.error('Error scheduling equipment return:', error);
    res.status(500).json({ error: 'Failed to schedule equipment return' });
  }
});

// Get pending equipment returns (admin view)
router.get('/api/equipment-checklists/pending-returns', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const checklists = await storage.getAllEquipmentChecklists();

    // Filter for RETURNED type that haven't been signed yet
    const pendingReturns = checklists.filter((c: any) =>
      c.type === 'RETURNED' && c.status === 'PENDING'
    );

    res.json(pendingReturns);
  } catch (error: any) {
    console.error('Error fetching pending returns:', error);
    res.status(500).json({ error: 'Failed to fetch pending returns' });
  }
});

export default router;
