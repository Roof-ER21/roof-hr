import express from 'express';
import { storage } from '../storage';
import { insertPtoPolicySchema, insertDepartmentPtoSettingSchema, ptoPolicies, users, departmentPtoSettings } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { PTO_POLICY, getPtoAllocation } from '../../shared/constants/pto-policy';
import { requireAuth, requireManager } from '../middleware/auth';
import { db } from '../db';
import { eq, inArray } from 'drizzle-orm';

const router = express.Router();

// Custom middleware for PTO policy endpoints
function requireGeneralManager(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Only General Manager (Ford Barsi) can approve PTO
  if (req.user.role !== 'GENERAL_MANAGER') {
    return res.status(403).json({ error: 'Only the General Manager can approve PTO requests' });
  }

  next();
}

// Get company-wide PTO policy
router.get('/api/pto/company-policy', requireAuth, async (req, res) => {
  try {
    const companyPolicy = await storage.getCompanyPtoPolicy();
    res.json(companyPolicy);
  } catch (error) {
    console.error('Error fetching company PTO policy:', error);
    res.status(500).json({ error: 'Failed to fetch company PTO policy' });
  }
});

// Update company-wide PTO policy
router.put('/api/pto/company-policy', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    // Only Ford Barsi, Ahmed Admin, or Support Admin can update company policy
    if (user.email !== 'ford.barsi@theroofdocs.com' &&
        user.email !== 'ahmed.mahmoud@theroofdocs.com' &&
        user.email !== 'support@theroofdocs.com' &&
        user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Ford Barsi, Ahmed Admin, or Support Admin can update company PTO policy' });
    }

    const updatedPolicy = await storage.updateCompanyPtoPolicy(req.body);

    const baseVacation = updatedPolicy?.vacationDays ?? PTO_POLICY.DEFAULT_VACATION_DAYS;
    const baseSick = updatedPolicy?.sickDays ?? PTO_POLICY.DEFAULT_SICK_DAYS;
    const basePersonal = updatedPolicy?.personalDays ?? PTO_POLICY.DEFAULT_PERSONAL_DAYS;
    const baseDays = baseVacation + baseSick + basePersonal;

    const companyPolicies = await db.select().from(ptoPolicies)
      .where(eq(ptoPolicies.policyLevel, 'COMPANY'));

    for (const policy of companyPolicies) {
      const additionalDays = policy.additionalDays || 0;
      const vacationDays = baseVacation + additionalDays;
      const totalDays = vacationDays + baseSick + basePersonal;
      const usedDays = policy.usedDays || 0;
      const remainingDays = Math.max(0, totalDays - usedDays);

      await db.update(ptoPolicies)
        .set({
          vacationDays,
          sickDays: baseSick,
          personalDays: basePersonal,
          baseDays,
          totalDays,
          remainingDays,
          updatedAt: new Date()
        })
        .where(eq(ptoPolicies.id, policy.id));
    }

    await db.update(departmentPtoSettings)
      .set({
        vacationDays: baseVacation,
        sickDays: baseSick,
        personalDays: basePersonal,
        totalDays: baseDays,
        updatedAt: new Date()
      })
      .where(eq(departmentPtoSettings.inheritFromCompany, true));

    res.json(updatedPolicy);
  } catch (error) {
    console.error('Error updating company PTO policy:', error);
    res.status(500).json({ error: 'Failed to update company PTO policy' });
  }
});

// Get all department PTO settings
router.get('/api/pto/department-settings', requireAuth, async (req, res) => {
  try {
    const settings = await storage.getAllDepartmentPtoSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching department PTO settings:', error);
    res.status(500).json({ error: 'Failed to fetch department PTO settings' });
  }
});

