import express from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { users, ptoRequests, documents, tasks, employeeReviews, ptoPolicies, documentAcknowledgments } from '../../shared/schema';
import { eq, and, or, gte, lte, desc, notInArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Get employee portal dashboard data
router.get('/api/employee-portal/dashboard', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await storage.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get PTO balance
    const ptoPolicy = await storage.getPtoPolicyByEmployeeId(userId);

    // Get pending PTO requests
    const allPtoRequests = await storage.getAllPtoRequests();
    const myPtoRequests = allPtoRequests.filter(r => r.employeeId === userId);
    const pendingPto = myPtoRequests.filter(r => r.status === 'PENDING');

    // Get upcoming approved PTO
    const today = new Date().toISOString().split('T')[0];
    const upcomingPto = myPtoRequests.filter(r =>
      r.status === 'APPROVED' && r.startDate >= today
    ).slice(0, 5);

    // Get pending tasks assigned to user
    const allTasks = await storage.getAllTasks();
    const myPendingTasks = allTasks.filter(t =>
      t.assignedTo === userId && t.status !== 'COMPLETED'
    ).slice(0, 5);

    // Get upcoming reviews
    const allReviews = await storage.getAllEmployeeReviews();
    const myUpcomingReviews = allReviews.filter(r =>
      r.employeeId === userId &&
      r.status !== 'COMPLETED' &&
      new Date(r.scheduledDate) >= new Date()
    ).slice(0, 3);

    // Get recent activity (last 10 items)
    const recentPtoActivity = myPtoRequests
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(r => ({
        type: 'pto' as const,
        title: `PTO Request ${r.status.toLowerCase()}`,
        description: `${r.type} - ${r.startDate} to ${r.endDate}`,
        date: r.updatedAt,
        status: r.status
      }));

    // Build dashboard data
    const dashboardData = {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        position: user.position,
        department: user.department,
        phone: user.phone,
        hireDate: user.hireDate,
        avatar: user.avatar
      },
      ptoBalance: ptoPolicy ? {
        vacationDays: ptoPolicy.vacationDays || 10,
        sickDays: ptoPolicy.sickDays || 5,
        personalDays: ptoPolicy.personalDays || 3,
        usedVacation: Math.floor((ptoPolicy.usedDays || 0) * 0.6), // Approximate breakdown
        usedSick: Math.floor((ptoPolicy.usedDays || 0) * 0.25),
        usedPersonal: Math.floor((ptoPolicy.usedDays || 0) * 0.15),
        pendingDays: pendingPto.reduce((sum, r) => {
          const start = new Date(r.startDate);
          const end = new Date(r.endDate);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return sum + days;
        }, 0)
      } : {
        vacationDays: 10,
        sickDays: 5,
        personalDays: 3,
        usedVacation: 0,
        usedSick: 0,
        usedPersonal: 0,
        pendingDays: 0
      },
      pendingItems: {
        ptoRequests: pendingPto.length,
        tasks: myPendingTasks.length,
        documentsToSign: 0, // Will implement with document acknowledgment feature
        upcomingReviews: myUpcomingReviews.length
      },
      upcomingPto,
      pendingTasks: myPendingTasks,
      upcomingReviews: myUpcomingReviews,
      recentActivity: recentPtoActivity
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching employee dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get PTO balance for current user
router.get('/api/employee-portal/pto-balance', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await storage.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Use the same policy hierarchy as PTO page: individual → department → company
    // 1. Check for individual policy
    const individualPolicies = await storage.getAllPtoPolicies();
    const individualPolicy = individualPolicies.find((p: any) => p.employeeId === userId);

    // 2. Check for department policy
    const deptSetting = user.department ?
      await storage.getDepartmentPtoSettingByDepartment(user.department) : null;

    // 3. Get company policy
    const companyPolicy = await storage.getCompanyPtoPolicy();

    // Determine effective PTO allowance (individual > department > company > defaults)
    let vacationDays = 10;
    let sickDays = 5;
    let personalDays = 3;
    let policySource = 'default';

    if (individualPolicy) {
      vacationDays = individualPolicy.vacationDays || 10;
      sickDays = individualPolicy.sickDays || 5;
      personalDays = individualPolicy.personalDays || 3;
      policySource = 'individual';
    } else if (deptSetting && deptSetting.overridesCompany) {
      vacationDays = deptSetting.vacationDays || 10;
      sickDays = deptSetting.sickDays || 5;
      personalDays = deptSetting.personalDays || 3;
      policySource = 'department';
    } else if (companyPolicy) {
      vacationDays = companyPolicy.vacationDays || 10;
      sickDays = companyPolicy.sickDays || 5;
      personalDays = companyPolicy.personalDays || 3;
      policySource = 'company';
    }

    // Special case: Sales/1099 contractors get 0 PTO unless individual override
    if ((user.department === 'Sales' || user.employmentType === '1099') && !individualPolicy) {
      vacationDays = 0;
      sickDays = 0;
      personalDays = 0;
      policySource = 'none (Sales/1099)';
    }

    const totalDays = vacationDays + sickDays + personalDays;

    // Calculate ACTUAL used days from APPROVED PTO requests (current year)
    const allPtoRequests = await storage.getAllPtoRequests();
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const myRequests = allPtoRequests.filter(r => r.employeeId === userId);

    const approvedRequests = myRequests.filter(r =>
      r.status === 'APPROVED' &&
      r.startDate >= yearStart &&
      r.startDate <= yearEnd
    );

    const usedDays = approvedRequests.reduce((sum, r) => sum + (r.days || 0), 0);

    // Calculate pending days
    const pendingRequests = myRequests.filter(r => r.status === 'PENDING');
    const pendingDays = pendingRequests.reduce((sum, r) => sum + (r.days || 0), 0);

    // Breakdown by type (approximation since requests don't track type)
    const usedVacation = Math.min(vacationDays, Math.floor(usedDays * 0.6));
    const usedSick = Math.min(sickDays, Math.floor(usedDays * 0.25));
    const usedPersonal = Math.min(personalDays, usedDays - usedVacation - usedSick);

    res.json({
      vacationDays,
      sickDays,
      personalDays,
      totalDays,
      usedDays,
      remainingDays: Math.max(0, totalDays - usedDays),
      pendingDays,
      usedVacation,
      usedSick,
      usedPersonal,
      policySource // Helps with debugging
    });
  } catch (error) {
    console.error('Error fetching PTO balance:', error);
    res.status(500).json({ error: 'Failed to fetch PTO balance' });
  }
});

