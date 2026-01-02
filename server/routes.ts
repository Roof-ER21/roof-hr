import express from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { storage } from './storage';
import { EmailService } from './email-service';
import { equipmentReceiptService } from './services/equipment-receipt-service';
import { db } from './db';
import { eq, and, ne, or, lte, gte, inArray } from 'drizzle-orm';
import {
  loginSchema, registerSchema, insertPtoRequestSchema,
  insertCandidateSchema, insertInterviewSchema, insertDocumentSchema,
  insertEmployeeReviewSchema, insertTaskSchema, insertCompanySettingsSchema,
  toolInventory, toolAssignments, welcomePackBundles, bundleItems, bundleAssignments, bundleAssignmentItems,
  ptoRequests, users, companyPtoPolicy, departmentPtoSettings, ptoPolicies, candidates
} from '../shared/schema';
import { PTO_APPROVER_EMAILS, getPTOApproversForEmployee, ADMIN_ROLES, MANAGER_ROLES, isLeadSourcer } from '../shared/constants/roles';
import { PTO_POLICY, getPtoAllocation } from '../shared/constants/pto-policy';
import agentRoutes from './routes/agents';
import emailRoutes from './routes/emails';
import googleAuthRoutes from './routes/google-auth';
import recruitmentBotRoutes from './routes/recruitment-bot';
import chatbotRoutes from './routes/chatbot';
import jobPostingRoutes from './routes/job-postings';
import candidateImportRoutes from './routes/candidate-import';
import interviewSchedulingRoutes from './routes/interview-scheduling';
import emailCampaignRoutes from './routes/email-campaigns';
import workflowRoutes from './routes/workflows';
import aiEnhancementRoutes from './routes/ai-enhancement';
import analyticsRoutes from './routes/analytics';
import toolsRoutes from './routes/tools';
import testFeaturesRoutes from './routes/test-features';
import emailTemplateRoutes from './routes/email-templates';
import emailAIRoutes from './routes/email-ai';
import territoryRoutes from './routes/territories';
import ptoPolicyRoutes from './routes/pto-policies';
import coiDocumentRoutes from './routes/coi-documents';
import employeeAssignmentRoutes from './routes/employee-assignments';
import contractRoutes from './routes/contracts';
import sourcerAssignmentRoutes from './routes/sourcer-assignments';
import susanAIRoutes from './routes/susan-ai';
import googleServicesRoutes from './routes/google-services';
import googleSyncRoutes from './routes/google-sync';
import testHarmonyRoutes from './routes/test-harmony';
import llmStatusRoutes from './routes/llm-status';
import documentRoutes from './routes/documents';
import interviewRoutes from './routes/interviews';
import aiCriteriaRoutes from './routes/ai-criteria';
import googleDriveUploadRoutes from './routes/google-drive-uploads';
import attendanceRoutes from './routes/attendance';
import equipmentReceiptRoutes from './routes/equipment-receipts';
import employeePortalRoutes from './routes/employee-portal';
import equipmentAgreementRoutes from './routes/equipment-agreements';
import recruitingAnalyticsRoutes from './routes/recruiting-analytics';
import superAdminRoutes from './routes/super-admin';
import emailPreferencesRoutes from './routes/email-preferences';
import candidateImportLogsRoutes from './routes/candidate-import-logs';
import aiEvaluationsRoutes from './routes/ai-evaluations';
import recruitmentBotConversationsRoutes from './routes/recruitment-bot-conversations';
import agentInteractionsRoutes from './routes/agent-interactions';
import onboardingTemplatesRoutes from './routes/onboarding-templates';
import scheduledReportsRoutes from './routes/scheduled-reports';
import meetingRoomsRoutes from './routes/meeting-rooms';
import meetingsRoutes from './routes/meetings';
import { apiMetricsMiddleware } from './middleware/api-metrics';
import { googleDriveService } from './services/google-drive-service';
import { googleCalendarService } from './services/google-calendar-service';
import { serviceAccountAuth } from './services/service-account-auth';

const router = express.Router();

// Helper functions
function generateSessionToken(): string {
  return uuidv4() + '-' + Date.now();
}

function getSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

// Middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireManager(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has manager access (super admin email fallback)
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  // Check if user has manager-level role (includes all new and legacy roles)
  const managerRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'  // Legacy
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
}

// Middleware for bulk candidate operations - includes LEAD_SOURCER (Ryan)
function requireManagerOrLeadSourcer(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has access
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  // Lead sourcers (Ryan) can perform bulk candidate actions
  if (isLeadSourcer(req.user)) {
    return next();
  }

  // Check manager roles
  const managerRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or Lead Sourcer access required' });
  }

  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has admin access (super admin email fallback)
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  // Check if user has admin-level role (includes new and legacy roles)
  const adminRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'TRUE_ADMIN', 'ADMIN'];

  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Authentication middleware
router.use(async (req: any, res, next) => {
  // First check for Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const session = await storage.getSessionByToken(token);
      if (session && new Date(session.expiresAt) > new Date()) {
        const user = await storage.getUserById(session.userId);
        if (user) {
          req.user = user;
          return next();
        }
      }
    } catch (error) {
      // Invalid token, continue without user
    }
  }
  
  // Check for session-based authentication (from login)
  if (req.session && req.session.userId) {
    try {
      const user = await storage.getUserById(req.session.userId);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Session user not found
    }
  }
  
  next();
});

// Health check endpoint
router.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: 'v2.2.0' });
});

// ===== PUBLIC ROUTES (No Authentication Required) =====

// Get equipment checklist by token (public access)
router.get('/api/public/equipment-checklist/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const checklist = await storage.getEquipmentChecklistByToken(token);

    if (!checklist) {
      return res.status(404).json({ error: 'Equipment checklist not found or invalid token' });
    }

    // Check token expiry if set
    if (checklist.tokenExpiry && new Date(checklist.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This form link has expired' });
    }

    // Return checklist data (exclude internal fields)
    res.json({
      id: checklist.id,
      employeeName: checklist.employeeName,
      employeeEmail: checklist.employeeEmail,
      type: checklist.type,
      status: checklist.status,
      // Pre-fill existing selections if any
      grayPoloReceived: checklist.grayPoloReceived,
      blackPoloReceived: checklist.blackPoloReceived,
      grayZipReceived: checklist.grayZipReceived,
      blackZipReceived: checklist.blackZipReceived,
      clothingOther: checklist.clothingOther,
      clothingNone: checklist.clothingNone,
      ipadWithKeyboardReceived: checklist.ipadWithKeyboardReceived,
      flashlightSetReceived: checklist.flashlightSetReceived,
      ladderReceived: checklist.ladderReceived,
      ipadOnlyReceived: checklist.ipadOnlyReceived,
      keyboardOnlyReceived: checklist.keyboardOnlyReceived,
      flashlightOnlyReceived: checklist.flashlightOnlyReceived,
      materialsOther: checklist.materialsOther,
      materialsNone: checklist.materialsNone,
      signedAt: checklist.signedAt,
      itemsNotReturned: checklist.itemsNotReturned,
    });
  } catch (error) {
    console.error('Error fetching equipment checklist:', error);
    res.status(500).json({ error: 'Failed to fetch equipment checklist' });
  }
});

// Submit equipment checklist (public access)
router.post('/api/public/equipment-checklist/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const checklist = await storage.getEquipmentChecklistByToken(token);

    if (!checklist) {
      return res.status(404).json({ error: 'Equipment checklist not found or invalid token' });
    }

    // Check token expiry if set
    if (checklist.tokenExpiry && new Date(checklist.tokenExpiry) < new Date()) {
      return res.status(410).json({ error: 'This form link has expired' });
    }

    // Check if already signed
    if (checklist.status === 'SIGNED') {
      return res.status(400).json({ error: 'This checklist has already been signed' });
    }

    const {
      grayPoloReceived,
      blackPoloReceived,
      grayZipReceived,
      blackZipReceived,
      clothingOther,
      clothingNone,
      ipadWithKeyboardReceived,
      flashlightSetReceived,
      ladderReceived,
      ipadOnlyReceived,
      keyboardOnlyReceived,
      flashlightOnlyReceived,
      materialsOther,
      materialsNone,
      signatureData,
      itemsNotReturned,
    } = req.body;

    // Validate signature is provided
    if (!signatureData) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    // Get client IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    // Update the checklist with form data
    const updatedChecklist = await storage.updateEquipmentChecklist(checklist.id, {
      grayPoloReceived: grayPoloReceived || false,
      blackPoloReceived: blackPoloReceived || false,
      grayZipReceived: grayZipReceived || false,
      blackZipReceived: blackZipReceived || false,
      clothingOther: clothingOther || null,
      clothingNone: clothingNone || false,
      ipadWithKeyboardReceived: ipadWithKeyboardReceived || false,
      flashlightSetReceived: flashlightSetReceived || false,
      ladderReceived: ladderReceived || false,
      ipadOnlyReceived: ipadOnlyReceived || false,
      keyboardOnlyReceived: keyboardOnlyReceived || false,
      flashlightOnlyReceived: flashlightOnlyReceived || false,
      materialsOther: materialsOther || null,
      materialsNone: materialsNone || false,
      signatureData,
      signedAt: new Date(),
      signatureIp: Array.isArray(clientIp) ? clientIp[0] : clientIp,
      itemsNotReturned: itemsNotReturned || null,
      status: 'SIGNED',
    });

    // If this is for a RETURNED type, update the termination reminder
    if (checklist.type === 'RETURNED' && checklist.employeeId) {
      const reminder = await storage.getTerminationReminderByEmployee(checklist.employeeId);
      if (reminder) {
        // Mark as items returned if nothing is listed as not returned
        const itemsReturned = !itemsNotReturned || itemsNotReturned.trim() === '';
        await storage.updateTerminationReminder(reminder.id, {
          itemsReturned,
          resolvedAt: itemsReturned ? new Date() : null,
        });
      }
    }

    res.json({
      success: true,
      message: 'Equipment checklist submitted successfully',
      checklist: {
        id: updatedChecklist.id,
        status: updatedChecklist.status,
        signedAt: updatedChecklist.signedAt,
      }
    });
  } catch (error) {
    console.error('Error submitting equipment checklist:', error);
    res.status(500).json({ error: 'Failed to submit equipment checklist' });
  }
});

// ===== END PUBLIC ROUTES =====

// Auth routes
router.post('/api/auth/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Validate email domain - only @theroofdocs.com allowed
    const ALLOWED_DOMAIN = 'theroofdocs.com';
    const emailDomain = data.email.split('@')[1]?.toLowerCase();
    if (emailDomain !== ALLOWED_DOMAIN) {
      return res.status(403).json({
        error: 'Only @theroofdocs.com email addresses can be registered'
      });
    }

    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Store the temporary password to send in the email
    const temporaryPassword = data.password;
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const user = await storage.createUser({
      ...data,
      passwordHash: hashedPassword,
      isActive: true,
      mustChangePassword: true, // New employees should change password on first login
    });

    // Initialize email service and send welcome email
    const emailService = new EmailService();
    await emailService.initialize();
    const emailSent = await emailService.sendWelcomeEmail(user, temporaryPassword);
    
    if (!emailSent) {
      console.warn('Failed to send welcome email to:', user.email);
    }

    const token = generateSessionToken();
    await storage.createSession({
      userId: user.id,
      token,
      expiresAt: getSessionExpiry(),
    });
    
    // Also set the session for cookie-based auth
    (req as any).session.userId = user.id;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employmentType: user.employmentType,
        department: user.department,
        position: user.position,
        hireDate: user.hireDate,
        phone: user.phone,
        address: user.address,
        emergencyContact: user.emergencyContact,
        emergencyPhone: user.emergencyPhone,
        shirtSize: user.shirtSize,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
      token,
      emailSent,
      message: emailSent 
        ? 'Employee created successfully. Welcome email sent to ' + user.email
        : 'Employee created successfully. Failed to send welcome email.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

router.post('/api/auth/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    // Validate email domain - only @theroofdocs.com allowed
    const ALLOWED_DOMAIN = 'theroofdocs.com';
    const emailDomain = data.email.split('@')[1]?.toLowerCase();
    if (emailDomain !== ALLOWED_DOMAIN) {
      return res.status(403).json({
        error: 'Access restricted to @theroofdocs.com email addresses only'
      });
    }

    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check for corrupted user record (missing password hash)
    if (!user.passwordHash) {
      console.error('[Login] User has no password hash:', user.email);
      return res.status(400).json({ error: 'Account error. Please contact support to reset your password.' });
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateSessionToken();
    await storage.createSession({
      userId: user.id,
      token,
      expiresAt: getSessionExpiry(),
    });

    // Also set the session for cookie-based auth
    (req as any).session.userId = user.id;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employmentType: user.employmentType,
        department: user.department,
        position: user.position,
        mustChangePassword: user.mustChangePassword,
      },
      token,
    });
  } catch (error: any) {
    console.error('[Login] Error:', error?.message || error);
    if (error?.name === 'ZodError' || error?.issues) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/api/auth/logout', requireAuth, async (req: any, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = await storage.getSessionByToken(token);
    if (session) {
      await storage.deleteSession(session.id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Change password endpoint
router.post('/api/auth/change-password', requireAuth, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    
    const user = await storage.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await storage.updateUser(user.id, {
      passwordHash: hashedPassword,
      mustChangePassword: false,
      lastPasswordChange: new Date()
    });
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get current user info - alias for /api/auth/validate
router.get('/api/auth/me', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employmentType: user.employmentType,
      department: user.department,
      position: user.position,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    res.status(401).json({ error: 'Failed to get user info' });
  }
});

router.get('/api/auth/validate', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const session = await storage.getSessionByToken(token);
    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await storage.getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employmentType: user.employmentType,
      department: user.department,
      position: user.position,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    res.status(401).json({ error: 'Token validation failed' });
  }
});

// Clear rate limit endpoint (Admin only)
router.post('/api/auth/clear-rate-limit', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { clearRateLimit } = await import('./middleware/security');
    const { ip } = req.body;

    clearRateLimit(ip);

    res.json({
      success: true,
      message: `Rate limit cleared for ${ip || 'all IPs'}`
    });
  } catch (error) {
    console.error('Error clearing rate limit:', error);
    res.status(500).json({ error: 'Failed to clear rate limit' });
  }
});

// Clear all COI documents (Admin only)
router.delete('/api/admin/clear-coi-documents', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const count = await storage.clearAllCoiDocuments();
    res.json({
      success: true,
      message: `Cleared ${count} COI documents`
    });
  } catch (error) {
    console.error('Error clearing COI documents:', error);
    res.status(500).json({ error: 'Failed to clear COI documents' });
  }
});

// Clear all tool assignments (Admin only)
router.delete('/api/admin/clear-tool-assignments', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const count = await storage.clearAllToolAssignments();
    res.json({
      success: true,
      message: `Cleared ${count} tool assignments`
    });
  } catch (error) {
    console.error('Error clearing tool assignments:', error);
    res.status(500).json({ error: 'Failed to clear tool assignments' });
  }
});