// Create department PTO settings
router.post('/api/pto/department-settings', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    // Only Ford Barsi, Ahmed Admin, or Support Admin can create department settings
    if (user.email !== 'ford.barsi@theroofdocs.com' &&
        user.email !== 'ahmed.mahmoud@theroofdocs.com' &&
        user.email !== 'support@theroofdocs.com' &&
        user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Ford Barsi, Ahmed Admin, or Support Admin can create department PTO settings' });
    }

    // Ensure all required fields are set and calculate totals correctly
    const vacationDays = parseInt(req.body.vacationDays) || PTO_POLICY.DEFAULT_VACATION_DAYS;
    const sickDays = parseInt(req.body.sickDays) || PTO_POLICY.DEFAULT_SICK_DAYS;
    const personalDays = parseInt(req.body.personalDays) || PTO_POLICY.DEFAULT_PERSONAL_DAYS;

    const settingsData = {
      department: req.body.department,
      vacationDays,
      sickDays,
      personalDays,
      totalDays: vacationDays + sickDays + personalDays,
      inheritFromCompany: req.body.inheritFromCompany !== false,
      customNotes: req.body.customNotes || null,
      createdBy: user.id
    };

    const newSettings = await storage.createDepartmentPtoSetting(settingsData);

    if (!newSettings.inheritFromCompany) {
      const deptEmployees = await db.select({ id: users.id }).from(users)
        .where(eq(users.department, newSettings.department));
      const employeeIds = deptEmployees.map((employee) => employee.id);

      if (employeeIds.length > 0) {
        const policies = await db.select().from(ptoPolicies)
          .where(inArray(ptoPolicies.employeeId, employeeIds));

        for (const policy of policies) {
          if (policy.policyLevel === 'INDIVIDUAL') continue;
          const additionalDays = policy.additionalDays || 0;
          const vacationDays = newSettings.vacationDays + additionalDays;
          const totalDays = vacationDays + newSettings.sickDays + newSettings.personalDays;
          const usedDays = policy.usedDays || 0;
          const remainingDays = Math.max(0, totalDays - usedDays);

          await db.update(ptoPolicies)
            .set({
              policyLevel: 'DEPARTMENT',
              vacationDays,
              sickDays: newSettings.sickDays,
              personalDays: newSettings.personalDays,
              baseDays: newSettings.totalDays,
              totalDays,
              remainingDays,
              updatedAt: new Date()
            })
            .where(eq(ptoPolicies.id, policy.id));
        }
      }
    }

    res.json(newSettings);
  } catch (error) {
    console.error('Error creating department PTO settings:', error);
    res.status(500).json({ error: 'Failed to create department PTO settings' });
  }
});

