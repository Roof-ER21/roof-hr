import express from 'express';
import { storage } from '../storage';
import { insertEmployeeAssignmentSchema } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { googleSyncEnhanced } from '../services/google-sync-enhanced';

const router = express.Router();

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
  
  if (!['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  
  next();
}

// Get all employee assignments
router.get('/api/employee-assignments', requireAuth, requireManager, async (req, res) => {
  try {
    const allAssignments: any[] = [];
    
    // Get all users and their assignments
    const users = await storage.getAllUsers();
    for (const user of users) {
      const assignments = await storage.getEmployeeAssignmentsByEmployeeId(user.id);
      allAssignments.push(...assignments);
    }
    
    res.json(allAssignments);
  } catch (error) {
    console.error('Error fetching employee assignments:', error);
    res.status(500).json({ error: 'Failed to fetch employee assignments' });
  }
});

// Get assignments for specific employee
router.get('/api/employee-assignments/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    // Users can view their own assignments, managers can view any
    if (user.id !== req.params.employeeId &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Can only view your own assignments' });
    }

    const assignments = await storage.getEmployeeAssignmentsByEmployeeId(req.params.employeeId);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching employee assignments:', error);
    res.status(500).json({ error: 'Failed to fetch employee assignments' });
  }
});

// Get employees assigned to a specific person
router.get('/api/employee-assignments/assigned-to/:assignedToId', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    // Users can view employees assigned to them, managers can view any
    if (user.id !== req.params.assignedToId &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Can only view employees assigned to you' });
    }

    const assignments = await storage.getEmployeeAssignmentsByAssignedToId(req.params.assignedToId);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Get assignment by ID
router.get('/api/employee-assignments/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const assignment = await storage.getEmployeeAssignmentById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check access permissions
    if (assignment.employeeId !== user.id &&
        assignment.assignedToId !== user.id &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// Create new employee assignment
router.post('/api/employee-assignments', requireAuth, requireManager, async (req, res) => {
  try {
    const user = req.user!;
    const data = insertEmployeeAssignmentSchema.parse({
      ...req.body,
      createdBy: user.id
    });
    
    // Check if employee exists
    const employee = await storage.getUserById(data.employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Check if assigned person exists
    const assignedTo = await storage.getUserById(data.assignedToId);
    if (!assignedTo) {
      return res.status(404).json({ error: 'Assigned person not found' });
    }
    
    // If this is a primary assignment, update the user's primary manager
    if (data.assignmentType === 'PRIMARY') {
      await storage.updateUser(data.employeeId, {
        primaryManagerId: data.assignedToId
      });
    }

    const assignment = await storage.createEmployeeAssignment(data as any);
    
    // Share Google Drive folder with the newly assigned employee
    try {
      await googleSyncEnhanced.shareEmployeeFolderWithManager(data.employeeId, data.assignedToId);
      console.log(`[Employee Assignment] Shared Google Drive folder for employee ${employee.firstName} ${employee.lastName} with manager ${assignedTo.firstName} ${assignedTo.lastName}`);
    } catch (error) {
      console.error('[Employee Assignment] Failed to share Google Drive folder:', error);
      // Don't fail the assignment creation if Google Drive sharing fails
    }
    
    res.json(assignment);
  } catch (error: any) {
    console.error('Error creating employee assignment:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid assignment data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create employee assignment' });
  }
});

// Update employee assignment
router.patch('/api/employee-assignments/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const assignment = await storage.getEmployeeAssignmentById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // If changing to primary assignment, update user's primary manager
    if (req.body.assignmentType === 'PRIMARY' && assignment.assignmentType !== 'PRIMARY') {
      await storage.updateUser(assignment.employeeId, {
        primaryManagerId: assignment.assignedToId
      });
    }
    
    const updatedAssignment = await storage.updateEmployeeAssignment(req.params.id, req.body);
    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating employee assignment:', error);
    res.status(500).json({ error: 'Failed to update employee assignment' });
  }
});

// Delete employee assignment
router.delete('/api/employee-assignments/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const assignment = await storage.getEmployeeAssignmentById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // If deleting primary assignment, clear user's primary manager
    if (assignment.assignmentType === 'PRIMARY') {
      await storage.updateUser(assignment.employeeId, {
        primaryManagerId: null
      });
    }
    
    await storage.deleteEmployeeAssignment(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee assignment:', error);
    res.status(500).json({ error: 'Failed to delete employee assignment' });
  }
});

// Get recruiter performance metrics
router.get('/api/employee-assignments/recruiter-performance/:recruiterId', requireAuth, requireManager, async (req, res) => {
  try {
    const candidates = await storage.getAllCandidates();
    
    // Filter candidates by recruiter
    const recruiterCandidates = candidates.filter(c => c.recruiterId === req.params.recruiterId);
    
    // Calculate metrics
    const metrics = {
      totalCandidates: recruiterCandidates.length,
      inScreening: recruiterCandidates.filter(c => c.status === 'SCREENING').length,
      inInterview: recruiterCandidates.filter(c => c.status === 'INTERVIEW').length,
      hired: recruiterCandidates.filter(c => c.status === 'HIRED').length,
      rejected: recruiterCandidates.filter(c => 
        c.status === 'REJECTED' || c.status === 'DEAD_BY_US' || c.status === 'DEAD_BY_CANDIDATE'
      ).length,
      conversionRate: recruiterCandidates.length > 0 ? 
        (recruiterCandidates.filter(c => c.status === 'HIRED').length / recruiterCandidates.length * 100).toFixed(2) : 0,
      averageTimeToHire: 0 // Would need to calculate based on dates
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching recruiter performance:', error);
    res.status(500).json({ error: 'Failed to fetch recruiter performance' });
  }
});

export default router;