// Update all PTO allocations to company standard (Admin only)
router.post('/api/admin/update-pto-allocations', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    // Use centralized PTO policy constants
    const { DEFAULT_VACATION_DAYS, DEFAULT_SICK_DAYS, DEFAULT_PERSONAL_DAYS, DEFAULT_TOTAL_DAYS } = PTO_POLICY;
    const results = { companyUpdated: false, deptCount: 0, policyCount: 0, created: 0 };

    // 1. Update company policy
    const existingPolicy = await db.select().from(companyPtoPolicy).limit(1);
    if (existingPolicy.length > 0) {
      await db.update(companyPtoPolicy).set({
        vacationDays: DEFAULT_VACATION_DAYS, sickDays: DEFAULT_SICK_DAYS, personalDays: DEFAULT_PERSONAL_DAYS, totalDays: DEFAULT_TOTAL_DAYS, updatedAt: new Date()
      }).where(eq(companyPtoPolicy.id, existingPolicy[0].id));
      results.companyUpdated = true;
    }

    // 2. Update department settings
    const deptSettings = await db.select().from(departmentPtoSettings);
    for (const dept of deptSettings) {
      await db.update(departmentPtoSettings).set({
        vacationDays: DEFAULT_VACATION_DAYS, sickDays: DEFAULT_SICK_DAYS, personalDays: DEFAULT_PERSONAL_DAYS, totalDays: DEFAULT_TOTAL_DAYS, updatedAt: new Date()
      }).where(eq(departmentPtoSettings.id, dept.id));
      results.deptCount++;
    }

    // 3. Update individual policies
    const policies = await db.select().from(ptoPolicies);
    for (const policy of policies) {
      const newRemaining = Math.max(0, DEFAULT_TOTAL_DAYS - (policy.usedDays || 0));
      await db.update(ptoPolicies).set({
        vacationDays: DEFAULT_VACATION_DAYS, sickDays: DEFAULT_SICK_DAYS, personalDays: DEFAULT_PERSONAL_DAYS,
        baseDays: DEFAULT_TOTAL_DAYS, totalDays: DEFAULT_TOTAL_DAYS, remainingDays: newRemaining, updatedAt: new Date()
      }).where(eq(ptoPolicies.id, policy.id));
      results.policyCount++;
    }

    res.json({
      success: true,
      message: `PTO allocations updated to ${DEFAULT_VACATION_DAYS}/${DEFAULT_SICK_DAYS}/${DEFAULT_PERSONAL_DAYS} standard (${DEFAULT_TOTAL_DAYS} total days)`,
      details: results
    });
  } catch (error: any) {
    console.error('Error updating PTO allocations:', error);
    res.status(500).json({ error: 'Failed to update PTO allocations', details: error.message });
  }
});

// Admin can create PTO on behalf of employees
router.post('/api/admin/create-pto-for-employee', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const adminUser = req.user!;
    const { employeeId, startDate, endDate, type, reason, autoApprove } = req.body;

    // Validate required fields
    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({ error: 'employeeId, startDate, and endDate are required' });
    }

    // Get the employee
    const employee = await storage.getUserById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Calculate days - parse as local date (not UTC) to avoid off-by-one errors
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const diffTime = end.getTime() - start.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Create the PTO request
    const ptoRequest = await storage.createPtoRequest({
      employeeId,
      startDate,
      endDate,
      type: type || 'VACATION',
      reason: reason || `Created by admin: ${adminUser.firstName} ${adminUser.lastName}`,
      days,
      status: autoApprove ? 'APPROVED' : 'PENDING',
    });

    console.log(`[ADMIN-PTO] ${adminUser.email} created PTO for ${employee.firstName} ${employee.lastName}: ${startDate} to ${endDate} (${days} days, autoApprove=${autoApprove})`);

    // If auto-approved, update the employee's PTO policy and create calendar events
    if (autoApprove) {
      // Update employee's PTO policy
      const policy = await storage.getPtoPolicyByEmployeeId(employeeId);
      if (policy) {
        const usedDays = (policy.usedDays || 0) + days;
        const remainingDays = Math.max(0, (policy.totalDays || 0) - usedDays);

        await db.update(ptoPolicies).set({
          usedDays,
          remainingDays,
          updatedAt: new Date()
        }).where(eq(ptoPolicies.id, policy.id));
      }

      // Create Google Calendar events asynchronously
      (async () => {
        try {
          if (googleCalendarService.isConfigured()) {
            // Create event on employee's calendar
            await googleCalendarService.createEvent({
              summary: `PTO - ${employee.firstName} ${employee.lastName}`,
              description: `PTO approved by admin: ${adminUser.firstName} ${adminUser.lastName}\nReason: ${reason || 'Not specified'}`,
              startDate,
              endDate,
              attendees: [employee.email],
              isAllDay: true
            }, employee.email);

            // Create event on shared HR calendar
            const hrCalendarId = process.env.GOOGLE_HR_CALENDAR_ID || 'primary';
            await googleCalendarService.createEvent({
              summary: `PTO - ${employee.firstName} ${employee.lastName}`,
              description: `${days} day(s) PTO\nCreated by: ${adminUser.firstName} ${adminUser.lastName}`,
              startDate,
              endDate,
              attendees: [],
              isAllDay: true
            }, hrCalendarId);
          }
        } catch (calErr) {
          console.error('[ADMIN-PTO] Failed to create calendar events:', calErr);
        }
      })();

      // Send notification to employee
      (async () => {
        try {
          const emailService = new EmailService();
          await emailService.initialize();
          await emailService.sendEmail({
            to: employee.email,
            subject: `PTO Approved: ${startDate} to ${endDate}`,
            html: `
              <h2>Your PTO Has Been Approved</h2>
              <p>Hi ${employee.firstName},</p>
              <p>PTO has been scheduled for you by ${adminUser.firstName} ${adminUser.lastName}:</p>
              <ul>
                <li><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString()}</li>
                <li><strong>End Date:</strong> ${new Date(endDate).toLocaleDateString()}</li>
                <li><strong>Days:</strong> ${days}</li>
                <li><strong>Type:</strong> ${type || 'VACATION'}</li>
              </ul>
              <p>Calendar events have been created automatically.</p>
              <p>Best regards,<br>HR Team</p>
            `,
            fromUserEmail: adminUser.email.endsWith('@theroofdocs.com') ? adminUser.email : 'info@theroofdocs.com'
          });
        } catch (emailErr) {
          console.error('[ADMIN-PTO] Failed to send notification email:', emailErr);
        }
      })();
    }

    res.json({
      success: true,
      ptoRequest,
      message: autoApprove
        ? `PTO created and auto-approved for ${employee.firstName} ${employee.lastName}`
        : `PTO created for ${employee.firstName} ${employee.lastName} (pending approval)`
    });
  } catch (error: any) {
    console.error('[ADMIN-PTO] Error creating PTO for employee:', error);
    res.status(500).json({ error: 'Failed to create PTO', details: error.message });
  }
});

// Clear all DENIED and APPROVED PTO requests (Admin only) - for fresh start
router.delete('/api/admin/clear-pto', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const adminUser = req.user!;
    console.log(`[ADMIN-PTO] ${adminUser.email} is clearing all DENIED and APPROVED PTO requests`);

    // Delete all PTO requests that are DENIED or APPROVED (keep PENDING)
    const result = await db.delete(ptoRequests)
      .where(or(
        eq(ptoRequests.status, 'DENIED'),
        eq(ptoRequests.status, 'APPROVED')
      ));

    console.log(`[ADMIN-PTO] Cleared PTO requests`);

    res.json({
      success: true,
      message: 'All DENIED and APPROVED PTO requests have been cleared. PENDING requests were preserved.'
    });
  } catch (error: any) {
    console.error('[ADMIN-PTO] Error clearing PTO:', error);
    res.status(500).json({ error: 'Failed to clear PTO', details: error.message });
  }
});

// Reset Sales Reps and 1099 employees to 0 PTO (Admin only)
router.post('/api/admin/reset-sales-1099-pto', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const results = { salesReset: 0, contractors1099Reset: 0, policiesDeleted: 0 };

    // Get all users who are sales reps or 1099 contractors
    const allUsers = await storage.getAllUsers();
    const salesAnd1099Users = allUsers.filter(user =>
      user.employmentType === '1099' ||
      user.role === 'SALES_REP' ||
      user.department === 'Sales'
    );

    console.log(`[PTO Reset] Found ${salesAnd1099Users.length} sales/1099 users to reset`);

    for (const user of salesAnd1099Users) {
      // Check if this user has a PTO policy
      const policy = await storage.getPtoPolicyByEmployeeId(user.id);

      if (policy) {
        // Update to 0 PTO
        await db.update(ptoPolicies).set({
          vacationDays: 0,
          sickDays: 0,
          personalDays: 0,
          baseDays: 0,
          totalDays: 0,
          remainingDays: 0,
          notes: `Reset to 0 PTO - ${user.employmentType === '1099' ? '1099 contractor' : 'Sales rep'} - ${new Date().toISOString().split('T')[0]}`,
          updatedAt: new Date()
        }).where(eq(ptoPolicies.id, policy.id));

        if (user.employmentType === '1099') {
          results.contractors1099Reset++;
        } else {
          results.salesReset++;
        }
        console.log(`[PTO Reset] Reset ${user.firstName} ${user.lastName} (${user.employmentType}) to 0 PTO`);
      }
    }

    res.json({
      success: true,
      message: `Sales reps and 1099 contractors reset to 0 PTO`,
      details: results,
      usersProcessed: salesAnd1099Users.map(u => `${u.firstName} ${u.lastName} (${u.employmentType})`)
    });
  } catch (error: any) {
    console.error('Error resetting sales/1099 PTO:', error);
    res.status(500).json({ error: 'Failed to reset sales/1099 PTO', details: error.message });
  }
});

// User routes
router.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    const safeUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employmentType: user.employmentType,
      department: user.department,
      position: user.position,
      hireDate: user.hireDate,
      isActive: user.isActive,
      phone: user.phone,
      createdAt: user.createdAt,
    }));
    res.json(safeUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/api/users/:id', requireAuth, requireManager, async (req, res) => {
  try {
    // Get current user to check if terminationDate is being set
    const currentUser = await storage.getUser(req.params.id);
    const isTerminating = req.body.terminationDate && !currentUser?.terminationDate;

    const user = await storage.updateUser(req.params.id, req.body);
    const { passwordHash, ...safeUser } = user;

    // Auto-trigger termination workflow if terminationDate is being set for the first time
    if (isTerminating && user.email) {
      try {
        console.log(`[Termination] Auto-triggering workflow for ${user.firstName} ${user.lastName}`);

        // Create equipment return checklist
        const accessToken = uuidv4();
        const checklist = await storage.createEquipmentChecklist({
          employeeId: user.id,
          employeeName: `${user.firstName} ${user.lastName}`,
          employeeEmail: user.email,
          accessToken,
          type: 'RETURNED',
          status: 'PENDING',
        });

        // Create termination reminder linked to checklist
        const reminder = await storage.createTerminationReminder({
          employeeId: user.id,
          employeeName: `${user.firstName} ${user.lastName}`,
          employeeEmail: user.email,
          terminationDate: new Date(req.body.terminationDate),
          equipmentChecklistId: checklist.id,
          formSentAt: new Date(),
        });

        // Send equipment return email
        const baseUrl = process.env.APP_URL || 'http://localhost:5050';
        const scheduleUrl = `${baseUrl}/equipment-return/${accessToken}`;
        const checklistUrl = `${baseUrl}/equipment-checklist/${accessToken}`;

        const emailService = new EmailService();
        await emailService.initialize();

        const termDate = new Date(req.body.terminationDate);
        const formattedTermDate = termDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        await emailService.sendEmail({
          to: user.email,
          cc: ['careers@theroofdocs.com', 'support@theroofdocs.com'],
          subject: 'Equipment Return Required - Schedule Your Dropoff',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
              <div style="background-color: #1e3a5f; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Return Required</h1>
              </div>

              <div style="padding: 30px;">
                <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello ${user.firstName},</p>

                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  As part of your offboarding process (effective ${formattedTermDate}), you are required to return all company equipment.
                </p>

                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                  <strong style="color: #92400e;">⚠️ Important:</strong>
                  <p style="margin: 10px 0 0 0; color: #78350f;">
                    All equipment must be returned within <strong>15 days</strong> of your termination date.
                    Unreturned items will result in paycheck deductions per the equipment agreement you signed.
                  </p>
                </div>

                <h3 style="color: #1e3a5f; margin-top: 25px;">Step 1: Schedule Your Dropoff</h3>
                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  Select a convenient date and time to drop off your equipment at the office.
                </p>
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${scheduleUrl}"
                     style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px;
                            text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    📅 Schedule Dropoff Time
                  </a>
                </div>

                <h3 style="color: #1e3a5f; margin-top: 25px;">Step 2: Bring Your Equipment</h3>
                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  On your scheduled day, bring all company equipment to the office.
                </p>

                <h3 style="color: #1e3a5f; margin-top: 25px;">Step 3: Sign Equipment Return Form</h3>
                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  After returning your items, complete the equipment return checklist.
                </p>
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${checklistUrl}"
                     style="display: inline-block; background-color: #059669; color: white; padding: 14px 28px;
                            text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    ✅ Complete Return Checklist
                  </a>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

                <p style="font-size: 13px; color: #666;">
                  <strong>Schedule Link:</strong> <a href="${scheduleUrl}" style="color: #2563eb;">${scheduleUrl}</a><br>
                  <strong>Checklist Link:</strong> <a href="${checklistUrl}" style="color: #059669;">${checklistUrl}</a>
                </p>

                <p style="font-size: 15px; line-height: 1.7; color: #333; margin-top: 20px;">
                  If you have any questions, please contact HR at careers@theroofdocs.com
                </p>

                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  Thank you,<br>
                  <strong>Roof-ER HR Team</strong>
                </p>
              </div>

              <div style="background-color: #f9fafb; padding: 15px; text-align: center;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                  This is an automated message from the Roof-ER HR system.
                </p>
              </div>
            </div>
          `,
        });

        console.log(`[Termination] Equipment return email sent to ${user.email}`);
      } catch (termError) {
        console.error('[Termination] Error triggering workflow:', termError);
        // Don't fail the user update if termination workflow fails
      }
    }

    res.json(safeUser);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update user' });
  }
});

// Reset employee password (Admin/Manager only)
router.post('/api/users/:id/reset-password', requireAuth, requireManager, async (req, res) => {
  try {
    const { temporaryPassword } = req.body;
    
    if (!temporaryPassword || temporaryPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    
    const user = await storage.updateUser(req.params.id, {
      passwordHash: hashedPassword,
      mustChangePassword: true
    });
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully. Employee must change password on next login.' 
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to reset password' });
  }
});

// Delete employee (Admin/Manager only)
router.delete('/api/users/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent self-deletion
    if ((req as any).user.id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await storage.deleteUser(userId);
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(400).json({ error: 'Failed to delete employee' });
  }
});

// Export employees to CSV
router.get('/api/users/export', requireAuth, requireManager, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    
    // Create CSV header
    const headers = [
      'First Name', 'Last Name', 'Email', 'Department', 'Position', 
      'Role', 'Employment Type', 'Hire Date', 'Termination Date', 
      'Status', 'Phone', 'Address', 'Emergency Contact', 'Emergency Phone'
    ];
    
    // Create CSV rows
    const rows = users.map(user => [
      user.firstName,
      user.lastName,
      user.email,
      user.department,
      user.position,
      user.role,
      user.employmentType,
      user.hireDate,
      user.terminationDate || '',
      user.isActive ? 'Active' : 'Inactive',
      user.phone || '',
      user.address || '',
      user.emergencyContact || '',
      user.emergencyPhone || ''
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export employees' });
  }
});

// Import employees from CSV
router.post('/api/users/import', requireAuth, requireManager, async (req, res) => {
  try {
    const { data } = req.body; // Expecting parsed CSV data as array of objects
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid import data' });
    }
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const row of data) {
      try {
        // Generate temporary password
        const tempPassword = `Welcome${new Date().getFullYear()}!`;
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await storage.createUser({
          email: row.email,
          firstName: row.firstName || row['First Name'],
          lastName: row.lastName || row['Last Name'],
          role: (row.role || row['Role'] || 'EMPLOYEE').toUpperCase() as any,
          employmentType: (row.employmentType || row['Employment Type'] || 'W2').toUpperCase() as any,
          department: row.department || row['Department'] || 'General',
          position: row.position || row['Position'] || 'Employee',
          hireDate: row.hireDate || row['Hire Date'] || new Date().toISOString().split('T')[0],
          terminationDate: row.terminationDate || row['Termination Date'] || null,
          isActive: row.terminationDate ? false : true,
          phone: row.phone || row['Phone'] || null,
          address: row.address || row['Address'] || null,
          emergencyContact: row.emergencyContact || row['Emergency Contact'] || null,
          emergencyPhone: row.emergencyPhone || row['Emergency Phone'] || null,
          passwordHash: hashedPassword,
          mustChangePassword: true
        });
        
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row ${data.indexOf(row) + 1}: ${error.message}`);
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import employees' });
  }
});

// Bulk import TheRoofDocs employees with Google Drive folders and PTO policies
router.post('/api/users/bulk-import-theroofdocs', requireAuth, requireManager, async (req, res) => {
  try {
    const { employees, createDriveFolders = true, createPtoPolicies = true, notifyHR = true } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Invalid employees data' });
    }

    // Role mapping helper
    const mapRoleToSystem = (position: string): string => {
      const posLower = position.toLowerCase();
      if (posLower === 'admin') return 'ADMIN';
      if (posLower === 'sales manager') return 'TERRITORY_SALES_MANAGER';
      if (['ops manager', 'hr director', 'production manager'].includes(posLower)) return 'MANAGER';
      if (posLower === 'sales rep') return 'SALES_REP';
      if (posLower === 'field tech') return 'FIELD_TECH';
      return 'EMPLOYEE';
    };

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      created: [] as any[],
      errors: [] as string[],
      skippedEmails: [] as string[]
    };

    for (const emp of employees) {
      try {
        // Check for duplicate
        const existing = await storage.getUserByEmail(emp.email.toLowerCase());
        if (existing) {
          results.skipped++;
          results.skippedEmails.push(emp.email);
          continue;
        }

        // Custom password handling
        let tempPassword = 'Susan2025';
        if (emp.email.toLowerCase() === 'ahmed.mahmoud@theroofdocs.com') {
          tempPassword = 'Roofer21!';
        }
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Map role from position
        const systemRole = mapRoleToSystem(emp.position);

        // Create user
        const newUser = await storage.createUser({
          email: emp.email.toLowerCase(),
          firstName: emp.firstName,
          lastName: emp.lastName,
          role: systemRole as any,
          employmentType: 'W2' as any,
          department: emp.department || 'General',
          position: emp.position,
          hireDate: new Date().toISOString().split('T')[0],
          isActive: true,
          phone: emp.phone || null,
          passwordHash: hashedPassword,
          mustChangePassword: true
        });

        // Create Google Drive folder
        if (createDriveFolders) {
          try {
            const { googleSyncEnhanced } = await import('./services/google-sync-enhanced');
            await googleSyncEnhanced.getOrCreateEmployeeFolder(newUser);
          } catch (driveError: any) {
            console.error(`Drive folder creation failed for ${emp.email}:`, driveError.message);
          }
        }

        // Create PTO policy based on employment type and department
        if (createPtoPolicies) {
          try {
            const ptoAllocation = getPtoAllocation(newUser.employmentType, newUser.department);
            await storage.createPtoPolicy({
              employeeId: newUser.id,
              policyLevel: 'COMPANY',
              vacationDays: ptoAllocation.vacationDays,
              sickDays: ptoAllocation.sickDays,
              personalDays: ptoAllocation.personalDays,
              baseDays: ptoAllocation.totalDays,
              additionalDays: 0,
              totalDays: ptoAllocation.totalDays,
              usedDays: 0,
              remainingDays: ptoAllocation.totalDays,
              notes: ptoAllocation.totalDays === 0 ? 'No PTO (1099/Sales)' : 'Initial PTO allocation'
            });
          } catch (ptoError: any) {
            console.error(`PTO policy creation failed for ${emp.email}:`, ptoError.message);
          }
        }

        results.success++;
        results.created.push({
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: systemRole,
          position: emp.position
        });

      } catch (error: any) {
        results.failed++;
        results.errors.push(`${emp.email}: ${error.message}`);
      }
    }

    // Send notification to HR if requested
    if (notifyHR && results.success > 0) {
      try {
        const emailService = new EmailService();
        await emailService.initialize();

        const hrEmails = ['careers@theroofdocs.com', 'ahmed.mahmoud@theroofdocs.com'];
        const subject = `Employee Import Complete: ${results.success} employees added`;
        const body = `
          <h2>Employee Import Summary</h2>
          <p><strong>Successfully imported:</strong> ${results.success}</p>
          <p><strong>Skipped (duplicates):</strong> ${results.skipped}</p>
          <p><strong>Failed:</strong> ${results.failed}</p>

          <h3>Imported Employees:</h3>
          <ul>
            ${results.created.map(e => `<li>${e.firstName} ${e.lastName} (${e.email}) - ${e.position}</li>`).join('')}
          </ul>

          ${results.skippedEmails.length > 0 ? `
          <h3>Skipped (already exist):</h3>
          <ul>
            ${results.skippedEmails.map(e => `<li>${e}</li>`).join('')}
          </ul>
          ` : ''}

          ${results.errors.length > 0 ? `
          <h3>Errors:</h3>
          <ul>
            ${results.errors.map(e => `<li>${e}</li>`).join('')}
          </ul>
          ` : ''}

          <p>All employees have been set with temporary password and will be prompted to change it on first login.</p>
        `;

        for (const email of hrEmails) {
          await emailService.sendEmail({
            to: email,
            subject,
            html: body
          });
        }
      } catch (emailError: any) {
        console.error('Failed to send HR notification:', emailError.message);
      }
    }

    res.json(results);
  } catch (error: any) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to bulk import employees', details: error.message });
  }
});