// Update department PTO settings
router.put('/api/pto/department-settings/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    // Only Ford Barsi, Ahmed Admin, or Support Admin can update department settings
    if (user.email !== 'ford.barsi@theroofdocs.com' &&
        user.email !== 'ahmed.mahmoud@theroofdocs.com' &&
        user.email !== 'support@theroofdocs.com' &&
        user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Ford Barsi, Ahmed Admin, or Support Admin can update department PTO settings' });
    }

    // Ensure totalDays is calculated correctly
    const vacationDays = parseInt(req.body.vacationDays) || 0;
    const sickDays = parseInt(req.body.sickDays) || 0;
    const personalDays = parseInt(req.body.personalDays) || 0;
    const totalDays = vacationDays + sickDays + personalDays;

    const updatedSettings = await storage.updateDepartmentPtoSetting(req.params.id, {
      ...req.body,
      vacationDays,
      sickDays,
      personalDays,
      totalDays,
      lastUpdatedBy: user.id
    });

    const deptEmployees = await db.select({ id: users.id }).from(users)
      .where(eq(users.department, updatedSettings.department));
    const employeeIds = deptEmployees.map((employee) => employee.id);

    if (employeeIds.length > 0) {
      const policies = await db.select().from(ptoPolicies)
        .where(inArray(ptoPolicies.employeeId, employeeIds));

      const companyPolicy = updatedSettings.inheritFromCompany ? await storage.getCompanyPtoPolicy() : null;
      const baseVacation = updatedSettings.inheritFromCompany
        ? (companyPolicy?.vacationDays ?? PTO_POLICY.DEFAULT_VACATION_DAYS)
        : updatedSettings.vacationDays;
      const baseSick = updatedSettings.inheritFromCompany
        ? (companyPolicy?.sickDays ?? PTO_POLICY.DEFAULT_SICK_DAYS)
        : updatedSettings.sickDays;
      const basePersonal = updatedSettings.inheritFromCompany
        ? (companyPolicy?.personalDays ?? PTO_POLICY.DEFAULT_PERSONAL_DAYS)
        : updatedSettings.personalDays;
      const baseDays = baseVacation + baseSick + basePersonal;
      const nextPolicyLevel = updatedSettings.inheritFromCompany ? 'COMPANY' : 'DEPARTMENT';

      for (const policy of policies) {
        if (policy.policyLevel === 'INDIVIDUAL') continue;
        const additionalDays = policy.additionalDays || 0;
        const vacationDays = baseVacation + additionalDays;
        const totalDays = vacationDays + baseSick + basePersonal;
        const usedDays = policy.usedDays || 0;
        const remainingDays = Math.max(0, totalDays - usedDays);

        await db.update(ptoPolicies)
          .set({
            policyLevel: nextPolicyLevel,
            vacationDays,
            sickDays: baseSick,
            personalDays: basePersonal,
            baseDays,
            totalDays,
            remainingDays,
            updatedAt: new Date()
          })
          .where(eq(ptoPolicies.id, policy.id));
      }
    }

    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating department PTO settings:', error);
    res.status(500).json({ error: 'Failed to update department PTO settings' });
  }
});

// Get all individual PTO policies
router.get('/api/pto/individual-policies', requireAuth, async (req, res) => {
  try {
    const policies = await storage.getAllPtoPolicies();
    res.json(policies);
  } catch (error) {
    console.error('Error fetching individual PTO policies:', error);
    res.status(500).json({ error: 'Failed to fetch individual PTO policies' });
  }
});

// Create individual PTO policy
router.post('/api/pto/individual-policies', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    // Only Ford Barsi, Ahmed Admin, or Support Admin can create individual policies
    if (user.email !== 'ford.barsi@theroofdocs.com' &&
        user.email !== 'ahmed.mahmoud@theroofdocs.com' &&
        user.email !== 'support@theroofdocs.com' &&
        user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Ford Barsi, Ahmed Admin, or Support Admin can create individual PTO policies' });
    }

    // Calculate totals correctly
    const vacationDays = parseInt(req.body.vacationDays) || 0;
    const sickDays = parseInt(req.body.sickDays) || 0;
    const personalDays = parseInt(req.body.personalDays) || 0;
    const totalDays = vacationDays + sickDays + personalDays;

    const policyData = {
      ...req.body,
      vacationDays,
      sickDays,
      personalDays,
      totalDays,
      baseDays: req.body.baseDays || totalDays,
      additionalDays: req.body.additionalDays || 0,
      usedDays: req.body.usedDays || 0,
      remainingDays: totalDays,
      policyLevel: 'INDIVIDUAL' as const,
      customizedBy: user.id,
      customizationDate: new Date()
    };

    const newPolicy = await storage.createPtoPolicy(policyData);
    res.json(newPolicy);
  } catch (error) {
    console.error('Error creating individual PTO policy:', error);
    res.status(500).json({ error: 'Failed to create individual PTO policy' });
  }
});

