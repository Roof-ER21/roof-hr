import { Router } from 'express';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { EmailService } from '../email-service';
import { SUPER_ADMIN_EMAIL, isAdmin, isManager } from '../../shared/constants/roles';

const router = Router();

// Generate a secure token for public form access
function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── What an authenticated caller may see of an agreement ────────────────────
//
// `accessToken` is the whole authentication for POST /api/public/equipment-
// agreement/:token — anyone holding it can sign as that employee. It must never
// leave the server on a route that is not the one issuing it. `signatureData`
// is the employee's actual signature image and `signatureIp` is their location
// at signing; neither is anyone else's business.
//
// The public GET below already projects a safe subset for exactly this reason.
//
// These fields are NOT stripped unconditionally: the HR view legitimately needs
// all three — `accessToken` backs the "copy form link" button, and the signature
// image and IP are shown in the agreement viewer. So the projection is scoped to
// the caller's authority rather than applied blanket, which keeps that UI intact
// while making the fields unreachable for everyone else.
type AgreementRow = Record<string, any>;

function visibleFields(agreement: AgreementRow, user: AgreementRow): AgreementRow {
  if (canAdministerAgreements(user)) return agreement;
  const { accessToken, signatureData, signatureIp, ...safe } = agreement;
  return { ...safe, isSigned: agreement.status === 'SIGNED' };
}

// Managers and above administer everyone's agreements; everyone else sees only
// the ones addressed to them. `employeeId` is null for agreements sent before a
// candidate became a user, so email is the fallback identity.
function canAdministerAgreements(user: AgreementRow): boolean {
  return user?.email === SUPER_ADMIN_EMAIL || isManager(user?.role) || isAdmin(user);
}

function isOwnAgreement(agreement: AgreementRow, user: AgreementRow): boolean {
  if (agreement.employeeId && agreement.employeeId === user?.id) return true;
  if (!agreement.employeeEmail || !user?.email) return false;
  return agreement.employeeEmail.toLowerCase() === user.email.toLowerCase();
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
    const visible = canAdministerAgreements(req.user)
      ? agreements
      : agreements.filter((a: AgreementRow) => isOwnAgreement(a, req.user));

    res.json(visible.map((a: AgreementRow) => visibleFields(a, req.user)));
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

    if (!canAdministerAgreements(req.user) && !isOwnAgreement(agreement, req.user)) {
      return res.status(404).json({ error: 'Equipment agreement not found' });
    }

    res.json(visibleFields(agreement, req.user));
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
      if (!canAdministerAgreements(req.user)) {
        return res.status(403).json({ error: 'Manager access required' });
      }


      const { employeeId, employeeName, employeeEmail, employeeRole, items, employeeStartDate } = req.body;

      if (!employeeName || !employeeEmail || !items) {
        return res.status(400).json({ error: 'Missing required fields: employeeName, employeeEmail, items' });
      }

      const existingAgreement = await storage.getPendingEquipmentAgreementForEmployee(employeeId, employeeEmail);
      if (existingAgreement) {
        let updatedAgreement = existingAgreement;
        let accessToken = existingAgreement.accessToken;
        const updatePayload: Record<string, any> = {
          sentAt: new Date(),
          employeeRole: employeeRole || existingAgreement.employeeRole,
          employeeStartDate: employeeStartDate || existingAgreement.employeeStartDate,
          items: typeof items === 'string' ? items : JSON.stringify(items),
        };

        if (existingAgreement.tokenExpiry && new Date(existingAgreement.tokenExpiry) < new Date()) {
          accessToken = generateAccessToken();
          const tokenExpiry = new Date();
          tokenExpiry.setDate(tokenExpiry.getDate() + 30);
          updatePayload.accessToken = accessToken;
          updatePayload.tokenExpiry = tokenExpiry;
        } else {
          updatePayload.accessToken = accessToken;
        }

        updatedAgreement = await storage.updateEquipmentAgreement(existingAgreement.id, updatePayload);

        const formUrl = `${process.env.APP_URL || 'https://roofhr.up.railway.app'}/equipment-agreement/${accessToken}`;
        let parsedItems: any[] = [];
        try {
          parsedItems = typeof updatedAgreement.items === 'string'
            ? JSON.parse(updatedAgreement.items)
            : updatedAgreement.items;
        } catch (parseError) {
          console.warn('[Equipment Agreement] Failed to parse items for resend:', parseError);
        }

        try {
          const emailService = new EmailService();
          await emailService.initialize();
          const emailSent = await emailService.sendEquipmentAgreementEmail(
            updatedAgreement.employeeName,
            updatedAgreement.employeeEmail,
            formUrl,
            parsedItems
          );

          if (!emailSent) {
            console.warn(`Equipment agreement reused but email failed to send to ${updatedAgreement.employeeEmail}`);
          }
        } catch (emailError) {
          console.error('Error sending equipment agreement email:', emailError);
        }

        return res.status(200).json({
          ...updatedAgreement,
          formUrl: `/equipment-agreement/${accessToken}`,
          reused: true
        });
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

    if (!canAdministerAgreements(req.user)) {
      return res.status(403).json({ error: 'Manager access required' });
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

    // Deleting someone's signed equipment agreement destroys a record they
    // signed. Managers and above only — an employee may read their own, never
    // remove it.
    if (!canAdministerAgreements(req.user)) {
      return res.status(403).json({ error: 'Manager access required' });
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

    if (!canAdministerAgreements(req.user)) {
      return res.status(403).json({ error: 'Manager access required' });
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

    if (!canAdministerAgreements(req.user)) {
      return res.status(403).json({ error: 'Manager access required' });
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