// Get pending items for current user
router.get('/api/employee-portal/pending-items', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Pending PTO requests
    const allPtoRequests = await storage.getAllPtoRequests();
    const pendingPto = allPtoRequests.filter(r =>
      r.employeeId === userId && r.status === 'PENDING'
    );

    // Pending tasks
    const allTasks = await storage.getAllTasks();
    const pendingTasks = allTasks.filter(t =>
      t.assignedTo === userId && t.status !== 'COMPLETED'
    );

    // Upcoming reviews
    const allReviews = await storage.getAllEmployeeReviews();
    const upcomingReviews = allReviews.filter(r =>
      r.employeeId === userId &&
      r.status !== 'COMPLETED'
    );

    res.json({
      ptoRequests: pendingPto,
      tasks: pendingTasks,
      reviews: upcomingReviews,
      counts: {
        ptoRequests: pendingPto.length,
        tasks: pendingTasks.length,
        reviews: upcomingReviews.length,
        total: pendingPto.length + pendingTasks.length + upcomingReviews.length
      }
    });
  } catch (error) {
    console.error('Error fetching pending items:', error);
    res.status(500).json({ error: 'Failed to fetch pending items' });
  }
});

// Get upcoming events for current user
router.get('/api/employee-portal/upcoming-events', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Upcoming approved PTO
    const allPtoRequests = await storage.getAllPtoRequests();
    const upcomingPto = allPtoRequests.filter(r =>
      r.employeeId === userId &&
      r.status === 'APPROVED' &&
      r.startDate >= today
    ).map(r => ({
      type: 'pto' as const,
      title: `${r.type} Time Off`,
      date: r.startDate,
      endDate: r.endDate
    }));

    // Upcoming reviews
    const allReviews = await storage.getAllEmployeeReviews();
    const upcomingReviews = allReviews.filter(r =>
      r.employeeId === userId &&
      r.status !== 'COMPLETED' &&
      new Date(r.scheduledDate) >= new Date()
    ).map(r => ({
      type: 'review' as const,
      title: `${r.reviewType} Review`,
      date: r.scheduledDate
    }));

    // Combine and sort by date
    const allEvents = [...upcomingPto, ...upcomingReviews]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);

    res.json(allEvents);
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// Get documents that need acknowledgment
router.get('/api/employee-portal/documents-to-acknowledge', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Get all APPROVED documents
    const allDocuments = await db.select().from(documents).where(eq(documents.status, 'APPROVED'));

    // Get all acknowledgments by this user
    const userAcknowledgments = await db.select()
      .from(documentAcknowledgments)
      .where(eq(documentAcknowledgments.employeeId, userId));

    const acknowledgedDocIds = new Set(userAcknowledgments.map(a => a.documentId));

    // Filter to documents not yet acknowledged
    const unacknowledgedDocs = allDocuments
      .filter(doc => !acknowledgedDocIds.has(doc.id))
      .map(doc => ({
        id: doc.id,
        title: doc.name,
        category: doc.category,
        description: doc.description,
        createdAt: doc.createdAt,
        fileUrl: doc.fileUrl
      }));

    res.json(unacknowledgedDocs);
  } catch (error) {
    console.error('Error fetching documents to acknowledge:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Acknowledge a document
router.post('/api/employee-portal/acknowledge-document', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { documentId, signature } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID required' });
    }

    // Check if already acknowledged
    const existing = await db.select()
      .from(documentAcknowledgments)
      .where(and(
        eq(documentAcknowledgments.documentId, documentId),
        eq(documentAcknowledgments.employeeId, userId)
      ));

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Document already acknowledged' });
    }

    // Create acknowledgment
    const acknowledgment = {
      id: uuidv4(),
      documentId,
      employeeId: userId,
      signature: signature || req.user.firstName + ' ' + req.user.lastName,
      acknowledgedAt: new Date()
    };

    await db.insert(documentAcknowledgments).values(acknowledgment);

    res.json({ success: true, acknowledgment });
  } catch (error) {
    console.error('Error acknowledging document:', error);
    res.status(500).json({ error: 'Failed to acknowledge document' });
  }
});