// Update individual PTO policy
router.put('/api/pto/individual-policies/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    // Only Ford Barsi, Ahmed Admin, or Support Admin can update individual policies
    if (user.email !== 'ford.barsi@theroofdocs.com' &&
        user.email !== 'ahmed.mahmoud@theroofdocs.com' &&
        user.email !== 'support@theroofdocs.com' &&
        user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Ford Barsi, Ahmed Admin, or Support Admin can update individual PTO policies' });
    }

    const policy = await storage.getPtoPolicyById(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: 'PTO policy not found' });
    }

    // Calculate totals correctly
    const vacationDays = parseInt(req.body.vacationDays) || policy.vacationDays || 0;
    const sickDays = parseInt(req.body.sickDays) || policy.sickDays || 0;
    const personalDays = parseInt(req.body.personalDays) || policy.personalDays || 0;
    const totalDays = vacationDays + sickDays + personalDays;
    const usedDays = req.body.usedDays ?? policy.usedDays ?? 0;
    
    const updateData = {
      vacationDays,
      sickDays,
      personalDays,
      totalDays,
      baseDays: req.body.baseDays ?? totalDays,
      additionalDays: req.body.additionalDays ?? policy.additionalDays ?? 0,
      usedDays,
      remainingDays: totalDays - usedDays,
      customizedBy: user.id,
      customizationDate: new Date()
    };

    const updatedPolicy = await storage.updatePtoPolicy(req.params.id, updateData);
    res.json(updatedPolicy);
  } catch (error) {
    console.error('Error updating individual PTO policy:', error);
    res.status(500).json({ error: 'Failed to update individual PTO policy' });
  }
});

// Get all PTO policies
router.get('/api/pto-policies', requireAuth, requireManager, async (req, res) => {
  try {
    const policies = await storage.getAllPtoPolicies();
    res.json(policies);
  } catch (error) {
    console.error('Error fetching PTO policies:', error);
    res.status(500).json({ error: 'Failed to fetch PTO policies' });
  }
});

// Get PTO policy for specific employee
router.get('/api/pto-policies/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    // Users can view their own policy, managers can view any
    if (user.id !== req.params.employeeId &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Can only view your own PTO policy' });
    }
    
    const policy = await storage.getPtoPolicyByEmployeeId(req.params.employeeId);
    if (!policy) {
      // If no policy exists, create default based on department
      const user = await storage.getUserById(req.params.employeeId);
      if (user) {
        const deptSetting = await storage.getDepartmentPtoSettingByDepartment(user.department);
        const companyPolicy = await storage.getCompanyPtoPolicy();
        const vacationDays = deptSetting?.vacationDays
          ?? companyPolicy?.vacationDays
          ?? PTO_POLICY.DEFAULT_VACATION_DAYS;
        const sickDays = deptSetting?.sickDays
          ?? companyPolicy?.sickDays
          ?? PTO_POLICY.DEFAULT_SICK_DAYS;
        const personalDays = deptSetting?.personalDays
          ?? companyPolicy?.personalDays
          ?? PTO_POLICY.DEFAULT_PERSONAL_DAYS;
        const totalDays = deptSetting?.totalDays || (vacationDays + sickDays + personalDays);

        const newPolicy = await storage.createPtoPolicy({
          employeeId: req.params.employeeId,
          policyLevel: 'COMPANY',
          vacationDays,
          sickDays,
          personalDays,
          baseDays: totalDays,
          additionalDays: 0,
          totalDays,
          usedDays: 0,
          remainingDays: totalDays
        });

        return res.json(newPolicy);
      }
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(policy);
  } catch (error) {
    console.error('Error fetching PTO policy:', error);
    res.status(500).json({ error: 'Failed to fetch PTO policy' });
  }
});

