import express from 'express';
import { storage } from '../storage';
import { insertPtoPolicySchema, insertDepartmentPtoSettingSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Import middleware from main routes
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
  
  if (!['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
}

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
    const vacationDays = parseInt(req.body.vacationDays) || 10;
    const sickDays = parseInt(req.body.sickDays) || 5;
    const personalDays = parseInt(req.body.personalDays) || 3;

    const settingsData = {
      department: req.body.department,
      vacationDays,
      sickDays,
      personalDays,
      totalDays: vacationDays + sickDays + personalDays,
      overridesCompany: req.body.overridesCompany !== false,
      createdBy: user.id,
      lastUpdatedBy: user.id
    };

    const newSettings = await storage.createDepartmentPtoSetting(settingsData);
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
        const baseDays = deptSetting?.baseDays || 10; // Default 10 days if no department setting
        
        const newPolicy = await storage.createPtoPolicy({
          employeeId: req.params.employeeId,
          baseDays,
          additionalDays: 0,
          totalDays: baseDays,
          usedDays: 0,
          remainingDays: baseDays,
          customizedBy: null,
          customizationDate: null,
          notes: null
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
    const baseDays = deptSetting?.totalDays || 10;

    // Check if policy exists
    const existingPolicy = await storage.getPtoPolicyByEmployeeId(employeeId);

    const totalDays = baseDays + (additionalDays || 0);
    const usedDays = existingPolicy?.usedDays || 0;
    const remainingDays = totalDays - usedDays;

    if (existingPolicy) {
      // Update existing policy
      const updatedPolicy = await storage.updatePtoPolicy(employeeId, {
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
        baseDays,
        additionalDays: additionalDays || 0,
        totalDays,
        usedDays: 0,
        remainingDays: totalDays,
        customizedBy: additionalDays ? currentUser.id : null,
        customizationDate: additionalDays ? new Date() : null,
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
        effectiveDate: new Date().toISOString().split('T')[0],
        customizedBy: req.user.id,
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
    
    const updatedPolicy = await storage.updatePtoPolicy(employeeId, {
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
    const data = insertDepartmentPtoSettingSchema.parse({
      ...req.body,
      createdBy: req.user.id
    });
    
    // Check if setting exists for department
    const existing = await storage.getDepartmentPtoSettingByDepartment(data.department);
    
    if (existing) {
      // Update existing
      const updated = await storage.updateDepartmentPtoSetting(data.department, {
        baseDays: data.baseDays,
        createdBy: req.user.id
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

export default router;