import express from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { users, ptoRequests, documents, tasks, employeeReviews, ptoPolicies } from '../../shared/schema';
import { eq, and, or, gte, lte, desc } from 'drizzle-orm';

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

    // Get PTO policy
    let ptoPolicy = await storage.getPtoPolicyByEmployeeId(userId);

    if (!ptoPolicy) {
      // Create default policy if none exists
      const user = await storage.getUserById(userId);
      const deptSetting = user?.department ?
        await storage.getDepartmentPtoSettingByDepartment(user.department) : null;

      const vacationDays = deptSetting?.vacationDays || 10;
      const sickDays = deptSetting?.sickDays || 5;
      const personalDays = deptSetting?.personalDays || 3;
      const totalDays = vacationDays + sickDays + personalDays;

      ptoPolicy = await storage.createPtoPolicy({
        employeeId: userId,
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
    }

    // Get pending PTO requests to calculate pending days
    const allPtoRequests = await storage.getAllPtoRequests();
    const pendingRequests = allPtoRequests.filter(r =>
      r.employeeId === userId && r.status === 'PENDING'
    );

    const pendingDays = pendingRequests.reduce((sum, r) => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0);

    res.json({
      vacationDays: ptoPolicy.vacationDays || 10,
      sickDays: ptoPolicy.sickDays || 5,
      personalDays: ptoPolicy.personalDays || 3,
      totalDays: ptoPolicy.totalDays || 18,
      usedDays: ptoPolicy.usedDays || 0,
      remainingDays: ptoPolicy.remainingDays || ptoPolicy.totalDays || 18,
      pendingDays,
      // Breakdown by type (approximation based on common usage patterns)
      usedVacation: Math.floor((ptoPolicy.usedDays || 0) * 0.6),
      usedSick: Math.floor((ptoPolicy.usedDays || 0) * 0.25),
      usedPersonal: Math.floor((ptoPolicy.usedDays || 0) * 0.15)
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
    // For now, return empty array - will implement with document acknowledgment feature
    res.json([]);
  } catch (error) {
    console.error('Error fetching documents to acknowledge:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
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

export default router;