// Create or update PTO policy for employee
router.post('/api/pto-policies', requireAuth, requireManager, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { employeeId, additionalDays, notes } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID required' });
    }

    const employee = await storage.getUserById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get department base days
    const deptSetting = await storage.getDepartmentPtoSettingByDepartment(employee.department);
    const companyPolicy = await storage.getCompanyPtoPolicy();
    const baseVacation = deptSetting?.vacationDays
      ?? companyPolicy?.vacationDays
      ?? PTO_POLICY.DEFAULT_VACATION_DAYS;
    const baseSick = deptSetting?.sickDays
      ?? companyPolicy?.sickDays
      ?? PTO_POLICY.DEFAULT_SICK_DAYS;
    const basePersonal = deptSetting?.personalDays
      ?? companyPolicy?.personalDays
      ?? PTO_POLICY.DEFAULT_PERSONAL_DAYS;
    const baseDays = (deptSetting?.totalDays ?? (baseVacation + baseSick + basePersonal));
    const vacationDays = baseVacation;
    const sickDays = baseSick;
    const personalDays = basePersonal;

    // Check if policy exists
    const existingPolicy = await storage.getPtoPolicyByEmployeeId(employeeId);

    const totalDays = baseDays + (additionalDays || 0);
    const usedDays = existingPolicy?.usedDays || 0;
    const remainingDays = totalDays - usedDays;

    if (existingPolicy) {
      // Update existing policy
      const updatedPolicy = await storage.updatePtoPolicy(existingPolicy.id, {
        baseDays,
        additionalDays: additionalDays || 0,
        totalDays,
        remainingDays,
        customizedBy: currentUser.id,
        customizationDate: new Date(),
        notes
      });
      res.json(updatedPolicy);
    } else {
      // Create new policy
      const newPolicy = await storage.createPtoPolicy({
        employeeId,
        policyLevel: 'DEPARTMENT',
        vacationDays,
        sickDays,
        personalDays,
        baseDays,
        additionalDays: additionalDays || 0,
        totalDays,
        usedDays: 0,
        remainingDays: totalDays,
        customizedBy: additionalDays ? currentUser.id : undefined,
        customizationDate: additionalDays ? new Date() : undefined,
        notes
      });
      res.json(newPolicy);
    }
  } catch (error) {
    console.error('Error creating/updating PTO policy:', error);
    res.status(500).json({ error: 'Failed to create/update PTO policy' });
  }
});

// Initialize PTO policies for all eligible employees
router.post('/api/pto-policies/initialize', requireAuth, requireGeneralManager, async (req: any, res) => {
  try {
    const users = await storage.getAllUsers();
    const companyPolicy = await storage.getCompanyPtoPolicy();
    const departmentSettings = await storage.getAllDepartmentPtoSettings();
    
    if (!companyPolicy) {
      return res.status(400).json({ error: 'Company PTO policy not configured' });
    }
    
    let initialized = 0;
    let skipped = 0;
    
    for (const user of users) {
      // Skip inactive users and 1099/Sales employees
      if (!user.isActive || user.employmentType === '1099' || user.department === 'Sales') {
        skipped++;
        continue;
      }
      
      // Check if user already has a policy
      const existingPolicy = await storage.getPtoPolicyByEmployeeId(user.id);
      if (existingPolicy) {
        skipped++;
        continue;
      }
      
      // Get department settings if available
      const deptSetting = user.department ?
        departmentSettings.find((d: any) => d.department === user.department) : null;

      // Calculate days based on hierarchy: Individual > Department > Company
      const vacationDays = deptSetting?.vacationDays || companyPolicy.vacationDays;
      const sickDays = deptSetting?.sickDays || companyPolicy.sickDays;
      const personalDays = deptSetting?.personalDays || companyPolicy.personalDays;
      const totalDays = vacationDays + sickDays + personalDays;

      // Create the policy
      await storage.createPtoPolicy({
        employeeId: user.id,
        policyLevel: 'INDIVIDUAL',
        vacationDays,
        sickDays,
        personalDays,
        totalDays,
        baseDays: totalDays,
        additionalDays: 0,
        usedDays: 0,
        remainingDays: totalDays,
        customizedBy: req.user!.id,
        customizationDate: new Date(),
        notes: 'Auto-initialized from company/department policy'
      });
      
      initialized++;
    }
    
    res.json({ 
      success: true, 
      message: `Initialized ${initialized} PTO policies, skipped ${skipped} (existing or ineligible)` 
    });
  } catch (error) {
    console.error('Error initializing PTO policies:', error);
    res.status(500).json({ error: 'Failed to initialize PTO policies' });
  }
});