// Send welcome emails to selected employees
router.post('/api/users/send-welcome-emails', requireAuth, requireManager, async (req, res) => {
  try {
    const { employeeIds, password = 'Susan2025' } = req.body;

    if (!employeeIds || (Array.isArray(employeeIds) && employeeIds.length === 0)) {
      return res.status(400).json({ error: 'No employees specified' });
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    const emailService = new EmailService();
    await emailService.initialize();

    let employees: any[];
    if (employeeIds === 'all') {
      employees = await storage.getAllUsers();
    } else {
      employees = [];
      for (const id of employeeIds) {
        const emp = await storage.getUserById(id);
        if (emp) employees.push(emp);
      }
    }

    for (const emp of employees) {
      try {
        await emailService.sendEmail({
          to: emp.email,
          subject: 'Welcome to TheRoofDocs - Your Account Has Been Created',
          html: `
            <h2>Welcome to TheRoofDocs, ${emp.firstName}!</h2>
            <p>Your HR system account has been created. Here are your login credentials:</p>
            <p><strong>Email:</strong> ${emp.email}</p>
            <p><strong>Temporary Password:</strong> ${password}</p>
            <p><strong>Login URL:</strong> <a href="http://localhost:5050/login">http://localhost:5050/login</a></p>
            <p>Please log in and change your password immediately for security.</p>
            <br>
            <p>Best regards,</p>
            <p>The HR Team</p>
          `
        });
        results.sent++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${emp.email}: ${error.message}`);
      }
    }

    res.json(results);
  } catch (error: any) {
    console.error('Send welcome emails error:', error);
    res.status(500).json({ error: 'Failed to send welcome emails', details: error.message });
  }
});

// PTO routes
router.get('/api/pto', requireAuth, async (req: any, res) => {
  try {
    let ptoRequests;
    // Use role groups to check for admin/manager access (includes TRUE_ADMIN, SYSTEM_ADMIN, HR_ADMIN, etc.)
    const isAdminOrManager = ADMIN_ROLES.includes(req.user.role) || MANAGER_ROLES.includes(req.user.role);
    if (isAdminOrManager) {
      ptoRequests = await storage.getAllPtoRequests().catch((err) => {
        console.error('[PTO] Failed to fetch all PTO requests:', err.message);
        return [];
      });
    } else {
      ptoRequests = await storage.getPtoRequestsByEmployeeId(req.user.id).catch((err) => {
        console.error('[PTO] Failed to fetch PTO requests for user:', err.message);
        return [];
      });
    }
    res.json(ptoRequests);
  } catch (error) {
    console.error('Error fetching PTO requests:', error);
    // Return empty array instead of 500 error
    res.json([]);
  }
});

// PTO Calendar - company-wide approved PTO (name + dates only for privacy)
router.get('/api/pto/calendar', requireAuth, async (req: any, res) => {
  try {
    const allPto = await storage.getAllPtoRequests().catch((err) => {
      console.error('[PTO Calendar] Failed to fetch PTO requests:', err.message);
      return [];
    });

    const allUsers = await storage.getAllUsers().catch((err) => {
      console.error('[PTO Calendar] Failed to fetch users:', err.message);
      return [];
    });

    // Filter to approved PTO only and return minimal info for privacy
    const calendarData = allPto
      .filter((p: any) => p.status === 'APPROVED')
      .map((p: any) => {
        const user = allUsers.find((u: any) => u.id === p.employeeId);
        return {
          id: p.id,
          startDate: p.startDate,
          endDate: p.endDate,
          employeeId: p.employeeId,
          employeeName: user ? `${user.firstName} ${user.lastName}` : 'Employee',
          // PRIVACY: Do NOT include type, reason, or notes
        };
      });

    res.json(calendarData);
  } catch (error) {
    console.error('Error fetching PTO calendar:', error);
    res.json([]);
  }
});

router.post('/api/pto', requireAuth, async (req: any, res) => {
  try {
    // Helper to parse YYYY-MM-DD as local date (not UTC) to avoid off-by-one errors
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    // Calculate days from startDate and endDate BEFORE validation
    const startDateStr = req.body.startDate; // YYYY-MM-DD string
    const endDateStr = req.body.endDate;     // YYYY-MM-DD string
    const startDate = parseLocalDate(startDateStr);
    const endDate = parseLocalDate(endDateStr);

    let days: number;

    // Check if this is a half-day request
    const halfDay = req.body.halfDay || false;

    if (halfDay) {
      // For half-day requests, store as 1 day but flag it as half-day
      // The halfDay flag will indicate it's actually 0.5 days
      days = 1;
    } else {
      // Calculate the number of days (inclusive)
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
      days = diffDays;
    }

    // Get the requesting user
    const user = req.user!;

    // ========================================================================
    // PTO ELIGIBILITY CHECK - Reject Sales dept and 1099/CONTRACTOR employees
    // ========================================================================
    if (user.department === 'Sales' ||
        user.employmentType === '1099' ||
        user.employmentType === 'CONTRACTOR') {
      return res.status(403).json({
        error: 'You are not eligible for PTO based on your department or employment type.'
      });
    }

    // ========================================================================
    // DEPARTMENT CONFLICT CHECK - Prevent >1 person per department on PTO
    // ========================================================================
    if (user.department) {
      // Find any approved PTO requests from same department that overlap
      const overlappingPTO = await db.select({
        id: ptoRequests.id,
        employeeId: ptoRequests.employeeId,
        startDate: ptoRequests.startDate,
        endDate: ptoRequests.endDate,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(ptoRequests)
      .innerJoin(users, eq(users.id, ptoRequests.employeeId))
      .where(and(
        eq(users.department, user.department),
        eq(ptoRequests.status, 'APPROVED'),
        ne(ptoRequests.employeeId, user.id),
        // Check for date overlap: new request overlaps with existing approved PTO
        or(
          // New start date falls within existing PTO range
          and(
            gte(ptoRequests.startDate, startDateStr),
            lte(ptoRequests.startDate, endDateStr)
          ),
          // New end date falls within existing PTO range
          and(
            gte(ptoRequests.endDate, startDateStr),
            lte(ptoRequests.endDate, endDateStr)
          ),
          // New request completely contains existing PTO
          and(
            lte(ptoRequests.startDate, startDateStr),
            gte(ptoRequests.endDate, endDateStr)
          ),
          // Existing PTO completely contains new request
          and(
            gte(ptoRequests.startDate, startDateStr),
            lte(ptoRequests.endDate, endDateStr)
          )
        )
      ));

      if (overlappingPTO.length > 0) {
        const conflictingEmployee = overlappingPTO[0];
        return res.status(400).json({
          error: 'Department conflict',
          message: `Cannot request PTO for these dates. ${conflictingEmployee.firstName} ${conflictingEmployee.lastName} in your department (${user.department}) already has approved PTO during this period (${conflictingEmployee.startDate} to ${conflictingEmployee.endDate}). Please choose different dates.`,
          conflictingEmployee: `${conflictingEmployee.firstName} ${conflictingEmployee.lastName}`,
          conflictDates: { start: conflictingEmployee.startDate, end: conflictingEmployee.endDate }
        });
      }
    }
    // ========================================================================

    // Add calculated days to the request body BEFORE validation
    const dataWithDays = {
      ...req.body,
      days
    };

    // Now parse with the days field included
    const data = insertPtoRequestSchema.parse(dataWithDays);

    // Create the PTO request with calculated days
    const { status: _, ...ptoData } = data as any;
    const ptoRequest = await storage.createPtoRequest({
      ...ptoData,
      employeeId: user.id,
      status: 'PENDING' as const,
    });

    // Get appropriate approvers based on who is requesting
    // Ford/Reese requests go to Oliver & Ahmed only
    // Everyone else goes to all 4 approvers
    const approverEmails = getPTOApproversForEmployee(user.email);

    // Send notifications asynchronously without blocking the response
    (async () => {
      try {
        console.log('[PTO Email] Starting email notifications for PTO request...');
        const emailService = new EmailService();
        await emailService.initialize();
        console.log('[PTO Email] Email service initialized');

        // First, send confirmation to the employee who submitted
        try {
          const employeeEmailSent = await emailService.sendEmail({
            to: user.email,
            subject: `PTO Request Submitted - Awaiting Approval`,
            html: `
              <h2>Your PTO Request Has Been Submitted</h2>
              <p>Hi ${user.firstName},</p>
              <p>Your PTO request has been submitted and is pending approval.</p>
              <ul>
                <li><strong>Start Date:</strong> ${new Date(req.body.startDate).toLocaleDateString()}</li>
                <li><strong>End Date:</strong> ${new Date(req.body.endDate).toLocaleDateString()}</li>
                <li><strong>Days:</strong> ${days}</li>
                <li><strong>Reason:</strong> ${req.body.reason || 'Not specified'}</li>
              </ul>
              <p>You will receive another email once your request has been reviewed.</p>
              <p>Best regards,<br>The HR Team</p>
            `,
            fromUserEmail: process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com'
          });
          console.log(`[PTO Email] Employee confirmation email ${employeeEmailSent ? 'SENT' : 'FAILED (dev mode?)'} to: ${user.email}`);
        } catch (empEmailErr) {
          console.error('[PTO Email] Failed to send employee confirmation:', empEmailErr);
        }

        // Then notify the appropriate approvers (Ford/Reese → Oliver & Ahmed only, others → all 4)
        let managerEmailsSent = 0;
        let managerNotificationsSent = 0;
        console.log(`[PTO] Notifying ${approverEmails.length} approvers for ${user.email}'s request`);

        for (const approverEmail of approverEmails) {
          try {
            // Find the approver's user ID for in-app notification
            const approver = await storage.getUserByEmail(approverEmail);

            // Create in-app notification for the approver
            if (approver) {
              await storage.createNotification({
                id: `pto-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId: approver.id,
                type: 'pto_request',
                title: 'New PTO Request',
                message: `${user.firstName} ${user.lastName} has requested PTO from ${new Date(req.body.startDate).toLocaleDateString()} to ${new Date(req.body.endDate).toLocaleDateString()} (${days} days)`,
                link: '/pto',
                metadata: JSON.stringify({
                  ptoRequestId: ptoRequest.id,
                  employeeId: user.id,
                  employeeName: `${user.firstName} ${user.lastName}`,
                  startDate: req.body.startDate,
                  endDate: req.body.endDate,
                  days: days
                }),
                read: false,
                createdAt: new Date()
              });
              managerNotificationsSent++;
              console.log(`[PTO] In-app notification created for: ${approverEmail}`);
            }

            // Send email notification
            const sent = await emailService.sendEmail({
              to: approverEmail,
              subject: `New PTO Request: ${user.firstName} ${user.lastName}`,
              html: `
                <h2>New PTO Request Submitted</h2>
                <p><strong>${user.firstName} ${user.lastName}</strong> (${user.department || 'No Department'}) has requested PTO:</p>
                <ul>
                  <li><strong>Start Date:</strong> ${new Date(req.body.startDate).toLocaleDateString()}</li>
                  <li><strong>End Date:</strong> ${new Date(req.body.endDate).toLocaleDateString()}</li>
                  <li><strong>Days:</strong> ${days}</li>
                  <li><strong>Type:</strong> ${req.body.type || 'VACATION'}</li>
                  <li><strong>Reason:</strong> ${req.body.reason || 'Not specified'}</li>
                </ul>
                <p>Please review and approve/deny this request in the <a href="https://roofhr.up.railway.app/pto">HR System</a>.</p>
              `,
              fromUserEmail: process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com'
            });
            if (sent) {
              managerEmailsSent++;
              console.log(`[PTO] Email notification SENT to: ${approverEmail}`);
            } else {
              console.log(`[PTO] Email notification NOT SENT (dev mode?) to: ${approverEmail}`);
            }
          } catch (emailErr) {
            console.error(`[PTO] Failed to notify approver ${approverEmail}:`, emailErr);
          }
        }
        console.log(`[PTO] Completed: ${managerNotificationsSent} in-app, ${managerEmailsSent} emails sent to ${approverEmails.length} approvers`);
      } catch (notifyError) {
        console.error('[PTO Email] Error sending notifications:', notifyError);
      }
    })();

    res.json(ptoRequest);
  } catch (error: any) {
    console.error('PTO request error:', error);
    if (error.issues) {
      console.error('Validation issues:', error.issues);
      res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    } else {
      res.status(400).json({ error: error.message || 'Invalid request data' });
    }
  }
});

// PTO Approvers - imported from shared/constants/roles.ts

router.patch('/api/pto/:id', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    const { status, reviewNotes } = req.body;

    // Only designated approvers can approve/deny PTO requests
    if ((status === 'APPROVED' || status === 'DENIED') && !PTO_APPROVER_EMAILS.includes(user.email)) {
      return res.status(403).json({
        error: 'Only Ford Barsi, Ahmed, Reese, or Oliver can approve or deny PTO requests'
      });
    }

    // Get the current PTO request to know which employee and how many days
    const currentRequest = await storage.getPtoRequestById(req.params.id);
    if (!currentRequest) {
      return res.status(404).json({ error: 'PTO request not found' });
    }

    // Update the PTO request status
    const ptoRequest = await storage.updatePtoRequest(req.params.id, {
      status,
      reviewNotes,
      reviewedBy: user.id,
      reviewedAt: new Date(),
    });
    
    // If the request is approved, update the employee's PTO policy and create calendar events
    if (status === 'APPROVED' && currentRequest.status !== 'APPROVED') {
      const policy = await storage.getPtoPolicyByEmployee(currentRequest.employeeId);
      if (policy) {
        const daysToUse = currentRequest.days || 0;
        const newUsedDays = policy.usedDays + daysToUse;
        const newRemainingDays = policy.totalDays - newUsedDays;

        await storage.updatePtoPolicy(currentRequest.employeeId, {
          usedDays: newUsedDays,
          remainingDays: newRemainingDays
        });
      }

      // Create Google Calendar events for approved PTO
      try {
        const employee = await storage.getUserById(currentRequest.employeeId);
        if (employee && employee.email) {
          await googleCalendarService.initialize();

          const startDate = new Date(currentRequest.startDate);
          const endDate = new Date(currentRequest.endDate);
          // Set end date to end of day (all-day events)
          endDate.setHours(23, 59, 59, 999);

          const ptoTypeName = currentRequest.type || 'Time Off';

          // 1. Create event on Employee's personal calendar
          try {
            const employeeEvent = await googleCalendarService.createEventWithId(employee.email, {
              summary: `PTO: ${ptoTypeName}`,
              description: `Your approved ${ptoTypeName} time off.\n\nReason: ${currentRequest.reason || 'Not specified'}\nDays: ${currentRequest.days || 'N/A'}`,
              start: {
                dateTime: startDate.toISOString(),
                timeZone: 'America/New_York'
              },
              end: {
                dateTime: endDate.toISOString(),
                timeZone: 'America/New_York'
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 24 * 60 },
                  { method: 'popup', minutes: 60 }
                ]
              }
            });

            // Update PTO request with employee calendar event ID
            if (employeeEvent?.id) {
              await db.update(ptoRequests)
                .set({ googleEventId: employeeEvent.id })
                .where(eq(ptoRequests.id, req.params.id));
              console.log(`[PTO Calendar] Created employee calendar event: ${employeeEvent.id}`);
            }
          } catch (empCalError) {
            console.error('[PTO Calendar] Error creating employee calendar event:', empCalError);
          }

          // 2. Create event on HR shared calendar
          const hrCalendarId = process.env.HR_CALENDAR_ID;
          if (hrCalendarId) {
            try {
              const hrEvent = await googleCalendarService.createEventWithId(hrCalendarId, {
                summary: `PTO: ${employee.firstName} ${employee.lastName} - ${ptoTypeName}`,
                description: `Employee: ${employee.firstName} ${employee.lastName}\nEmail: ${employee.email}\nDepartment: ${employee.department || 'N/A'}\nType: ${ptoTypeName}\nDays: ${currentRequest.days || 'N/A'}\nReason: ${currentRequest.reason || 'Not specified'}`,
                start: {
                  dateTime: startDate.toISOString(),
                  timeZone: 'America/New_York'
                },
                end: {
                  dateTime: endDate.toISOString(),
                  timeZone: 'America/New_York'
                }
              });

              // Update PTO request with HR calendar event ID
              if (hrEvent?.id) {
                await db.update(ptoRequests)
                  .set({ hrCalendarEventId: hrEvent.id })
                  .where(eq(ptoRequests.id, req.params.id));
                console.log(`[PTO Calendar] Created HR calendar event: ${hrEvent.id}`);
              }
            } catch (hrCalError) {
              console.error('[PTO Calendar] Error creating HR calendar event:', hrCalError);
            }
          }
        }
      } catch (calendarError) {
        console.error('[PTO Calendar] Error creating calendar events:', calendarError);
        // Don't fail the approval if calendar creation fails
      }
    }

    // If the request was previously approved and is now denied/pending, restore the days and delete calendar events
    if (currentRequest.status === 'APPROVED' && status !== 'APPROVED') {
      const policy = await storage.getPtoPolicyByEmployee(currentRequest.employeeId);
      if (policy) {
        const daysToRestore = currentRequest.days || 0;
        const newUsedDays = Math.max(0, policy.usedDays - daysToRestore);
        const newRemainingDays = policy.totalDays - newUsedDays;

        await storage.updatePtoPolicy(currentRequest.employeeId, {
          usedDays: newUsedDays,
          remainingDays: newRemainingDays
        });
      }

      // Delete Google Calendar events if they exist
      try {
        await googleCalendarService.initialize();
        const employee = await storage.getUserById(currentRequest.employeeId);

        // Delete employee calendar event
        if (currentRequest.googleEventId && employee?.email) {
          try {
            await googleCalendarService.updateEventWithId(employee.email, currentRequest.googleEventId, { status: 'cancelled' });
            console.log(`[PTO Calendar] Cancelled employee calendar event: ${currentRequest.googleEventId}`);
          } catch (delError) {
            console.error('[PTO Calendar] Error cancelling employee event:', delError);
          }
        }

        // Delete HR calendar event
        const hrCalendarId = process.env.HR_CALENDAR_ID;
        if (currentRequest.hrCalendarEventId && hrCalendarId) {
          try {
            await googleCalendarService.updateEventWithId(hrCalendarId, currentRequest.hrCalendarEventId, { status: 'cancelled' });
            console.log(`[PTO Calendar] Cancelled HR calendar event: ${currentRequest.hrCalendarEventId}`);
          } catch (delError) {
            console.error('[PTO Calendar] Error cancelling HR event:', delError);
          }
        }

        // Clear the event IDs from the PTO request
        await db.update(ptoRequests)
          .set({ googleEventId: null, hrCalendarEventId: null })
          .where(eq(ptoRequests.id, req.params.id));
      } catch (calendarError) {
        console.error('[PTO Calendar] Error deleting calendar events:', calendarError);
      }
    }

    // Send notifications to the employee when their PTO request is approved or denied
    if (status === 'APPROVED' || status === 'DENIED') {
      try {
        const employee = await storage.getUserById(currentRequest.employeeId);
        if (employee) {
          const statusText = status === 'APPROVED' ? 'Approved' : 'Denied';
          const statusEmoji = status === 'APPROVED' ? '✅' : '❌';

          // 1. Create in-app notification for the employee
          await storage.createNotification({
            id: `pto-${status.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: employee.id,
            type: status === 'APPROVED' ? 'pto_approved' : 'pto_denied',
            title: `PTO Request ${statusText}`,
            message: `Your PTO request from ${currentRequest.startDate} to ${currentRequest.endDate} has been ${statusText.toLowerCase()}.${reviewNotes ? ` Notes: ${reviewNotes}` : ''}`,
            link: '/pto',
            metadata: JSON.stringify({
              ptoRequestId: currentRequest.id,
              startDate: currentRequest.startDate,
              endDate: currentRequest.endDate,
              days: currentRequest.days,
              reviewedBy: user.email,
              reviewNotes: reviewNotes || null
            }),
            read: false,
          });
          console.log(`[PTO Notification] In-app notification created for ${employee.email}`);

          // 2. Send email notification to the employee
          if (employee.email) {
            try {
              const emailService = new EmailService();
              await emailService.initialize();

              const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: ${status === 'APPROVED' ? '#10b981' : '#ef4444'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9fafb; padding: 25px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
                    .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 0.85em; color: #666; }
                    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1 style="margin: 0;">${statusEmoji} PTO Request ${statusText}</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${employee.firstName || 'there'},</p>
                      <p>Your PTO request has been <strong>${statusText.toLowerCase()}</strong> by ${user.firstName} ${user.lastName}.</p>

                      <div class="details">
                        <h3 style="margin-top: 0;">Request Details</h3>
                        <p><strong>Type:</strong> ${currentRequest.type || 'PTO'}</p>
                        <p><strong>Start Date:</strong> ${currentRequest.startDate}</p>
                        <p><strong>End Date:</strong> ${currentRequest.endDate}</p>
                        <p><strong>Days:</strong> ${currentRequest.days || 'N/A'}</p>
                        ${currentRequest.reason ? `<p><strong>Reason:</strong> ${currentRequest.reason}</p>` : ''}
                        ${reviewNotes ? `<p><strong>Reviewer Notes:</strong> ${reviewNotes}</p>` : ''}
                      </div>

                      ${status === 'APPROVED' ? '<p>Your time off has been added to the calendar. Enjoy your break!</p>' : '<p>If you have questions about this decision, please reach out to your manager or HR.</p>'}

                      <div style="text-align: center;">
                        <a href="https://roofhr.up.railway.app/pto" class="button">View PTO Dashboard</a>
                      </div>

                      <div class="footer">
                        <p>This is an automated notification from ROOF HR.</p>
                      </div>
                    </div>
                  </div>
                </body>
                </html>
              `;

              await emailService.sendEmail({
                to: employee.email,
                subject: `Your PTO Request Has Been ${statusText}`,
                html: emailHtml,
                fromUserEmail: user.email  // Use Gmail API with service account impersonation
              });
              console.log(`[PTO Notification] Email sent to ${employee.email}`);
            } catch (emailError) {
              console.error('[PTO Notification] Error sending email:', emailError);
              // Don't fail the request if email fails
            }
          }
        }
      } catch (notifError) {
        console.error('[PTO Notification] Error creating notifications:', notifError);
        // Don't fail the request if notifications fail
      }
    }

    res.json(ptoRequest);
  } catch (error) {
    console.error('Error updating PTO request:', error);
    res.status(400).json({ error: 'Failed to update PTO request' });
  }
});

// Check if current user has any candidate assignments (for sidebar visibility)
router.get('/api/user/has-candidate-assignments', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    const candidates = await storage.getAllCandidates();
    const hasAssignments = candidates.some((c: any) => c.assignedTo === user.id);
    res.json({ hasAssignments });
  } catch (error: any) {
    console.error('[User Assignments] Error checking assignments:', error);
    res.status(500).json({ error: 'Failed to check assignments' });
  }
});

// Recruiting routes
router.get('/api/candidates', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    let candidates = await storage.getAllCandidates();
    const totalCandidates = candidates.length;

    // Manager-level roles see all candidates
    const managerRoles = ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER',
                          'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN'];

    // Import sourcer role checks
    const { isLeadSourcer } = await import('../shared/constants/roles');

    // Determine who can see all candidates:
    // - Managers see all
    // - Lead sourcers (Ryan) see all
    // - Everyone else (including assigned sourcers) only see their assigned candidates
    const canSeeAllCandidates = managerRoles.includes(user.role) || isLeadSourcer(user);

    // Log filtering decision for debugging
    console.log(`[Candidates API] User ${user.email} (role: ${user.role}, id: ${user.id}) - canSeeAll: ${canSeeAllCandidates}`);

    if (!canSeeAllCandidates) {
      // Non-managers only see their assigned candidates (assignment-based access)
      candidates = candidates.filter((c: any) => c.assignedTo === user.id);
      console.log(`[Candidates API] Filtered from ${totalCandidates} to ${candidates.length} candidates for ${user.email}`);
    }

    // Batch fetch sourcer info instead of N individual queries
    // Get unique assignedTo IDs
    const assignedToIds = [...new Set(candidates.map((c: any) => c.assignedTo).filter(Boolean))];

    // Build a map of sourcer info (one query for all)
    const sourcerMap = new Map<string, any>();
    if (assignedToIds.length > 0) {
      // Fetch all users in one query
      const allUsers = await storage.getAllUsers();
      for (const userId of assignedToIds) {
        const sourcerUser = allUsers.find((u: any) => u.id === userId);
        if (sourcerUser) {
          sourcerMap.set(userId, {
            id: sourcerUser.id,
            firstName: sourcerUser.firstName,
            lastName: sourcerUser.lastName,
            screenerColor: (sourcerUser as any).screenerColor || '#6B7280'
          });
        }
      }
    }

    // Enrich candidates with cached sourcer data (no additional DB calls)
    const enriched = candidates.map((c: any) => ({
      ...c,
      sourcer: c.assignedTo ? sourcerMap.get(c.assignedTo) || null : null
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('[Candidates API] Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates', details: error?.message });
  }
});

router.post('/api/candidates', requireAuth, requireManager, async (req, res) => {
  try {
    // Map the incoming fields to match schema expectations and provide defaults
    const mappedData = {
      firstName: req.body.firstName || 'Unknown',
      lastName: req.body.lastName || 'Candidate',
      email: req.body.email || `candidate${Date.now()}@example.com`,
      phone: req.body.phone || '555-0000',
      position: req.body.position || 'General',
      stage: req.body.stage || 'Application Review',
      appliedDate: req.body.appliedDate ? new Date(req.body.appliedDate) : new Date(),
      resumeUrl: req.body.resumeUrl,
      notes: req.body.notes,
      assignedTo: req.body.assignedTo,
      recruiterId: req.body.recruiterId,
      customTags: req.body.customTags || [],
      questionnaireCompleted: req.body.questionnaireCompleted || false,
      referralName: req.body.referralName || null
    };

    const data = insertCandidateSchema.parse(mappedData);
    const candidate = await storage.createCandidate({
      ...data,
      status: 'APPLIED',
      stage: 'Application Review'
    });

    // Get HR users and create notifications
    try {
      const hrRoles = ['HR_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'TRUE_ADMIN'];
      const hrUsers = await storage.getUsersByRoles(hrRoles);

      for (const hrUser of hrUsers) {
        await storage.createNotification({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: hrUser.id,
          type: 'NEW_CANDIDATE',
          title: 'New Candidate Added',
          message: `${candidate.firstName} ${candidate.lastName} applied for ${candidate.position}`,
          metadata: JSON.stringify({ candidateId: candidate.id }),
          read: false,
        });
      }

      // Emit WebSocket for real-time popup (if available)
      if (req.app.locals.emitAdminNotification) {
        req.app.locals.emitAdminNotification('new_candidate', {
          candidateId: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          position: candidate.position,
        });
      }
    } catch (notifError) {
      console.error('Failed to create notifications:', notifError);
      // Don't fail the candidate creation if notification fails
    }

    res.json(candidate);
  } catch (error: any) {
    console.error('Candidate creation error:', error);
    if (error.issues) {
      console.error('Validation issues:', error.issues);
      res.status(400).json({
        error: 'Invalid request data',
        details: error.issues
      });
    } else {
      res.status(400).json({ error: error.message || 'Invalid request data' });
    }
  }
});

router.patch('/api/candidates/:id', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    // Get the current candidate to check for status changes
    const currentCandidate = await storage.getCandidateById(req.params.id);
    const previousStatus = currentCandidate?.status;

    // If questionnaire fields are being updated, mark as completed
    const updateData = { ...req.body };
    if ('hasDriversLicense' in updateData || 'hasReliableVehicle' in updateData ||
        'canGetOnRoof' in updateData || 'isOutgoing' in updateData || 'availability' in updateData) {
      updateData.questionnaireCompleted = true;
      updateData.questionnaireCompletedBy = user.id;
      updateData.questionnaireCompletedAt = new Date().toISOString();
    }

    // Handle interview screening date conversion (string to Date)
    if (updateData.interviewScreeningDate && typeof updateData.interviewScreeningDate === 'string') {
      updateData.interviewScreeningDate = new Date(updateData.interviewScreeningDate);
    }

    const candidate = await storage.updateCandidate(req.params.id, updateData);

    // Trigger workflows if the status has changed
    if (updateData.status && updateData.status !== previousStatus && previousStatus) {
      const { workflowExecutor } = await import('./services/workflow-executor');
      await workflowExecutor.onCandidateStageChange(
        req.params.id,
        updateData.status,
        previousStatus
      );

      // Auto-hire workflow: Create employee profile and send welcome email when moved to HIRED
      if (updateData.status === 'HIRED') {
        console.log(`[AUTO-HIRE] Candidate ${candidate.firstName} ${candidate.lastName} moved to HIRED, creating employee profile...`);

        try {
          // Check if user already exists with this email
          const existingUser = await storage.getUserByEmail(candidate.email);

          if (!existingUser) {
            // Create employee profile from candidate data
            const tempPassword = `Welcome${new Date().getFullYear()}!`;
            const hashedPassword = await import('bcrypt').then(bcrypt => bcrypt.hash(tempPassword, 10));

            const newUser = await storage.createUser({
              email: candidate.email,
              passwordHash: hashedPassword,
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              role: 'SALES_REP', // New hires start as Sales Representative
              employmentType: 'W2',
              department: 'Sales',
              position: candidate.position || 'Sales Representative',
              phone: candidate.phone || '',
              hireDate: new Date().toISOString().split('T')[0],
              mustChangePassword: true,
            });

            console.log(`[AUTO-HIRE] Created employee profile for ${candidate.firstName} ${candidate.lastName} (${newUser.id})`);

            // Send welcome email with all onboarding materials
            const { EmailService } = await import('./email-service');
            const emailService = new EmailService();
            await emailService.initialize();

            const emailSent = await emailService.sendWelcomeEmail(
              {
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                email: candidate.email,
                position: candidate.position || 'Sales Representative',
              },
              tempPassword,
              user.email,
              {
                includeAttachments: true,
                includeEquipmentChecklist: true,
              }
            );

            if (emailSent) {
              console.log(`[AUTO-HIRE] Welcome email sent to ${candidate.email}`);
            } else {
              console.error(`[AUTO-HIRE] Failed to send welcome email to ${candidate.email}`);
            }
          } else {
            console.log(`[AUTO-HIRE] User already exists for ${candidate.email}, skipping profile creation`);
          }
        } catch (hireError) {
          console.error('[AUTO-HIRE] Error in auto-hire workflow:', hireError);
          // Don't fail the request, just log the error
        }
      }
    }

    res.json(candidate);
  } catch (error: any) {
    console.error('[PATCH /api/candidates/:id] Error:', error);
    console.error('[PATCH /api/candidates/:id] Request body:', JSON.stringify(req.body, null, 2));
    res.status(400).json({
      error: 'Failed to update candidate',
      details: error.message || 'Unknown error'
    });
  }
});

router.delete('/api/candidates/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await storage.deleteCandidate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete candidate' });
  }
});

// SOURCER stage update - allows SOURCERs to move their assigned candidates (restricted stages)
router.patch('/api/candidates/:id/sourcer-move', requireAuth, async (req: any, res) => {
  try {
    const user = req.user!;
    const { newStatus } = req.body;
    const candidateId = req.params.id;

    // Get the candidate
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Verify the SOURCER is assigned to this candidate
    if (candidate.assignedTo !== user.id) {
      console.log(`[SOURCER-MOVE] Denied: ${user.email} tried to move candidate ${candidateId} but is not assigned (assigned to: ${candidate.assignedTo})`);
      return res.status(403).json({ error: 'You can only move candidates assigned to you' });
    }

    // SOURCERs can only move to these stages
    const allowedStages = ['APPLIED', 'SCREENING', 'INTERVIEW'];
    if (!allowedStages.includes(newStatus)) {
      console.log(`[SOURCER-MOVE] Denied: ${user.email} tried to move to ${newStatus} which is not allowed`);
      return res.status(403).json({
        error: 'SOURCERs can only move candidates to Application Review, Phone Screening, or Interview Process. Contact a manager to move to later stages.'
      });
    }

    // Update the candidate
    const previousStatus = candidate.status;
    const updatedCandidate = await storage.updateCandidate(candidateId, { status: newStatus });

    console.log(`[SOURCER-MOVE] ${user.email} moved candidate ${candidate.firstName} ${candidate.lastName} from ${previousStatus} to ${newStatus}`);

    // Trigger workflows if status changed
    if (newStatus !== previousStatus) {
      const { workflowExecutor } = await import('./services/workflow-executor');
      await workflowExecutor.onCandidateStageChange(candidateId, newStatus, previousStatus);
    }

    res.json(updatedCandidate);
  } catch (error: any) {
    console.error('[SOURCER-MOVE] Error:', error);
    res.status(400).json({ error: 'Failed to update candidate', details: error.message });
  }
});

// Bulk status update for group move
router.post('/api/candidates/bulk-status', requireAuth, requireManagerOrLeadSourcer, async (req: any, res) => {
  try {
    const { candidateIds, newStatus } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ error: 'candidateIds array is required' });
    }

    if (!newStatus) {
      return res.status(400).json({ error: 'newStatus is required' });
    }

    // Valid statuses
    const validStatuses = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'NO_SHOW'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Update all candidates in the list
    await db.update(candidates)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(inArray(candidates.id, candidateIds));

    console.log(`[BULK-STATUS] User ${req.user.email} moved ${candidateIds.length} candidates to ${newStatus}`);

    res.json({
      success: true,
      count: candidateIds.length,
      newStatus
    });
  } catch (error: any) {
    console.error('[POST /api/candidates/bulk-status] Error:', error);
    res.status(400).json({
      error: 'Failed to update candidates',
      details: error.message || 'Unknown error'
    });
  }
});

// Hire candidate with full onboarding
router.post('/api/candidates/:id/hire', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    const candidateId = req.params.id;
    const {
      startDate,
      department,
      role,
      employmentType,
      shirtSize,
      welcomePackageId,
      sendWelcomeEmail = true
    } = req.body;

    console.log(`[HIRE] Starting hire process for candidate ${candidateId}`);

    // Get candidate
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(candidate.email);
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Create employee account
    const tempPassword = `Welcome${new Date().getFullYear()}!`;
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newEmployee = await storage.createUser({
      email: candidate.email,
      passwordHash: hashedPassword,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      role: role || 'REP',
      employmentType: employmentType || 'W2',
      department: department || 'Sales',
      position: candidate.position || 'Sales Representative',
      phone: candidate.phone || '',
      hireDate: startDate || new Date().toISOString().split('T')[0],
      mustChangePassword: true,
    });

    console.log(`[HIRE] Created employee ${newEmployee.id} for ${candidate.firstName} ${candidate.lastName}`);

    // Create PTO policy based on employment type and department
    // W2 employees get 17 days (10 vacation, 5 sick, 2 personal)
    // 1099 employees and Sales department get 0 PTO
    try {
      const ptoAllocation = getPtoAllocation(newEmployee.employmentType, newEmployee.department);

      await storage.createPtoPolicy({
        employeeId: newEmployee.id,
        policyLevel: 'INDIVIDUAL',
        totalDays: ptoAllocation.totalDays,
        baseDays: ptoAllocation.totalDays,
        vacationDays: ptoAllocation.vacationDays,
        sickDays: ptoAllocation.sickDays,
        personalDays: ptoAllocation.personalDays,
        additionalDays: 0,
        usedDays: 0,
        remainingDays: ptoAllocation.totalDays,
        notes: ptoAllocation.totalDays === 0 ? 'No PTO (1099/Sales)' : 'Initial PTO allocation from hiring'
      });
      console.log(`[HIRE] Created PTO policy for ${newEmployee.id} (${ptoAllocation.totalDays} total days - auto-calculated based on ${newEmployee.employmentType}/${newEmployee.department})`);
    } catch (ptoError) {
      console.error('[HIRE] Failed to create PTO policy:', ptoError);
    }

    // Note: Tools are now assigned separately from the Tools page after hiring
    // This removes the performance bottleneck of sequential tool assignments

    // Assign welcome package
    if (welcomePackageId) {
      try {
        const bundleItemsList = await db
          .select()
          .from(bundleItems)
          .where(eq(bundleItems.bundleId, welcomePackageId));

        const assignmentId = uuidv4();
        await db.insert(bundleAssignments).values({
          id: assignmentId,
          bundleId: welcomePackageId,
          employeeId: newEmployee.id,
          assignedBy: user.id,
          assignedDate: new Date(),
          status: 'FULFILLED' as const
        });

        for (const item of bundleItemsList) {
          await db.insert(bundleAssignmentItems).values({
            id: uuidv4(),
            assignmentId,
            bundleItemId: item.id,
            quantity: item.quantity,
            size: item.requiresSize ? shirtSize : null,
            status: 'ASSIGNED'
          });
        }
        console.log(`[HIRE] Assigned welcome package to ${newEmployee.id}`);
      } catch (bundleError) {
        console.error('[HIRE] Failed to assign welcome package:', bundleError);
      }
    }

    // Create onboarding tasks
    const onboardingTasks: Array<{
      employeeId: string;
      title: string;
      description: string;
      dueDate: Date;
      status: 'PENDING' | 'COMPLETED';
    }> = [
      {
        employeeId: newEmployee.id,
        title: 'Complete I-9 Form',
        description: 'Complete employment eligibility verification',
        dueDate: new Date(startDate),
        status: 'PENDING'
      },
      {
        employeeId: newEmployee.id,
        title: 'Sign Employment Contract',
        description: 'Review and sign your employment agreement',
        dueDate: new Date(startDate),
        status: 'PENDING'
      },
      {
        employeeId: newEmployee.id,
        title: 'Complete Safety Training',
        description: 'Complete mandatory safety orientation',
        dueDate: new Date(new Date(startDate).getTime() + 3 * 24 * 60 * 60 * 1000),
        status: 'PENDING' as const
      },
      {
        employeeId: newEmployee.id,
        title: 'Tools & Equipment Assignment',
        description: 'Receive and acknowledge assigned tools and equipment from the Tools page',
        dueDate: new Date(startDate),
        status: 'PENDING' as const
      },
      {
        employeeId: newEmployee.id,
        title: 'Benefits Enrollment',
        description: 'Enroll in company benefits programs',
        dueDate: new Date(new Date(startDate).getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'PENDING' as const
      },
      {
        employeeId: newEmployee.id,
        title: 'Complete Online Training',
        description: 'Complete required online training before first day',
        dueDate: new Date(new Date(startDate).getTime() - 1 * 24 * 60 * 60 * 1000),
        status: 'PENDING' as const
      }
    ];

    for (const task of onboardingTasks) {
      try {
        await storage.createOnboardingTask(task);
      } catch (taskError) {
        console.error('[HIRE] Failed to create onboarding task:', taskError);
      }
    }
    console.log(`[HIRE] Created ${onboardingTasks.length} onboarding tasks`);

    // Update candidate status to HIRED
    await storage.updateCandidate(candidateId, { status: 'HIRED' });
    console.log(`[HIRE] Updated candidate ${candidateId} status to HIRED`);

    // Send welcome email (async/non-blocking to prevent UI freeze)
    const emailTriggered = sendWelcomeEmail;
    if (sendWelcomeEmail) {
      // Fire-and-forget: Send email in background, don't block response
      const candidateEmail = candidate.email;
      const candidateFirstName = candidate.firstName;
      const candidateLastName = candidate.lastName;
      const candidatePosition = candidate.position || 'Sales Representative';
      const senderEmail = user.email;

      (async () => {
        try {
          const { EmailService } = await import('./email-service');
          const emailService = new EmailService();
          await emailService.initialize();

          const emailSent = await emailService.sendWelcomeEmail(
            {
              firstName: candidateFirstName,
              lastName: candidateLastName,
              email: candidateEmail,
              position: candidatePosition,
            },
            tempPassword,
            senderEmail,
            {
              includeAttachments: true,
              includeEquipmentChecklist: true,
            }
          );

          if (emailSent) {
            console.log(`[HIRE] Welcome email sent to ${candidateEmail}`);
          } else {
            console.error(`[HIRE] Failed to send welcome email to ${candidateEmail}`);
          }
        } catch (emailError) {
          console.error('[HIRE] Email service error:', emailError);
        }
      })();
    }

    console.log(`[HIRE] Hire complete for ${newEmployee.firstName} ${newEmployee.lastName} - sending response`);

    res.json({
      success: true,
      employee: {
        id: newEmployee.id,
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        email: newEmployee.email,
        position: newEmployee.position,
        department: newEmployee.department,
        hireDate: startDate
      },
      toolsNote: 'Tools can be assigned from the Tools page after hiring',
      emailSent: emailTriggered, // Boolean: true if email was requested (sending in background)
      emailNote: emailTriggered ? 'Welcome email is being sent in the background' : 'No email requested',
      onboardingTasksCreated: onboardingTasks.length
    });

  } catch (error: any) {
    console.error('[HIRE] Error hiring candidate:', error);
    res.status(500).json({
      error: 'Failed to hire candidate',
      details: error.message || 'Unknown error'
    });
  }
});

// Candidate Notes routes
router.get('/api/candidates/:candidateId/notes', requireAuth, async (req, res) => {
  try {
    const notes = await storage.getCandidateNotesByCandidateId(req.params.candidateId);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidate notes' });
  }
});

router.post('/api/candidates/:candidateId/notes', requireAuth, async (req: any, res) => {
  try {
    const user = req.user!;
    const { content, type = 'GENERAL' } = req.body;
    const note = await storage.createCandidateNote({
      candidateId: req.params.candidateId,
      authorId: user.id,
      content,
      type
    });
    res.json(note);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create note' });
  }
});

router.delete('/api/candidates/notes/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await storage.deleteCandidateNote(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete note' });
  }
});

// AI Analysis endpoint for candidates
router.post('/api/candidates/:candidateId/analyze', requireAuth, async (req, res) => {
  try {
    const { candidateId } = req.params;

    // Get candidate
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Import AI Enhancement Service
    const { aiEnhancementService } = await import('./services/ai-enhancement');

    // Prepare candidate data for analysis
    const candidateAny = candidate as any;
    const candidateData = {
      name: `${candidate.firstName} ${candidate.lastName}`,
      position: candidate.position,
      resumeText: candidateAny.resumeText || '',
      skills: candidateAny.skills ? JSON.parse(candidateAny.skills) : [],
      experience: candidateAny.yearsExperience || 0,
      education: candidateAny.education || '',
      parsedResumeData: candidateAny.parsedResumeData ? JSON.parse(candidateAny.parsedResumeData) : null,
    };

    // Job requirements (basic for now)
    const jobRequirements = {
      position: candidate.position,
      requiredExperience: 1,
      preferredSkills: ['communication', 'teamwork', 'problem-solving'],
    };

    // Run AI analysis
    const analysis = await aiEnhancementService.predictCandidateSuccess(candidateData, jobRequirements);

    // Create comprehensive AI insights
    const aiInsights = {
      analyzedAt: new Date().toISOString(),
      analysis: analysis,
      jobRequirements: jobRequirements,
      candidateSnapshot: {
        position: candidate.position,
        experience: candidateData.experience,
        hasParsedResume: !!candidate.parsedResumeData,
      },
      method: 'OpenAI GPT-4o Predictive Analysis',
    };

    // Update candidate with results
    const updated = await storage.updateCandidate(candidateId, {
      matchScore: analysis.successScore,
      predictedSuccessScore: analysis.successScore,
      predictedTenure: analysis.predictedTenure,
      cultureFitScore: analysis.cultureFitScore,
      technicalFitScore: analysis.technicalFitScore,
      riskFactors: JSON.stringify(analysis.riskFactors || []),
      aiInsights: JSON.stringify(aiInsights),
      lastAnalyzed: new Date(),
    });

    res.json({
      success: true,
      candidate: updated,
      analysis: analysis,
    });
  } catch (error: any) {
    console.error('[AI Analysis Error]', error);
    res.status(500).json({
      error: 'Failed to analyze candidate',
      message: error.message || 'AI analysis service unavailable'
    });
  }
});

// Employee Notes routes
router.get('/api/employees/:employeeId/notes', requireAuth, async (req, res) => {
  try {
    const notes = await storage.getEmployeeNotesByEmployeeId(req.params.employeeId);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee notes' });
  }
});

router.post('/api/employees/:employeeId/notes', requireAuth, async (req: any, res) => {
  try {
    const user = req.user!;
    const { content, type = 'GENERAL' } = req.body;
    const note = await storage.createEmployeeNote({
      employeeId: req.params.employeeId,
      authorId: user.id,
      content,
      type
    });
    res.json(note);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create employee note' });
  }
});

router.delete('/api/employees/notes/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await storage.deleteEmployeeNote(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete employee note' });
  }
});

// Interview Screening Alert endpoint
router.post('/api/alerts/screening-failure', requireAuth, async (req: any, res) => {
  try {
    const user = req.user!;
    const { candidateId, candidateName, position, failedRequirements, notes, timestamp } = req.body;

    // Get all managers and admins to notify
    const allUsers = await storage.getAllUsers();
    const managersAndAdmins = allUsers.filter((u: any) =>
      u.role === 'ADMIN' || u.role === 'MANAGER'
    );

    // Create a candidate note recording the screening failure
    if (candidateId) {
      await storage.createCandidateNote({
        candidateId,
        authorId: user.id,
        content: `Interview Screening Alert: Failed requirements - ${failedRequirements.join(', ')}${notes ? `. Notes: ${notes}` : ''}`,
        type: 'SCREENING_ALERT'
      });
    }

    // Send email notifications to managers (if email service is available)
    try {
      const emailService = new EmailService();
      await emailService.initialize();

      for (const manager of managersAndAdmins) {
        if (manager.email) {
          await emailService.sendEmail({
            to: manager.email,
            subject: `Interview Screening Alert - ${candidateName}`,
            html: `
              <h2>Interview Screening Alert</h2>
              <p><strong>Candidate:</strong> ${candidateName}</p>
              <p><strong>Position:</strong> ${position}</p>
              <p><strong>Failed Requirements:</strong></p>
              <ul>
                ${failedRequirements.map((req: string) => `<li style="color: red;">${req}: NO</li>`).join('')}
              </ul>
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
              <p><strong>Screened By:</strong> ${user.firstName} ${user.lastName}</p>
              <p><strong>Date:</strong> ${new Date(timestamp).toLocaleString()}</p>
              <hr>
              <p><em>This candidate is proceeding to an in-person interview despite not meeting all requirements.</em></p>
            `
          });
        }
      }
    } catch (emailError) {
      console.error('[Screening Alert] Email notification failed:', emailError);
      // Continue even if email fails
    }

    // Create notification records for in-app alerts
    try {
      for (const manager of managersAndAdmins) {
        await storage.createNotification({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: manager.id,
          type: 'warning',
          title: `Screening Alert: ${candidateName}`,
          message: `Candidate ${candidateName} (${position}) is proceeding to in-person interview without meeting: ${failedRequirements.join(', ')}`,
          link: `/recruiting?candidate=${candidateId}`,
          read: false
        });
      }
    } catch (notifError) {
      console.error('[Screening Alert] Notification creation failed:', notifError);
    }

    res.json({
      success: true,
      message: `Alert sent to ${managersAndAdmins.length} manager(s)`
    });
  } catch (error: any) {
    console.error('[Screening Alert] Error:', error);
    res.status(500).json({
      error: 'Failed to send screening alert',
      message: error.message
    });
  }
});

// Configure multer for resume uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// Resume parsing endpoint using OpenAI
router.post('/api/candidates/parse-resume', requireAuth, upload.single('resume'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file provided' });
    }

    // Upload resume to Google Drive first
    let resumeUrl = '';
    try {
      const { uploadToGoogleDrive } = await import('./services/google-drive-service');
      const uploadResult = await uploadToGoogleDrive(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        'recruiting' // Folder type for recruiting documents
      );
      resumeUrl = uploadResult.webViewLink || '';
      console.log('[Resume Upload] File uploaded to Google Drive:', resumeUrl);
    } catch (error) {
      console.error('[Resume Upload] Failed to upload to Google Drive:', error);
    }

    // Parse resume content based on file type
    let resumeText = '';
    if (req.file.mimetype === 'text/plain') {
      resumeText = req.file.buffer.toString('utf-8');
    } else {
      // For PDF and Word documents, we'll use the filename and let AI work with what we have
      // PDF parsing packages have compatibility issues, so we'll use a simplified approach
      console.log('[Resume Parsing] Processing file:', req.file.originalname, 'Type:', req.file.mimetype);
      
      // Extract any visible text from the buffer (works for some document formats)
      try {
        const bufferText = req.file.buffer.toString('utf-8', 0, Math.min(req.file.buffer.length, 5000));
        const cleanText = bufferText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (cleanText && cleanText.length > 100) {
          resumeText = cleanText;
          console.log('[Resume Parsing] Extracted text from buffer, length:', resumeText.length);
        } else {
          // If we can't extract text, use filename and provide instructions to AI
          resumeText = `Unable to extract text from ${req.file.originalname}. Please ask the user to provide candidate details manually or upload a text file.`;
        }
      } catch (error) {
        console.log('[Resume Parsing] Could not extract text from buffer');
        resumeText = `Resume file: ${req.file.originalname}`;
      }
    }

    // Use OpenAI to parse the resume
    const { LLMRouter } = await import('./services/llm/router');
    const llmRouter = new LLMRouter();
    
    const prompt = `Parse the following resume content and extract the candidate's information. 
    
    Important: If the text appears to be garbled or you cannot extract clear information, return reasonable null values.
    
    Return a JSON object with the following fields (use null or empty string for any field that cannot be determined):
    {
      "firstName": "string or null",
      "lastName": "string or null", 
      "email": "string or null",
      "phone": "string or null",
      "position": "string (best guess for position they are qualified for) or null",
      "summary": "string (brief summary if text is readable, otherwise null)",
      "skills": ["array of skills if identifiable, otherwise empty array"],
      "experience": "string or null",
      "education": "string or null"
    }
    
    Resume content:
    ${resumeText.substring(0, 3000)}`; // Limit text to avoid token limits

    let parsedData;
    try {
      const taskContext = {
        taskType: 'extraction' as const,
        priority: 'medium' as const,
        requiresPrivacy: false,
        expectedResponseTime: 'normal' as const
      };
      const response = await llmRouter.generateJSON(prompt, taskContext);
      parsedData = response.data;
    } catch (error) {
      console.error('[Resume Parsing] AI parsing failed:', error);
      // Fallback to basic parsing if AI fails
      parsedData = {
        firstName: '',
        lastName: '',
        email: extractEmail(resumeText),
        phone: extractPhone(resumeText),
        position: '',
        summary: resumeText.substring(0, 500),
        skills: [],
        experience: '',
        education: ''
      };
    }

    // Add the resume URL to the parsed data
    const result = { ...parsedData, resumeUrl };

    res.json(result);
  } catch (error: any) {
    console.error('[Resume Parsing] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse resume' });
  }
});

// Helper functions for fallback parsing
function extractEmail(text: string): string {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0] : '';
}

function extractPhone(text: string): string {
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const match = text.match(phoneRegex);
  return match ? match[0] : '';
}

// Direct hire endpoint - bypass candidate process and directly create employee
router.post('/api/employees/direct-hire', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    const { firstName, lastName, email, phone, position, department, startDate, salary, reportingTo, shirtSize, welcomePackageId, toolIds, notes } = req.body;

    // Validate required fields (salary is now optional)
    if (!firstName || !lastName || !email || !phone || !position || !department || !startDate || !shirtSize) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email domain - only @theroofdocs.com allowed for new hires
    const ALLOWED_DOMAIN = 'theroofdocs.com';
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (emailDomain !== ALLOWED_DOMAIN) {
      return res.status(400).json({
        error: 'New hire email must be @theroofdocs.com'
      });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate temporary password (standard for all new hires)
    const tempPassword = 'Welcome2024!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Create employee account with shirt size
    const newEmployee = await storage.createUser({
      email,
      firstName,
      lastName,
      phone,
      passwordHash: hashedPassword,
      role: 'EMPLOYEE',
      department,
      position,
      hireDate: startDate,
      isActive: true,
      mustChangePassword: true,
      employmentType: 'FULL_TIME',
      shirtSize
    });
    
    // Create Google Drive folder for the employee (optional - continues if fails)
    let googleDriveFolderCreated = false;
    try {
      const { googleSyncEnhanced } = await import('./services/google-sync-enhanced');
      const folderStructure = await googleSyncEnhanced.getOrCreateEmployeeFolder(newEmployee);
      if (folderStructure) {
        googleDriveFolderCreated = true;
        console.log(`[Direct Hire] Google Drive folder created for ${firstName} ${lastName}`);
      } else {
        console.log('[Direct Hire] Google Drive folder creation returned null - may not be configured');
      }
    } catch (error) {
      console.error('[Direct Hire] Failed to create Google Drive folder (non-blocking):', error);
      // Continue with onboarding - Google Drive is optional
    }
    
    // Create PTO policy based on employment type and department
    try {
      const ptoAllocation = getPtoAllocation(newEmployee.employmentType, newEmployee.department);
      await storage.createPtoPolicy({
        employeeId: newEmployee.id,
        policyLevel: 'INDIVIDUAL',
        totalDays: ptoAllocation.totalDays,
        baseDays: ptoAllocation.totalDays,
        vacationDays: ptoAllocation.vacationDays,
        sickDays: ptoAllocation.sickDays,
        personalDays: ptoAllocation.personalDays,
        additionalDays: 0,
        usedDays: 0,
        remainingDays: ptoAllocation.totalDays,
        notes: ptoAllocation.totalDays === 0 ? 'No PTO (1099/Sales)' : 'Initial PTO allocation'
      });
      console.log(`[Direct Hire] PTO balance created for ${firstName} ${lastName} (${ptoAllocation.totalDays} days)`);
    } catch (error) {
      console.error('Failed to create PTO policy:', error);
    }
    
    // Assign welcome package if selected
    let welcomePackageAssigned = false;
    if (welcomePackageId) {
      try {
        // Get bundle items
        const bundleItemsList = await db
          .select()
          .from(bundleItems)
          .where(eq(bundleItems.bundleId, welcomePackageId));
        
        // Create bundle assignment
        const assignmentId = uuidv4();
        await db.insert(bundleAssignments).values({
          id: assignmentId,
          bundleId: welcomePackageId,
          employeeId: newEmployee.id,
          assignedBy: user.id,
          assignedDate: new Date(),
          status: 'FULFILLED' as const
        });
        
        // Create assignment items with size selections and update inventory
        for (const item of bundleItemsList) {
          await db.insert(bundleAssignmentItems).values({
            id: uuidv4(),
            assignmentId,
            bundleItemId: item.id, // Add the required bundle item ID
            quantity: item.quantity,
            size: item.requiresSize ? shirtSize : null,
            status: 'ASSIGNED'
          });
          
          // Update inventory for clothing items
          if (item.itemCategory === 'CLOTHING') {
            const inventoryItems = await db
              .select()
              .from(toolInventory)
              .where(
                and(
                  eq(toolInventory.name, item.itemName),
                  eq(toolInventory.category, 'POLO' as const)
                )
              );
            
            if (inventoryItems[0] && inventoryItems[0].availableQuantity >= item.quantity) {
              await db
                .update(toolInventory)
                .set({
                  availableQuantity: inventoryItems[0].availableQuantity - item.quantity,
                  updatedAt: new Date()
                })
                .where(eq(toolInventory.id, inventoryItems[0].id));
            }
          }
        }
        welcomePackageAssigned = true;
        console.log(`[Direct Hire] Welcome package assigned for ${firstName} ${lastName}`);
      } catch (err) {
        console.error('Failed to assign welcome package:', err);
      }
    }
    
    // Assign tools and update inventory
    let toolsAssigned = 0;
    if (toolIds && toolIds.length > 0) {
      try {
        for (const toolId of toolIds) {
          // Get tool details
          const tools = await db
            .select()
            .from(toolInventory)
            .where(eq(toolInventory.id, toolId));
          
          const tool = tools[0];
          if (tool && tool.availableQuantity > 0) {
            // Create tool assignment
            await db.insert(toolAssignments).values({
              id: uuidv4(),
              toolId: tool.id,
              employeeId: newEmployee.id,
              assignedBy: user.id,
              assignedDate: new Date(),
              status: 'ASSIGNED',
              condition: tool.condition,
              notes: `Assigned during onboarding for ${position} position`
            });
            
            // Update tool availability
            await db
              .update(toolInventory)
              .set({
                availableQuantity: tool.availableQuantity - 1,
                updatedAt: new Date()
              })
              .where(eq(toolInventory.id, tool.id));
            
            toolsAssigned++;
          }
        }
        console.log(`[Direct Hire] ${toolsAssigned} tools assigned to ${firstName} ${lastName}`);

        // Create equipment receipt if tools were assigned
        if (toolsAssigned > 0) {
          try {
            // Get tool names for receipt
            const toolDetails = await db
              .select()
              .from(toolInventory)
              .where(eq(toolInventory.id, toolIds[0])); // Get first tool as example

            // Fetch all assigned tool details
            const assignedToolDetails: Array<{ toolId: string; toolName: string; quantity: number }> = [];
            for (const toolId of toolIds) {
              const tools = await db.select().from(toolInventory).where(eq(toolInventory.id, toolId));
              if (tools[0]) {
                assignedToolDetails.push({
                  toolId: tools[0].id,
                  toolName: tools[0].name,
                  quantity: 1
                });
              }
            }

            if (assignedToolDetails.length > 0) {
              await equipmentReceiptService.createReceipt({
                employeeId: newEmployee.id,
                employeeName: `${firstName} ${lastName}`,
                position,
                startDate: new Date(startDate),
                items: assignedToolDetails,
                createdBy: user.id
              });
              console.log(`[Direct Hire] Equipment receipt created for ${firstName} ${lastName}`);
            }
          } catch (receiptErr) {
            console.error('Failed to create equipment receipt:', receiptErr);
          }
        }
      } catch (err) {
        console.error('Failed to assign tools:', err);
      }
    }

    // Send welcome email with credentials (from logged-in user's email)
    const emailService = new EmailService();
    await emailService.initialize();
    const emailSuccess = await emailService.sendWelcomeEmail(newEmployee, tempPassword, user.email);

    // Create onboarding tasks
    const onboardingTasks = [
      {
        employeeId: newEmployee.id,
        title: 'Complete I-9 Form',
        description: 'Complete employment eligibility verification',
        dueDate: new Date(startDate),
        status: 'PENDING'
      },
      {
        employeeId: newEmployee.id,
        title: 'Sign Employment Contract',
        description: 'Review and sign your employment agreement',
        dueDate: new Date(startDate),
        status: 'PENDING'
      },
      {
        employeeId: newEmployee.id,
        title: 'Complete Safety Training',
        description: 'Complete mandatory safety orientation',
        dueDate: new Date(new Date(startDate).getTime() + 3 * 24 * 60 * 60 * 1000),
        status: 'PENDING'
      },
      {
        employeeId: newEmployee.id,
        title: 'Tools & Equipment Assignment',
        description: 'Receive and acknowledge assigned tools and equipment',
        dueDate: new Date(startDate),
        status: toolsAssigned > 0 ? 'COMPLETED' : 'PENDING'
      },
      {
        employeeId: newEmployee.id,
        title: 'Benefits Enrollment',
        description: 'Enroll in company benefits programs',
        dueDate: new Date(new Date(startDate).getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'PENDING'
      },
      {
        employeeId: newEmployee.id,
        title: 'Complete Online Training',
        description: 'Complete required training at https://a21.up.railway.app/ before your first day',
        dueDate: new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000), // 1 day before start
        status: 'PENDING'
      }
    ];
    
    // Store onboarding tasks
    for (const task of onboardingTasks) {
      await storage.createTask({
        ...task,
        assignedBy: user.id,
        assignedTo: newEmployee.id,
        priority: 'MEDIUM',
        category: 'ONBOARDING', // Add required category field
        tags: [] // Add required tags field (empty array)
      });
    }
    
    // Log the onboarding action
    console.log(`[Direct Hire] Created employee account for ${firstName} ${lastName}`);
    console.log(`[Direct Hire] Welcome email sent: ${emailSuccess}`);
    console.log(`[Direct Hire] ${onboardingTasks.length} onboarding tasks created`);

    // Auto-generate employment contract
    let contractGenerated = false;
    let contractId: string | null = null;
    try {
      // Try to find a default employment template
      const templates = await storage.getAllContractTemplates();
      const employmentTemplate = templates.find(t =>
        t.type === 'EMPLOYMENT' && t.isActive
      );

      // Create contract content - use template if available, otherwise use default
      let contractContent = '';
      if (employmentTemplate) {
        contractContent = employmentTemplate.content
          .replace(/\{\{name\}\}/g, `${firstName} ${lastName}`)
          .replace(/\{\{employeeName\}\}/g, `${firstName} ${lastName}`)
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{lastName\}\}/g, lastName)
          .replace(/\{\{position\}\}/g, position)
          .replace(/\{\{department\}\}/g, department)
          .replace(/\{\{email\}\}/g, email)
          .replace(/\{\{startDate\}\}/g, new Date(startDate).toLocaleDateString())
          .replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
      } else {
        // Default contract content when no template exists
        contractContent = `
EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into as of ${new Date().toLocaleDateString()},
by and between ROOF-ER ("Company") and ${firstName} ${lastName} ("Employee").

1. POSITION AND DUTIES
Employee is hired for the position of ${position} in the ${department} department.
Employee agrees to perform duties as assigned and comply with all company policies.

2. START DATE
Employment shall commence on ${new Date(startDate).toLocaleDateString()}.

3. COMPENSATION
Compensation details will be provided separately in an official offer letter.

4. AT-WILL EMPLOYMENT
This employment is at-will, meaning either party may terminate the relationship at any time.

5. CONFIDENTIALITY
Employee agrees to maintain confidentiality of all proprietary information.

6. ACKNOWLEDGMENT
By signing below, Employee acknowledges receipt and understanding of this Agreement.

_____________________________          _____________________________
Employee Signature                      Date

_____________________________          _____________________________
Company Representative                  Date
        `.trim();
      }

      // Create the employee contract
      const contract = await storage.createEmployeeContract({
        id: uuidv4(),
        employeeId: newEmployee.id,
        templateId: employmentTemplate?.id || null,
        recipientName: `${firstName} ${lastName}`,
        recipientEmail: email,
        title: `Employment Agreement - ${firstName} ${lastName}`,
        content: contractContent,
        status: 'DRAFT',
        createdBy: user.id,
      });

      contractGenerated = true;
      contractId = contract.id;
      console.log(`[Direct Hire] Employment contract generated for ${firstName} ${lastName}`);
    } catch (contractErr) {
      console.error('[Direct Hire] Failed to generate employment contract (non-blocking):', contractErr);
    }

    res.json({
      success: true,
      employee: {
        id: newEmployee.id,
        name: `${firstName} ${lastName}`,
        email,
        position,
        department,
        startDate
      },
      onboarding: {
        emailSent: emailSuccess,
        tasksCreated: onboardingTasks.length,
        toolsAssigned: toolsAssigned,
        welcomePackageAssigned: welcomePackageAssigned,
        ptoBalanceCreated: true,
        googleDriveFolderCreated: googleDriveFolderCreated,
        contractGenerated: contractGenerated,
        contractId: contractId
      },
      message: `Employee account created successfully. Welcome email ${emailSuccess ? 'sent to' : 'failed to send to'} ${email}.`
    });
    
  } catch (error) {
    console.error('Error in direct hire:', error);
    res.status(500).json({ error: 'Failed to create employee and start onboarding' });
  }
});

// Dashboard routes
router.get('/api/dashboard/metrics', requireAuth, async (req, res) => {
  try {
    // Use Promise.all with individual catch handlers for graceful degradation
    const [users, ptoRequests, candidates] = await Promise.all([
      storage.getAllUsers().catch((err) => {
        console.error('[Dashboard] Failed to fetch users:', err.message);
        return [];
      }),
      storage.getAllPtoRequests().catch((err) => {
        console.error('[Dashboard] Failed to fetch PTO requests:', err.message);
        return [];
      }),
      storage.getAllCandidates().catch((err) => {
        console.error('[Dashboard] Failed to fetch candidates:', err.message);
        return [];
      }),
    ]);

    const metrics = {
      activeEmployees: users.filter(u => u.isActive).length,
      pendingPTO: ptoRequests.filter(p => p.status === 'PENDING').length,
      activeCandidates: candidates.filter(c => c.status !== 'REJECTED' && c.status !== 'HIRED').length,
      totalDocuments: 0,
      pendingReviews: 0,
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    // Return empty metrics instead of failing completely
    res.json({
      activeEmployees: 0,
      pendingPTO: 0,
      activeCandidates: 0,
      totalDocuments: 0,
      pendingReviews: 0,
      _error: 'Some metrics may be unavailable'
    });
  }
});

// Google Integration Status endpoint
router.get('/api/google/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = {
      serviceAccountConfigured: serviceAccountAuth.isConfigured(),
      driveConfigured: googleDriveService.isConfigured(),
      driveInitialized: googleDriveService.isInitialized(),
      oauthConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN),
      emailMode: serviceAccountAuth.isConfigured() ? 'service_account_impersonation' :
                 (process.env.GOOGLE_REFRESH_TOKEN ? 'oauth2' :
                 (process.env.GOOGLE_APP_PASSWORD ? 'app_password' : 'development')),
      configuredFeatures: {
        email: !!(process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_APP_PASSWORD || serviceAccountAuth.isConfigured()),
        drive: googleDriveService.isConfigured(),
        calendar: serviceAccountAuth.isConfigured(),
        sheets: serviceAccountAuth.isConfigured(),
      },
      environmentVariables: {
        GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 'SET' : 'NOT SET',
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
        GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN ? 'SET' : 'NOT SET',
        GOOGLE_APP_PASSWORD: !!process.env.GOOGLE_APP_PASSWORD ? 'SET' : 'NOT SET',
        GOOGLE_USER_EMAIL: process.env.GOOGLE_USER_EMAIL || 'NOT SET',
      }
    };

    res.json(status);
  } catch (error) {
    console.error('[Google Status] Error:', error);
    res.status(500).json({ error: 'Failed to get Google status' });
  }
});

// Employee Reviews routes
router.get('/api/reviews', requireAuth, async (req: any, res) => {
  try {
    let reviews;
    if (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') {
      reviews = await storage.getAllEmployeeReviews();
    } else {
      reviews = await storage.getEmployeeReviewsByEmployeeId(req.user.id);
    }
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee reviews' });
  }
});

router.post('/api/reviews', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    const data = insertEmployeeReviewSchema.parse(req.body);
    const review = await storage.createEmployeeReview({
      ...data,
      reviewerId: user.id,
      status: 'DRAFT',
    });
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: 'Invalid request data' });
  }
});

router.patch('/api/reviews/:id', requireAuth, async (req: any, res) => {
  try {
    const review = await storage.updateEmployeeReview(req.params.id, req.body);
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update review' });
  }
});

// Document routes
router.get('/api/documents', requireAuth, async (req, res) => {
  try {
    const documents = await storage.getAllDocuments();
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/api/documents', requireAuth, requireManager, async (req: any, res) => {
  try {
    const user = req.user!;
    // Map the incoming fields to match schema expectations
    const mappedData = {
      name: req.body.name || req.body.title || 'Untitled Document',
      originalName: req.body.originalName || req.body.title || req.body.name || 'document',
      type: req.body.type || 'PDF',
      category: req.body.category || 'OTHER',
      description: req.body.description,
      fileUrl: req.body.fileUrl,
      fileSize: req.body.fileSize || 0,
      visibility: req.body.visibility || 'EMPLOYEE',
      status: req.body.status || 'DRAFT',
      createdBy: user.id,
      version: '1.0',
      tags: req.body.tags || []
    };

    const data = insertDocumentSchema.parse(mappedData);
    const document = await storage.createDocument(data);
    res.json(document);
  } catch (error: any) {
    console.error('Document creation error:', error);
    if (error.issues) {
      console.error('Validation issues:', error.issues);
      res.status(400).json({ 
        error: 'Invalid request data',
        details: error.issues
      });
    } else {
      res.status(400).json({ error: error.message || 'Invalid request data' });
    }
  }
});

router.patch('/api/documents/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const document = await storage.updateDocument(req.params.id, req.body);
    res.json(document);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update document' });
  }
});

router.delete('/api/documents/:id', requireAuth, requireManager, async (req, res) => {
  try {
    await storage.deleteDocument(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete document' });
  }
});

// Settings routes
router.get('/api/settings', requireAuth, requireManager, async (req, res) => {
  try {
    const settings = await storage.getCompanySettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/api/settings', requireAuth, requireManager, async (req, res) => {
  try {
    const settings = await storage.updateCompanySettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update settings' });
  }
});

// HR Agent Management routes are now handled in agents.ts using AgentManager
// These routes have been moved to maintain consistency with the agent execution system

export function registerRoutes(app: express.Application) {
  // Apply authentication middleware to all routes
  app.use(async (req: any, res, next) => {
    // First check for Bearer token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const session = await storage.getSessionByToken(token);
        if (session && new Date(session.expiresAt) > new Date()) {
          const user = await storage.getUserById(session.userId);
          if (user) {
            req.user = user;
            return next();
          }
        }
      } catch (error) {
        // Invalid token, continue without user
      }
    }
    
    // Check for session-based authentication (from login)
    if (req.session && req.session.userId) {
      try {
        const user = await storage.getUserById(req.session.userId);
        if (user) {
          req.user = user;
        }
      } catch (error) {
        // Session user not found
      }
    }
    
    next();
  });

  // API Metrics middleware - capture performance data for Super Admin
  app.use(apiMetricsMiddleware);

  // Mount all API routes under /api prefix
  app.use(router);
  
  // Mount agent routes
  app.use(agentRoutes);
  
  // Mount document routes
  app.use('/api/documents', documentRoutes);
  
  // Mount email routes
  app.use('/api/emails', emailRoutes);
  
  // Mount Google auth routes
  app.use(googleAuthRoutes);
  
  // Mount recruitment bot routes
  app.use('/api/recruitment-bot', recruitmentBotRoutes);
  
  // Mount chatbot routes
  app.use('/api/recruitment-bot', chatbotRoutes);
  
  // Mount job posting routes
  app.use(jobPostingRoutes);
  
  // Mount candidate import routes
  app.use(candidateImportRoutes);
  
  // Mount interview scheduling routes
  app.use('/api', interviewSchedulingRoutes);
  
  // Mount interview routes
  app.use('/api/interviews', interviewRoutes);
  
  // Mount email campaign routes  
  app.use(emailCampaignRoutes);
  
  // Mount workflow routes
  app.use(workflowRoutes);
  
  // Mount AI enhancement routes
  app.use('/api/ai', aiEnhancementRoutes);
  
  // Mount AI criteria routes
  app.use('/api/ai-criteria', aiCriteriaRoutes);
  
  // Mount analytics routes
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/recruiting-analytics', recruitingAnalyticsRoutes);
  
  // Mount tools routes
  app.use('/api/tools', toolsRoutes);
  
  // Mount test features routes
  app.use(testFeaturesRoutes);
  
  // Mount email template routes
  app.use(emailTemplateRoutes);
  
  // Mount email AI routes
  app.use(emailAIRoutes);
  
  // Mount new feature routes
  app.use(territoryRoutes);
  app.use(ptoPolicyRoutes);
  app.use(coiDocumentRoutes);
  app.use(employeeAssignmentRoutes);
  app.use(contractRoutes);
  app.use(sourcerAssignmentRoutes);

  // Mount Susan AI routes - both endpoints for compatibility
  app.use('/api/susan-ai', susanAIRoutes);
  app.use('/api/susan', susanAIRoutes); // Support both endpoints for orb and main page
  
  // Mount Google services routes
  app.use('/api/google', googleServicesRoutes);
  
  // Mount Google sync routes
  app.use(googleSyncRoutes);
  
  // Mount Google Drive upload routes
  app.use(googleDriveUploadRoutes);
  
  // Mount attendance routes
  app.use('/api/attendance', attendanceRoutes);

  // Mount equipment receipt routes
  app.use(equipmentReceiptRoutes);

  // Mount employee portal routes
  app.use(employeePortalRoutes);

  // Mount equipment agreement routes
  app.use(equipmentAgreementRoutes);

  // Mount LLM status routes
  app.use(llmStatusRoutes);

  // Mount Super Admin routes (Ahmed only)
  app.use('/api/super-admin', superAdminRoutes);

  // Mount Email Preferences routes
  app.use(emailPreferencesRoutes);

  // Mount Candidate Import Logs routes
  app.use(candidateImportLogsRoutes);

  // Mount AI Evaluations routes
  app.use(aiEvaluationsRoutes);

  // Mount Recruitment Bot Conversations routes
  app.use(recruitmentBotConversationsRoutes);

  // Mount Agent Interactions routes
  app.use(agentInteractionsRoutes);

  // Mount Onboarding Templates routes
  app.use(onboardingTemplatesRoutes);

  // Mount Scheduled Reports routes
  app.use(scheduledReportsRoutes);

  // Mount Meeting Rooms routes
  app.use('/api/meeting-rooms', meetingRoomsRoutes);

  // Mount Meetings routes
  app.use('/api/meetings', meetingsRoutes);

  // Mount test harmony routes (development only)
  if (process.env.NODE_ENV !== 'production') {
    app.use(testHarmonyRoutes);
  }
  
  // Screening failure alert endpoint
  app.post('/api/alerts/screening-failure', async (req, res) => {
    try {
      const { candidateId, candidateName, position, failedRequirements, notes, timestamp } = req.body;
      
      // Get all managers and admins
      const managersAndAdmins = await storage.getUsersByRoles(['MANAGER', 'ADMIN', 'TRUE_ADMIN']);
      
      // Log the alert
      console.log(`[SCREENING ALERT] Candidate ${candidateName} (${position}) failed screening requirements:`, failedRequirements);
      console.log(`Notes: ${notes}`);
      
      // Create notification for each manager/admin
      for (const user of managersAndAdmins) {
        try {
          await storage.createNotification({
            userId: user.id,
            type: 'warning' as const,
            title: 'Interview Screening Alert',
            message: `${candidateName} for ${position} position failed screening: ${failedRequirements.join(', ')}. Notes: ${notes}`,
            metadata: JSON.stringify({
              candidateId,
              candidateName,
              position,
              failedRequirements,
              notes,
              timestamp
            }),
            link: `/recruiting?candidate=${candidateId}`
          });
        } catch (notifError: any) {
          console.error('[Screening Alert] Failed to create notification:', notifError.message);
        }
      }
      
      // Send email alerts (if email service is configured)
      const emailService = new EmailService();
      for (const user of managersAndAdmins) {
        if (user.email) {
          try {
            await emailService.sendEmail({
              to: user.email,
              subject: `Interview Screening Alert: ${candidateName}`,
              html: `
                <h3>Interview Screening Alert</h3>
                <p>Candidate <strong>${candidateName}</strong> for the <strong>${position}</strong> position has not met all screening requirements:</p>
                <ul>
                  ${failedRequirements.map((req: string) => `<li>${req}</li>`).join('')}
                </ul>
                <p><strong>Notes from Screener:</strong> ${notes}</p>
                <p>Despite not meeting all requirements, the screener has chosen to proceed with the interview.</p>
                <p>Please review this candidate's status at your earliest convenience.</p>
              `
            });
          } catch (emailError) {
            console.error(`Failed to send alert email to ${user.email}:`, emailError);
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Alerts sent successfully',
        recipientCount: managersAndAdmins.length 
      });
    } catch (error) {
      console.error('Error sending screening alerts:', error);
      res.status(500).json({ error: 'Failed to send alerts' });
    }
  });
  
  // Notification endpoints
  app.get('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  app.patch('/api/notifications/read-all', requireAuth, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  app.delete('/api/notifications/clear', requireAuth, async (req: any, res) => {
    try {
      await storage.clearNotifications(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing notifications:', error);
      res.status(500).json({ error: 'Failed to clear notifications' });
    }
  });

  // Search endpoint
  app.get('/api/search', requireAuth, async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) {
        return res.json([]);
      }

      const results = await storage.search(q, req.user.role);
      res.json(results);
    } catch (error) {
      console.error('Error searching:', error);
      res.status(500).json({ error: 'Failed to search' });
    }
  });

  // Test endpoint for comprehensive workflow testing
  app.post('/api/test-workflow', async (req: any, res) => {
    try {
      // For testing purposes in development
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Test only available in development' });
      }

      console.log('Starting comprehensive workflow test...');
      
      // Import and run the test
      const runTest = (await import('./test-recruitment-workflow')).default;
      const results = await runTest();
      
      res.json({
        success: true,
        results,
        message: `Test completed: ${results.successfulSteps}/${results.totalSteps} steps successful`
      });
    } catch (error) {
      console.error('Workflow test error:', error);
      res.status(500).json({ 
        error: 'Test failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test endpoint for new hire welcome email
  app.post('/api/test/welcome-email', requireAuth, requireManager, async (req: any, res) => {
    try {
      const {
        recipientEmail,
        firstName,
        lastName,
        startDate,
        position = 'Sales Representative',
        department = 'Sales',
        ccRecipients = []  // NEW: CC recipients array
      } = req.body;

      if (!recipientEmail || !firstName || !lastName) {
        return res.status(400).json({
          error: 'Missing required fields: recipientEmail, firstName, lastName'
        });
      }

      console.log(`[Test Welcome Email] Sending to ${recipientEmail}`);
      console.log(`[Test Welcome Email] CC recipients: ${ccRecipients.join(', ') || 'none'}`);
      console.log(`[Test Welcome Email] Employee: ${firstName} ${lastName}`);

      const emailService = new EmailService();
      await emailService.initialize();

      // Create test user data
      const testUser = {
        firstName,
        lastName,
        email: recipientEmail,
        position,
        department,
        hireDate: startDate ? new Date(startDate) : undefined,
        shirtSize: 'L' // Default for test
      };

      // Parse start date or use upcoming Monday
      const parsedStartDate = startDate ? new Date(startDate) : undefined;

      // Send the new hire welcome email with CC support
      const user = req.user!;
      const success = await emailService.sendWelcomeEmail(
        testUser,
        'TRD2025!', // Placeholder password since this is a test
        user.email, // From user email
        {
          startDate: parsedStartDate,
          includeAttachments: true,
          includeEquipmentChecklist: true,
          ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
        }
      );

      if (success) {
        res.json({
          success: true,
          message: `Welcome email sent successfully to ${recipientEmail}`,
          details: {
            recipient: recipientEmail,
            ccRecipients: ccRecipients.length > 0 ? ccRecipients : 'none',
            employeeName: `${firstName} ${lastName}`,
            position,
            department,
            attachmentsIncluded: true
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send welcome email'
        });
      }
    } catch (error: any) {
      console.error('[Test Welcome Email] Error:', error);
      res.status(500).json({
        error: 'Failed to send test welcome email',
        details: error.message
      });
    }
  });

  // ===== EQUIPMENT CHECKLIST MANAGEMENT (Protected Routes) =====

  // Create new equipment checklist and get form URL
  app.post('/api/equipment-checklists', requireAuth, async (req: any, res) => {
    try {
      const { employeeId, employeeName, employeeEmail, type = 'ISSUED' } = req.body;

      if (!employeeName || !employeeEmail) {
        return res.status(400).json({ error: 'Employee name and email are required' });
      }

      // Generate unique token
      const accessToken = uuidv4();

      const checklist = await storage.createEquipmentChecklist({
        employeeId: employeeId || null,
        employeeName,
        employeeEmail,
        accessToken,
        type,
        status: 'PENDING',
      });

      // Generate form URL
      const baseUrl = process.env.APP_URL || 'http://localhost:5050';
      const formUrl = `${baseUrl}/equipment-checklist/${accessToken}`;

      res.json({
        success: true,
        checklist: {
          id: checklist.id,
          employeeName: checklist.employeeName,
          type: checklist.type,
          status: checklist.status,
        },
        formUrl,
      });
    } catch (error) {
      console.error('Error creating equipment checklist:', error);
      res.status(500).json({ error: 'Failed to create equipment checklist' });
    }
  });

  // List all equipment checklists
  app.get('/api/equipment-checklists', requireAuth, async (req: any, res) => {
    try {
      const checklists = await storage.getAllEquipmentChecklists();
      res.json(checklists);
    } catch (error) {
      console.error('Error fetching equipment checklists:', error);
      res.status(500).json({ error: 'Failed to fetch equipment checklists' });
    }
  });

  // Get equipment checklists by employee
  app.get('/api/equipment-checklists/employee/:employeeId', requireAuth, async (req: any, res) => {
    try {
      const { employeeId } = req.params;
      const checklists = await storage.getEquipmentChecklistsByEmployee(employeeId);
      res.json(checklists);
    } catch (error) {
      console.error('Error fetching employee equipment checklists:', error);
      res.status(500).json({ error: 'Failed to fetch equipment checklists' });
    }
  });

  // Resend equipment checklist email
  app.post('/api/equipment-checklists/:id/resend', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const checklist = await storage.getEquipmentChecklistById(id);

      if (!checklist) {
        return res.status(404).json({ error: 'Equipment checklist not found' });
      }

      // Generate form URL
      const baseUrl = process.env.APP_URL || 'http://localhost:5050';
      const formUrl = `${baseUrl}/equipment-checklist/${checklist.accessToken}`;

      // Send email
      const emailService = new EmailService();
      await emailService.initialize();

      const subject = checklist.type === 'RETURNED'
        ? 'Equipment Return Form - Roof-ER'
        : 'Equipment Checklist - Roof-ER';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a5f;">Equipment ${checklist.type === 'RETURNED' ? 'Return' : 'Checklist'} Form</h2>
          <p>Hello ${checklist.employeeName},</p>
          <p>Please complete the equipment ${checklist.type === 'RETURNED' ? 'return' : 'checklist'} form:</p>
          <p><a href="${formUrl}" style="background-color: #1e3a5f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Form</a></p>
          <p>Or copy this link: ${formUrl}</p>
          <p>Thank you,<br>Roof-ER HR Team</p>
        </div>
      `;

      await emailService.sendEmail({
        to: checklist.employeeEmail,
        subject,
        html,
      });

      res.json({ success: true, message: 'Equipment checklist email sent' });
    } catch (error) {
      console.error('Error resending equipment checklist:', error);
      res.status(500).json({ error: 'Failed to resend equipment checklist' });
    }
  });

  // ===== TERMINATION WORKFLOW ROUTES =====

  // Create termination reminder (when user is terminated)
  app.post('/api/termination-reminders', requireAuth, async (req: any, res) => {
    try {
      const { employeeId, employeeName, employeeEmail, terminationDate, sendEquipmentForm = true } = req.body;

      if (!employeeId || !employeeName || !employeeEmail || !terminationDate) {
        return res.status(400).json({ error: 'Employee ID, name, email, and termination date are required' });
      }

      let checklistId = null;
      let scheduleUrl = null;
      let checklistUrl = null;

      // Create equipment return checklist FIRST if requested (so we can link it to reminder)
      if (sendEquipmentForm) {
        const accessToken = uuidv4();
        const checklist = await storage.createEquipmentChecklist({
          employeeId,
          employeeName,
          employeeEmail,
          accessToken,
          type: 'RETURNED',
          status: 'PENDING',
        });

        checklistId = checklist.id;
        const baseUrl = process.env.APP_URL || 'http://localhost:5050';
        scheduleUrl = `${baseUrl}/equipment-return/${accessToken}`;  // Schedule dropoff
        checklistUrl = `${baseUrl}/equipment-checklist/${accessToken}`;  // Sign checklist
      }

      // Create termination reminder with link to checklist
      const reminder = await storage.createTerminationReminder({
        employeeId,
        employeeName,
        employeeEmail,
        terminationDate: new Date(terminationDate),
        equipmentChecklistId: checklistId,
        formSentAt: sendEquipmentForm ? new Date() : null,
      });

      // Send email to terminated employee with scheduling option
      if (sendEquipmentForm && scheduleUrl && checklistUrl) {
        const emailService = new EmailService();
        await emailService.initialize();

        const termDate = new Date(terminationDate);
        const formattedTermDate = termDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        await emailService.sendEmail({
          to: employeeEmail,
          cc: ['careers@theroofdocs.com', 'support@theroofdocs.com'],
          subject: 'Equipment Return Required - Schedule Your Dropoff',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
              <div style="background-color: #1e3a5f; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Return Required</h1>
              </div>

              <div style="padding: 30px;">
                <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello ${employeeName},</p>

                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  As part of your offboarding process (effective ${formattedTermDate}), you are required to return all company equipment.
                </p>

                <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                  <strong style="color: #92400e;">⚠️ Important:</strong>
                  <p style="margin: 10px 0 0 0; color: #78350f;">
                    All equipment must be returned within <strong>15 days</strong> of your termination date.
                    Unreturned items will result in paycheck deductions per the equipment agreement you signed.
                  </p>
                </div>

                <h3 style="color: #1e3a5f; margin-top: 25px;">Step 1: Schedule Your Dropoff</h3>
                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  Select a convenient date and time to drop off your equipment at the office.
                </p>
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${scheduleUrl}"
                     style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px;
                            text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    📅 Schedule Dropoff Time
                  </a>
                </div>

                <h3 style="color: #1e3a5f; margin-top: 25px;">Step 2: Bring Your Equipment</h3>
                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  On your scheduled day, bring all company equipment to the office.
                </p>

                <h3 style="color: #1e3a5f; margin-top: 25px;">Step 3: Sign Equipment Return Form</h3>
                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  After returning your items, complete the equipment return checklist.
                </p>
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${checklistUrl}"
                     style="display: inline-block; background-color: #059669; color: white; padding: 14px 28px;
                            text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    ✅ Complete Return Checklist
                  </a>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

                <p style="font-size: 13px; color: #666;">
                  <strong>Schedule Link:</strong> <a href="${scheduleUrl}" style="color: #2563eb;">${scheduleUrl}</a><br>
                  <strong>Checklist Link:</strong> <a href="${checklistUrl}" style="color: #059669;">${checklistUrl}</a>
                </p>

                <p style="font-size: 15px; line-height: 1.7; color: #333; margin-top: 20px;">
                  If you have any questions, please contact HR at careers@theroofdocs.com
                </p>

                <p style="font-size: 15px; line-height: 1.7; color: #333;">
                  Thank you,<br>
                  <strong>Roof-ER HR Team</strong>
                </p>
              </div>

              <div style="background-color: #f9fafb; padding: 15px; text-align: center;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                  This is an automated message from the Roof-ER HR system.
                </p>
              </div>
            </div>
          `,
        });

        console.log(`[Termination] Equipment return email sent to ${employeeEmail}`);
      }

      res.json({
        success: true,
        reminder: {
          id: reminder.id,
          employeeName: reminder.employeeName,
          terminationDate: reminder.terminationDate,
          equipmentChecklistId: checklistId,
        },
        scheduleUrl,
        checklistUrl,
      });
    } catch (error) {
      console.error('Error creating termination reminder:', error);
      res.status(500).json({ error: 'Failed to create termination reminder' });
    }
  });

  // Get all pending termination reminders
  app.get('/api/termination-reminders', requireAuth, async (req: any, res) => {
    try {
      const reminders = await storage.getPendingTerminationReminders();
      res.json(reminders);
    } catch (error) {
      console.error('Error fetching termination reminders:', error);
      res.status(500).json({ error: 'Failed to fetch termination reminders' });
    }
  });

  // Mark termination reminder as resolved
  app.patch('/api/termination-reminders/:id/resolve', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { itemsReturned, notes } = req.body;

      const reminder = await storage.updateTerminationReminder(id, {
        itemsReturned: itemsReturned ?? true,
        resolvedAt: new Date(),
        notes,
      });

      res.json({ success: true, reminder });
    } catch (error) {
      console.error('Error resolving termination reminder:', error);
      res.status(500).json({ error: 'Failed to resolve termination reminder' });
    }
  });

  // Check and send 15-day alerts (can be called by cron job or manually)
  app.post('/api/termination-reminders/check-alerts', requireAuth, async (req: any, res) => {
    try {
      const reminders = await storage.getPendingTerminationReminders();
      const alertsSent = [];

      for (const reminder of reminders) {
        const daysSinceTermination = Math.floor(
          (new Date().getTime() - new Date(reminder.terminationDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if 15 days passed and alert not already sent
        if (daysSinceTermination >= 15 && !reminder.alertSentAt) {
          const emailService = new EmailService();
          await emailService.initialize();

          // Send alert to HR team
          await emailService.sendEmail({
            to: 'careers@theroofdocs.com',
            cc: ['support@theroofdocs.com', 'info@theroofdocs.com'],
            subject: `Equipment Return Follow-up Required: ${reminder.employeeName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">⚠️ Equipment Return Alert</h2>
                <p><strong>15 days have passed</strong> since <strong>${reminder.employeeName}</strong> was terminated.</p>
                <p>Equipment has <strong>NOT</strong> been marked as returned.</p>
                <p><strong>Termination Date:</strong> ${new Date(reminder.terminationDate).toLocaleDateString()}</p>
                <p><strong>Days Since Termination:</strong> ${daysSinceTermination}</p>
                <hr style="border: 1px solid #ddd; margin: 20px 0;">
                <p>Please review and take appropriate action:</p>
                <ul>
                  <li>Contact the employee to retrieve company belongings</li>
                  <li>Update the system when items are returned</li>
                  <li>Initiate deduction process if items are not returned</li>
                </ul>
              </div>
            `,
          });

          // Update reminder to mark alert as sent
          await storage.updateTerminationReminder(reminder.id, {
            alertSentAt: new Date(),
          });

          alertsSent.push({
            employeeName: reminder.employeeName,
            daysSinceTermination,
          });
        }
      }

      res.json({
        success: true,
        alertsSent,
        message: `${alertsSent.length} alerts sent`,
      });
    } catch (error) {
      console.error('Error checking termination alerts:', error);
      res.status(500).json({ error: 'Failed to check termination alerts' });
    }
  });

  // ===== TOOL INVENTORY & BUNDLES FOR HIRE MODAL =====

  // Get all available tools for hire modal
  app.get('/api/tool-inventory', requireAuth, async (req: any, res) => {
    try {
      const tools = await db.select({
        id: toolInventory.id,
        name: toolInventory.name,
        category: toolInventory.category,
        availableQuantity: toolInventory.availableQuantity,
      })
        .from(toolInventory)
        .where(eq(toolInventory.isActive, true));

      res.json(tools);
    } catch (error) {
      console.error('Error fetching tool inventory:', error);
      res.status(500).json({ error: 'Failed to fetch tool inventory' });
    }
  });

  // Get all welcome pack bundles for hire modal
  app.get('/api/bundles', requireAuth, async (req: any, res) => {
    try {
      const bundles = await db.select({
        id: welcomePackBundles.id,
        name: welcomePackBundles.name,
        description: welcomePackBundles.description,
      })
        .from(welcomePackBundles)
        .where(eq(welcomePackBundles.isActive, true));

      res.json(bundles);
    } catch (error) {
      console.error('Error fetching bundles:', error);
      res.status(500).json({ error: 'Failed to fetch bundles' });
    }
  });

  // Add a catch-all for undefined API routes in production
  if (process.env.NODE_ENV === 'production') {
    app.use('/api/*', (req, res) => {
      console.log('Unhandled API route:', req.originalUrl);
      res.status(404).json({ error: 'API endpoint not found' });
    });
  }

  return app;
}
