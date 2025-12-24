import express from 'express';
import { storage } from '../storage';
import { emailService } from '../email-service';
import { v4 as uuidv4 } from 'uuid';
import { getNextAvailableColor, DEFAULT_SCREENER_COLOR } from '../../shared/constants/screener-colors';
import { isLeadSourcer, isSourcer } from '../../shared/constants/roles';

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

  // Ahmed always has manager access (super admin email fallback)
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  const managerRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  next();
}

/**
 * Middleware for candidate assignment and bulk actions
 * Allows managers AND lead sourcers (Ryan Ferguson)
 */
function requireManagerOrLeadSourcer(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ahmed always has access
  if (req.user.email === 'ahmed.mahmoud@theroofdocs.com') {
    return next();
  }

  // Lead sourcers (Ryan) can perform these actions
  if (isLeadSourcer(req.user)) {
    return next();
  }

  const managerRoles = [
    'SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER',
    'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'
  ];

  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or lead sourcer access required' });
  }

  next();
}

/**
 * POST /api/candidates/:id/assign-sourcer
 * Assign a sourcer to a specific candidate
 */
router.post('/api/candidates/:id/assign-sourcer', requireAuth, requireManagerOrLeadSourcer, async (req: any, res) => {
  try {
    const user = req.user!;
    const candidateId = req.params.id;
    const { hrMemberId, role = 'PRIMARY', notes, sendNotification = true } = req.body;

    console.log(`[Sourcer Assignment] Request: candidateId=${candidateId}, hrMemberId=${hrMemberId}, role=${role}`);

    // Validate candidate exists
    const candidate = await storage.getCandidateById(candidateId);
    if (!candidate) {
      console.log(`[Sourcer Assignment] ERROR: Candidate ${candidateId} not found`);
      return res.status(404).json({ error: 'Candidate not found' });
    }

    console.log(`[Sourcer Assignment] Found candidate: ${candidate.firstName} ${candidate.lastName}`);

    // Validate HR member (sourcer) exists
    const hrMember = await storage.getUserById(hrMemberId);
    if (!hrMember) {
      console.log(`[Sourcer Assignment] ERROR: HR member ${hrMemberId} not found`);
      return res.status(404).json({ error: 'HR member not found' });
    }

    console.log(`[Sourcer Assignment] Found sourcer: ${hrMember.firstName} ${hrMember.lastName}`);

    // Auto-assign screener color if sourcer doesn't have one
    if (!(hrMember as any).screenerColor) {
      try {
        const allUsers = await storage.getAllUsers();
        const usedColors = allUsers
          .filter((u: any) => u.screenerColor)
          .map((u: any) => u.screenerColor as string);
        const newColor = getNextAvailableColor(usedColors);
        await storage.updateUser(hrMemberId, { screenerColor: newColor } as any);
        (hrMember as any).screenerColor = newColor;
        console.log(`[Sourcer Assignment] Auto-assigned color ${newColor} to ${hrMember.firstName} ${hrMember.lastName}`);
      } catch (colorError: any) {
        console.error('[Sourcer Assignment] Failed to auto-assign color:', colorError.message);
      }
    }

    // Check if this is a primary assignment and if one already exists
    if (role === 'PRIMARY') {
      const existingAssignments = await storage.getHrAssignmentsByCandidateId(candidateId);
      const existingPrimary = existingAssignments.find(a => a.role === 'PRIMARY' && a.status === 'ACTIVE');

      if (existingPrimary) {
        // Update the existing primary to SECONDARY
        await storage.updateHrAssignment(existingPrimary.id, { role: 'SECONDARY' });
      }
    }

    // Create the assignment
    console.log(`[Sourcer Assignment] Creating HR assignment...`);
    const assignment = await storage.createHrAssignment({
      type: 'CANDIDATE',
      assigneeId: candidateId,
      hrMemberId,
      assignedBy: user.id,
      role: role as 'PRIMARY' | 'SECONDARY' | 'BACKUP',
      status: 'ACTIVE',
      notes: notes || `Assigned by ${user.firstName} ${user.lastName}`,
      startDate: new Date(),
      tasksCompleted: 0,
    });
    console.log(`[Sourcer Assignment] Created assignment: ${assignment.id}`);

    // Update candidate's assignedTo field for primary assignments
    if (role === 'PRIMARY') {
      console.log(`[Sourcer Assignment] Updating candidate assignedTo field...`);
      await storage.updateCandidate(candidateId, { assignedTo: hrMemberId });
      console.log(`[Sourcer Assignment] SUCCESS: ${candidate.firstName} ${candidate.lastName} assigned to ${hrMember.firstName} ${hrMember.lastName}`);
    }

    // Send email notification to sourcer
    if (sendNotification && hrMember.email) {
      try {
        await emailService.sendEmail({
          to: hrMember.email,
          subject: `New Candidate Assignment: ${candidate.firstName} ${candidate.lastName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">New Candidate Assignment</h2>

              <p>Hi ${hrMember.firstName},</p>

              <p>You have been assigned to a new candidate:</p>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #374151;">Candidate Details</h3>
                <p><strong>Name:</strong> ${candidate.firstName} ${candidate.lastName}</p>
                <p><strong>Position:</strong> ${candidate.position}</p>
                <p><strong>Email:</strong> ${candidate.email}</p>
                <p><strong>Phone:</strong> ${candidate.phone || 'N/A'}</p>
                <p><strong>Status:</strong> ${candidate.status}</p>
                <p><strong>Assignment Role:</strong> ${role}</p>
                ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
              </div>

              <p>Please reach out to this candidate to begin the screening process and prevent duplicate calls from other team members.</p>

              <p>Best regards,<br>
              The Roof-ER HR Team</p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #6b7280; font-size: 12px;">
                This is an automated message from the Roof HR system.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send assignment notification email:', emailError);
        // Don't fail the assignment if email fails
      }
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error assigning sourcer to candidate:', error);
    res.status(500).json({ error: 'Failed to assign sourcer to candidate' });
  }
});

/**
 * GET /api/candidates/:id/assignments
 * Get all assignments for a specific candidate
 */
router.get('/api/candidates/:id/assignments', requireAuth, async (req, res) => {
  try {
    const candidateId = req.params.id;
    const assignments = await storage.getHrAssignmentsByCandidateId(candidateId);

    // Enrich with HR member details
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const hrMember = await storage.getUserById(assignment.hrMemberId);
        const assignedByUser = await storage.getUserById(assignment.assignedBy);
        return {
          ...assignment,
          hrMember: hrMember ? {
            id: hrMember.id,
            firstName: hrMember.firstName,
            lastName: hrMember.lastName,
            email: hrMember.email,
            role: hrMember.role,
          } : null,
          assignedByUser: assignedByUser ? {
            id: assignedByUser.id,
            firstName: assignedByUser.firstName,
            lastName: assignedByUser.lastName,
          } : null,
        };
      })
    );

    res.json(enrichedAssignments);
  } catch (error) {
    console.error('Error fetching candidate assignments:', error);
    res.status(500).json({ error: 'Failed to fetch candidate assignments' });
  }
});

/**
 * GET /api/sourcers/:sourcerId/assignments
 * Get all assignments for a specific sourcer (HR member)
 */
router.get('/api/sourcers/:sourcerId/assignments', requireAuth, async (req: any, res) => {
  try {
    const user = req.user!;
    const sourcerId = req.params.sourcerId;
    const { status = 'ACTIVE' } = req.query;

    // Check permission: users can view their own assignments, managers can view any
    if (user.id !== sourcerId &&
        !['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'You can only view your own assignments' });
    }

    // Get assignments
    let assignments;
    if (status === 'ACTIVE') {
      assignments = await storage.getActiveAssignmentsByHrMemberId(sourcerId);
    } else {
      const allAssignments = await storage.getAllHrAssignments();
      assignments = allAssignments.filter(a => a.hrMemberId === sourcerId);
      if (status && status !== 'ALL') {
        assignments = assignments.filter(a => a.status === status);
      }
    }

    // Enrich with candidate details
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        if (assignment.type === 'CANDIDATE') {
          const candidate = await storage.getCandidateById(assignment.assigneeId);
          return {
            ...assignment,
            candidate: candidate ? {
              id: candidate.id,
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              email: candidate.email,
              phone: candidate.phone,
              position: candidate.position,
              status: candidate.status,
            } : null,
          };
        }
        return assignment;
      })
    );

    res.json(enrichedAssignments);
  } catch (error) {
    console.error('Error fetching sourcer assignments:', error);
    res.status(500).json({ error: 'Failed to fetch sourcer assignments' });
  }
});

/**
 * PATCH /api/assignments/:id
 * Update an assignment (status, role, notes, etc.)
 */
router.patch('/api/assignments/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const updateData = req.body;

    // Get existing assignment
    const assignment = await storage.getHrAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // If changing to PRIMARY, update any existing PRIMARY assignments
    if (updateData.role === 'PRIMARY' && assignment.role !== 'PRIMARY') {
      const existingAssignments = await storage.getHrAssignmentsByCandidateId(assignment.assigneeId);
      const existingPrimary = existingAssignments.find(a =>
        a.role === 'PRIMARY' && a.status === 'ACTIVE' && a.id !== assignmentId
      );

      if (existingPrimary) {
        await storage.updateHrAssignment(existingPrimary.id, { role: 'SECONDARY' });
      }
    }

    // If completing assignment, set endDate
    if (updateData.status === 'COMPLETED' && !updateData.endDate) {
      updateData.endDate = new Date();
    }

    const updatedAssignment = await storage.updateHrAssignment(assignmentId, updateData);
    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

/**
 * DELETE /api/assignments/:id
 * Remove an assignment
 */
router.delete('/api/assignments/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const assignmentId = req.params.id;

    const assignment = await storage.getHrAssignmentById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await storage.deleteHrAssignment(assignmentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

/**
 * POST /api/candidates/bulk-assign
 * Bulk assign candidates to sourcers using round-robin algorithm
 */
router.post('/api/candidates/bulk-assign', requireAuth, requireManagerOrLeadSourcer, async (req: any, res) => {
  try {
    const user = req.user!;
    const { candidateIds, sourcerIds, sendNotifications = true } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ error: 'No candidates provided' });
    }

    if (!sourcerIds || !Array.isArray(sourcerIds) || sourcerIds.length === 0) {
      return res.status(400).json({ error: 'No sourcers provided' });
    }

    // Get workload for each sourcer
    const sourcerWorkloads = await Promise.all(
      sourcerIds.map(async (sourcerId: string) => {
        const assignments = await storage.getActiveAssignmentsByHrMemberId(sourcerId);
        return {
          sourcerId,
          activeCount: assignments.length,
        };
      })
    );

    // Sort by workload (least busy first)
    sourcerWorkloads.sort((a, b) => a.activeCount - b.activeCount);

    const assignments = [];
    let sourcerIndex = 0;

    // Assign candidates in round-robin fashion, starting with least busy
    for (const candidateId of candidateIds) {
      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate) {
        console.warn(`Candidate ${candidateId} not found, skipping`);
        continue;
      }

      // Check if candidate already has a primary assignment
      const existingAssignments = await storage.getHrAssignmentsByCandidateId(candidateId);
      const hasPrimary = existingAssignments.some(a => a.role === 'PRIMARY' && a.status === 'ACTIVE');

      if (hasPrimary) {
        console.log(`Candidate ${candidateId} already has a primary assignment, skipping`);
        continue;
      }

      const sourcerId = sourcerWorkloads[sourcerIndex].sourcerId;
      const hrMember = await storage.getUserById(sourcerId);

      // Create assignment
      const assignment = await storage.createHrAssignment({
        type: 'CANDIDATE',
        assigneeId: candidateId,
        hrMemberId: sourcerId,
        assignedBy: user.id,
        role: 'PRIMARY',
        status: 'ACTIVE',
        notes: `Auto-assigned via bulk assignment by ${user.firstName} ${user.lastName}`,
        startDate: new Date(),
        tasksCompleted: 0,
      });

      assignments.push(assignment);

      // Send notification email
      if (sendNotifications && hrMember && hrMember.email) {
        try {
          await emailService.sendEmail({
            to: hrMember.email,
            subject: `New Candidate Assignment: ${candidate.firstName} ${candidate.lastName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">New Candidate Assignment</h2>

                <p>Hi ${hrMember.firstName},</p>

                <p>You have been assigned to a new candidate:</p>

                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #374151;">Candidate Details</h3>
                  <p><strong>Name:</strong> ${candidate.firstName} ${candidate.lastName}</p>
                  <p><strong>Position:</strong> ${candidate.position}</p>
                  <p><strong>Email:</strong> ${candidate.email}</p>
                  <p><strong>Phone:</strong> ${candidate.phone || 'N/A'}</p>
                  <p><strong>Status:</strong> ${candidate.status}</p>
                </div>

                <p>This is part of a bulk assignment. Please reach out to this candidate to begin the screening process.</p>

                <p>Best regards,<br>
                The Roof-ER HR Team</p>
              </div>
            `,
          });
        } catch (emailError) {
          console.error(`Failed to send assignment notification to ${hrMember.email}:`, emailError);
        }
      }

      // Move to next sourcer (round-robin)
      sourcerIndex = (sourcerIndex + 1) % sourcerWorkloads.length;

      // Update workload count
      sourcerWorkloads[sourcerIndex].activeCount++;
    }

    res.json({
      success: true,
      assignmentsCreated: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error('Error bulk assigning candidates:', error);
    res.status(500).json({ error: 'Failed to bulk assign candidates' });
  }
});

/**
 * GET /api/sourcers/available
 * Get all available sourcers (users with SOURCER role or recruiting-capable roles)
 */
router.get('/api/sourcers/available', requireAuth, requireManagerOrLeadSourcer, async (req, res) => {
  try {
    const allUsers = await storage.getAllUsers();

    // Filter to users who can be sourcers
    // Include: designated sourcers (Tim, Sima, Ryan) + role-based sourcers
    const sourcers = allUsers.filter(user =>
      user.isActive && (
        // Users designated as sourcers by email
        isSourcer(user) ||
        // Users with recruiting-capable roles
        ['SOURCER', 'HR_ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TRUE_ADMIN', 'ADMIN'].includes(user.role)
      )
    );

    // Get workload for each sourcer
    const sourcersWithWorkload = await Promise.all(
      sourcers.map(async (sourcer) => {
        const activeAssignments = await storage.getActiveAssignmentsByHrMemberId(sourcer.id);
        return {
          id: sourcer.id,
          firstName: sourcer.firstName,
          lastName: sourcer.lastName,
          email: sourcer.email,
          role: sourcer.role,
          screenerColor: (sourcer as any).screenerColor || '#6B7280',
          activeAssignments: activeAssignments.length,
        };
      })
    );

    res.json(sourcersWithWorkload);
  } catch (error) {
    console.error('Error fetching available sourcers:', error);
    res.status(500).json({ error: 'Failed to fetch available sourcers' });
  }
});

/**
 * GET /api/assignments/metrics/:sourcerId
 * Get performance metrics for a sourcer
 */
router.get('/api/assignments/metrics/:sourcerId', requireAuth, requireManager, async (req, res) => {
  try {
    const sourcerId = req.params.sourcerId;
    const { period } = req.query;

    // Get all assignments for this sourcer
    const allAssignments = await storage.getAllHrAssignments();
    const sourcerAssignments = allAssignments.filter(a => a.hrMemberId === sourcerId);

    // Calculate metrics
    const activeAssignments = sourcerAssignments.filter(a => a.status === 'ACTIVE');
    const completedAssignments = sourcerAssignments.filter(a => a.status === 'COMPLETED');

    // Get candidate outcomes for completed assignments
    const candidatesContacted = await Promise.all(
      completedAssignments
        .filter(a => a.type === 'CANDIDATE')
        .map(async (a) => {
          const candidate = await storage.getCandidateById(a.assigneeId);
          return candidate;
        })
    );

    const candidatesHired = candidatesContacted.filter(c => c && c.status === 'HIRED').length;
    const candidatesInterviewed = candidatesContacted.filter(c =>
      c && ['INTERVIEW', 'OFFER', 'HIRED'].includes(c.status)
    ).length;

    // Calculate response time (average)
    const avgResponseTime = sourcerAssignments
      .filter(a => a.responseTime)
      .reduce((sum, a) => sum + (a.responseTime || 0), 0) /
      (sourcerAssignments.filter(a => a.responseTime).length || 1);

    const metrics = {
      sourcerId,
      period: period || 'all-time',
      totalAssignments: sourcerAssignments.length,
      activeAssignments: activeAssignments.length,
      completedAssignments: completedAssignments.length,
      candidatesHired,
      candidatesInterviewed,
      conversionRate: completedAssignments.length > 0
        ? ((candidatesHired / completedAssignments.length) * 100).toFixed(2)
        : 0,
      interviewRate: completedAssignments.length > 0
        ? ((candidatesInterviewed / completedAssignments.length) * 100).toFixed(2)
        : 0,
      avgResponseTime: avgResponseTime.toFixed(2),
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching sourcer metrics:', error);
    res.status(500).json({ error: 'Failed to fetch sourcer metrics' });
  }
});

export default router;