// Update user profile (limited fields)
router.put('/api/employee-portal/profile', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { phone, emergencyContact, emergencyPhone, address } = req.body;

    // Only allow updating specific fields
    const allowedUpdates: any = {};
    if (phone !== undefined) allowedUpdates.phone = phone;
    if (emergencyContact !== undefined) allowedUpdates.emergencyContact = emergencyContact;
    if (emergencyPhone !== undefined) allowedUpdates.emergencyPhone = emergencyPhone;
    if (address !== undefined) allowedUpdates.address = address;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updatedUser = await storage.updateUser(userId, allowedUpdates);

    res.json({
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      emergencyContact: updatedUser.emergencyContact,
      emergencyPhone: updatedUser.emergencyPhone,
      address: updatedUser.address
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get team directory (coworkers in same department)
router.get('/api/employee-portal/team', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await storage.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all active users
    const allUsers = await storage.getAllUsers();

    // Filter to same department or all if no department
    let teamMembers = allUsers.filter(u =>
      u.isActive &&
      u.id !== userId
    );

    // If user has a department, prioritize same department
    if (user.department) {
      const sameDept = teamMembers.filter(u => u.department === user.department);
      const otherDept = teamMembers.filter(u => u.department !== user.department);
      teamMembers = [...sameDept, ...otherDept];
    }

    // Return limited info for directory
    const directory = teamMembers.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      position: u.position,
      department: u.department,
      phone: u.phone,
      avatar: u.avatar,
      isSameDepartment: user.department ? u.department === user.department : false
    }));

    res.json(directory);
  } catch (error) {
    console.error('Error fetching team directory:', error);
    res.status(500).json({ error: 'Failed to fetch team directory' });
  }
});

// Get my PTO requests history
router.get('/api/employee-portal/my-pto', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;

    const allPtoRequests = await storage.getAllPtoRequests();
    const myRequests = allPtoRequests
      .filter(r => r.employeeId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(myRequests);
  } catch (error) {
    console.error('Error fetching PTO requests:', error);
    res.status(500).json({ error: 'Failed to fetch PTO requests' });
  }
});

// Get PTO requests with employee names (for managers)
router.get('/api/employee-portal/manager/pto-requests', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;

    // Check if user is a manager
    if (!['ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TERRITORY_SALES_MANAGER', 'TRUE_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Manager access required' });
    }

    // Get all PTO requests
    const allPtoRequests = await storage.getAllPtoRequests();
    const allUsers = await storage.getAllUsers();

    // Create user lookup map
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // Add employee names to requests
    const requestsWithNames = allPtoRequests.map(r => {
      const employee = userMap.get(r.employeeId);
      return {
        ...r,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee',
        employeeEmail: employee?.email,
        employeeDepartment: employee?.department,
        employeePosition: employee?.position
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(requestsWithNames);
  } catch (error) {
    console.error('Error fetching manager PTO requests:', error);
    res.status(500).json({ error: 'Failed to fetch PTO requests' });
  }
});

// Get pending reviews for manager dashboard
router.get('/api/employee-portal/manager/pending-reviews', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;

    // Check if user is a manager
    if (!['ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TERRITORY_SALES_MANAGER', 'TRUE_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Manager access required' });
    }

    // Get all reviews
    const allReviews = await storage.getAllEmployeeReviews();
    const allUsers = await storage.getAllUsers();

    // Create user lookup map
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // Filter pending reviews and add employee names
    const pendingReviews = allReviews
      .filter(r => r.status !== 'COMPLETED')
      .map(r => {
        const employee = userMap.get(r.employeeId);
        return {
          ...r,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee',
          employeeDepartment: employee?.department
        };
      });

    res.json({
      reviews: pendingReviews,
      count: pendingReviews.length
    });
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

export default router;