// Update PTO usage (when PTO is approved)
router.post('/api/pto-policies/update-usage', requireAuth, requireGeneralManager, async (req, res) => {
  try {
    const { employeeId, daysUsed } = req.body;
    
    if (!employeeId || daysUsed === undefined) {
      return res.status(400).json({ error: 'Employee ID and days used required' });
    }
    
    const policy = await storage.getPtoPolicyByEmployeeId(employeeId);
    if (!policy) {
      return res.status(404).json({ error: 'PTO policy not found for employee' });
    }
    
    const newUsedDays = policy.usedDays + daysUsed;
    const newRemainingDays = policy.totalDays - newUsedDays;
    
    if (newRemainingDays < 0) {
      return res.status(400).json({ error: 'Insufficient PTO days available' });
    }
    
    const updatedPolicy = await storage.updatePtoPolicy(policy.id, {
      usedDays: newUsedDays,
      remainingDays: newRemainingDays
    });
    
    res.json(updatedPolicy);
  } catch (error) {
    console.error('Error updating PTO usage:', error);
    res.status(500).json({ error: 'Failed to update PTO usage' });
  }
});

// Department PTO Settings
router.get('/api/department-pto-settings', requireAuth, async (req, res) => {
  try {
    const settings = await storage.getAllDepartmentPtoSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching department PTO settings:', error);
    res.status(500).json({ error: 'Failed to fetch department PTO settings' });
  }
});

router.get('/api/department-pto-settings/:department', requireAuth, async (req, res) => {
  try {
    const setting = await storage.getDepartmentPtoSettingByDepartment(req.params.department);
    if (!setting) {
      return res.status(404).json({ error: 'Department PTO setting not found' });
    }
    res.json(setting);
  } catch (error) {
    console.error('Error fetching department PTO setting:', error);
    res.status(500).json({ error: 'Failed to fetch department PTO setting' });
  }
});

router.post('/api/department-pto-settings', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const data = insertDepartmentPtoSettingSchema.parse({
      ...req.body,
      createdBy: user.id
    });

    // Check if setting exists for department
    const existing = await storage.getDepartmentPtoSettingByDepartment(data.department);

    if (existing) {
      // Update existing
      const updated = await storage.updateDepartmentPtoSetting(data.department, {
        vacationDays: data.vacationDays,
        sickDays: data.sickDays,
        personalDays: data.personalDays,
        totalDays: data.totalDays,
        inheritFromCompany: data.inheritFromCompany,
        customNotes: data.customNotes
      });
      res.json(updated);
    } else {
      // Create new
      const setting = await storage.createDepartmentPtoSetting(data);
      res.json(setting);
    }
  } catch (error: any) {
    console.error('Error creating/updating department PTO setting:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create/update department PTO setting' });
  }
});

// Check for PTO overlaps in department
router.post('/api/pto-policies/check-overlap', requireAuth, async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.body;
    
    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Employee ID, start date, and end date required' });
    }
    
    const user = await storage.getUserById(employeeId);
    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Get all PTO requests for the department
    const allRequests = await storage.getAllPtoRequests();
    const departmentRequests = allRequests.filter(request => 
      request.status === 'APPROVED' || request.status === 'PENDING'
    );
    
    // Get employees in same department
    const allUsers = await storage.getAllUsers();
    const departmentUsers = allUsers.filter(u => 
      u.department === user.department && u.id !== employeeId
    );
    
    // Check for overlaps
    const overlappingEmployees: string[] = [];
    
    for (const deptUser of departmentUsers) {
      const userRequests = departmentRequests.filter(r => r.employeeId === deptUser.id);
      
      for (const request of userRequests) {
        const requestStart = new Date(request.startDate);
        const requestEnd = new Date(request.endDate);
        const checkStart = new Date(startDate);
        const checkEnd = new Date(endDate);
        
        // Check if dates overlap
        if (requestStart <= checkEnd && requestEnd >= checkStart) {
          overlappingEmployees.push(`${deptUser.firstName} ${deptUser.lastName}`);
          break;
        }
      }
    }
    
    const hasOverlap = overlappingEmployees.length >= 2;
    
    res.json({
      hasOverlap,
      overlappingEmployees,
      warning: hasOverlap ?
        `Warning: ${overlappingEmployees.length} other employees from ${user.department} department have overlapping PTO` :
        null
    });
  } catch (error) {
    console.error('Error checking PTO overlap:', error);
    res.status(500).json({ error: 'Failed to check PTO overlap' });
  }
});

// Reset all PTO balances based on employment type and department
// Admin-only endpoint to reset all employees to their correct PTO values
router.post('/api/pto/admin/reset-all', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;

    // Only Ford Barsi, Ahmed Admin, or Support Admin can reset all PTO
    if (user.email !== 'ford.barsi@theroofdocs.com' &&
        user.email !== 'ahmed.mahmoud@theroofdocs.com' &&
        user.email !== 'support@theroofdocs.com' &&
        user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Ford Barsi, Ahmed Admin, or Support Admin can reset all PTO' });
    }

    // Get all active users
    const allUsers = await storage.getAllUsers();
    const activeUsers = allUsers.filter(u => u.isActive !== false);

    const results = {
      updated: 0,
      created: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as { name: string; days: number; action: string }[]
    };

    for (const employee of activeUsers) {
      try {
        // Get proper PTO allocation based on employment type and department
        const ptoAllocation = getPtoAllocation(employee.employmentType, employee.department);

        // Check if policy exists
        const existingPolicy = await storage.getPtoPolicyByEmployeeId(employee.id);

        if (existingPolicy) {
          // Update existing policy
          await storage.updatePtoPolicy(existingPolicy.id, {
            vacationDays: ptoAllocation.vacationDays,
            sickDays: ptoAllocation.sickDays,
            personalDays: ptoAllocation.personalDays,
            totalDays: ptoAllocation.totalDays,
            baseDays: ptoAllocation.totalDays,
            remainingDays: ptoAllocation.totalDays - (existingPolicy.usedDays || 0),
            customizedBy: user.id,
            customizationDate: new Date(),
            notes: ptoAllocation.totalDays === 0 ? 'Reset: No PTO (1099/Sales)' : 'Reset by admin'
          });
          results.updated++;
          results.details.push({
            name: `${employee.firstName} ${employee.lastName}`,
            days: ptoAllocation.totalDays,
            action: 'updated'
          });
        } else {
          // Create new policy
          await storage.createPtoPolicy({
            employeeId: employee.id,
            policyLevel: 'INDIVIDUAL',
            vacationDays: ptoAllocation.vacationDays,
            sickDays: ptoAllocation.sickDays,
            personalDays: ptoAllocation.personalDays,
            totalDays: ptoAllocation.totalDays,
            baseDays: ptoAllocation.totalDays,
            additionalDays: 0,
            usedDays: 0,
            remainingDays: ptoAllocation.totalDays,
            notes: ptoAllocation.totalDays === 0 ? 'Reset: No PTO (1099/Sales)' : 'Reset by admin'
          });
          results.created++;
          results.details.push({
            name: `${employee.firstName} ${employee.lastName}`,
            days: ptoAllocation.totalDays,
            action: 'created'
          });
        }
      } catch (error: any) {
        results.skipped++;
        results.errors.push(`${employee.firstName} ${employee.lastName}: ${error.message}`);
      }
    }

    console.log(`[PTO Reset] Admin ${user.email} reset all PTO: ${results.updated} updated, ${results.created} created, ${results.skipped} skipped`);

    res.json({
      success: true,
      message: `PTO reset complete. Updated: ${results.updated}, Created: ${results.created}, Skipped: ${results.skipped}`,
      results
    });
  } catch (error) {
    console.error('Error resetting all PTO:', error);
    res.status(500).json({ error: 'Failed to reset all PTO' });
  }
});

export default router;
