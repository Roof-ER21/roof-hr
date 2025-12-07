/**
 * Susan AI Confirmation Handler
 * Executes actions after user confirms via the confirmation dialog
 */

import { storage, IStorage } from '../../storage';
import { SusanRecruitingManager } from './recruiting-manager';
import { SusanPTOManager } from './pto-manager';
import { User } from '../../../shared/schema';

export interface ConfirmationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ConfirmationData {
  action: string;
  [key: string]: any;
}

export class SusanConfirmationHandler {
  private recruitingManager: SusanRecruitingManager;
  private ptoManager: SusanPTOManager;
  private storage: IStorage;

  constructor() {
    this.storage = storage;
    this.recruitingManager = new SusanRecruitingManager(storage);
    this.ptoManager = new SusanPTOManager(storage);
  }

  /**
   * Execute a confirmed action
   */
  async executeConfirmedAction(
    confirmationType: string,
    confirmationData: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    console.log('[SUSAN-CONFIRM] Executing confirmed action:', confirmationType);
    console.log('[SUSAN-CONFIRM] Data:', JSON.stringify(confirmationData).slice(0, 500));

    try {
      switch (confirmationType) {
        case 'confirm_interview_schedule':
          return await this.executeInterviewSchedule(confirmationData, user);

        case 'confirm_move':
        case 'confirm_candidate_move':
          return await this.executeCandidateMove(confirmationData, user);

        case 'confirm_pto_approve':
        case 'approve_pto':
          return await this.executePTOApproval(confirmationData, user);

        case 'confirm_pto_deny':
        case 'deny_pto':
          return await this.executePTODenial(confirmationData, user);

        case 'confirm_employee_create':
        case 'create_employee':
          return await this.executeEmployeeCreate(confirmationData, user);

        case 'confirm_tool_assign':
        case 'assign_tool':
          return await this.executeToolAssignment(confirmationData, user);

        case 'confirm_tool_return':
        case 'return_tool':
          return await this.executeToolReturn(confirmationData, user);

        default:
          return {
            success: false,
            message: `Unknown confirmation type: ${confirmationType}`,
            error: 'UNKNOWN_ACTION'
          };
      }
    } catch (error: any) {
      console.error('[SUSAN-CONFIRM] Execution error:', error);
      return {
        success: false,
        message: `Failed to execute action: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Execute interview scheduling
   */
  private async executeInterviewSchedule(
    data: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    const {
      candidateId,
      candidateName,
      date,
      time,
      interviewerId,
      interviewerIds,
      type,
      location,
      notes
    } = data;

    if (!candidateId) {
      return { success: false, message: 'Candidate ID is required', error: 'MISSING_CANDIDATE' };
    }

    // Parse date
    let scheduledDate: Date;
    if (typeof date === 'string') {
      scheduledDate = new Date(date);
    } else if (date instanceof Date) {
      scheduledDate = date;
    } else {
      scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    // Get interviewer IDs
    const interviewerIdList = interviewerIds || (interviewerId ? [interviewerId] : [user.id]);

    const result = await this.recruitingManager.scheduleInterview(candidateId, {
      date: scheduledDate,
      time: time || '10:00',
      interviewerIds: interviewerIdList,
      type: (type as 'PHONE' | 'VIDEO' | 'ONSITE' | 'IN_PERSON') || 'VIDEO',
      location: location || 'Virtual Meeting',
      notes: notes || `Scheduled by ${user.firstName} ${user.lastName} via Susan AI`
    });

    if (result.success) {
      return {
        success: true,
        message: `Interview scheduled successfully for ${candidateName || 'candidate'}! Calendar invite sent.`,
        data: { interviewId: result.interviewId }
      };
    } else {
      return {
        success: false,
        message: result.error || 'Failed to schedule interview',
        error: result.error
      };
    }
  }

  /**
   * Execute candidate stage movement
   */
  private async executeCandidateMove(
    data: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    const { candidateId, candidateName, targetStatus, currentStatus } = data;

    if (!candidateId) {
      return { success: false, message: 'Candidate ID is required', error: 'MISSING_CANDIDATE' };
    }

    if (!targetStatus) {
      return { success: false, message: 'Target status is required', error: 'MISSING_STATUS' };
    }

    const result = await this.recruitingManager.moveCandidateStage(candidateId, targetStatus);

    if (result.success) {
      // Also update the stage field via storage
      try {
        await this.storage.updateCandidate(candidateId, {
          status: targetStatus.toUpperCase(),
          stage: this.getStageFromStatus(targetStatus)
        });
      } catch (e) {
        console.error('[SUSAN-CONFIRM] Error updating stage:', e);
      }

      return {
        success: true,
        message: `${candidateName || 'Candidate'} has been moved from ${currentStatus || 'current stage'} to ${targetStatus}!`,
        data: { candidateId, newStatus: targetStatus }
      };
    } else {
      return {
        success: false,
        message: result.error || 'Failed to move candidate',
        error: result.error
      };
    }
  }

  /**
   * Convert status to stage name
   */
  private getStageFromStatus(status: string): string {
    const stageMap: Record<string, string> = {
      'APPLIED': 'Application Review',
      'NEW': 'Application Review',
      'SCREENING': 'Initial Screening',
      'INTERVIEW': 'Interview',
      'OFFER': 'Offer Extended',
      'HIRED': 'Hired',
      'REJECTED': 'Rejected',
      'WITHDRAWN': 'Withdrawn'
    };
    return stageMap[status.toUpperCase()] || status;
  }

  /**
   * Execute PTO approval
   */
  private async executePTOApproval(
    data: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    const { requestId, employeeName, employeeId, startDate, endDate } = data;

    if (!requestId && !employeeId) {
      return { success: false, message: 'Request ID or employee ID is required', error: 'MISSING_ID' };
    }

    try {
      // Find the PTO request
      let ptoRequest;
      if (requestId) {
        ptoRequest = await this.storage.getPtoRequestById(requestId);
      } else if (employeeId) {
        // Find pending request for this employee
        const requests = await this.storage.getPendingPtoRequests();
        ptoRequest = requests.find((r: any) => r.employeeId === employeeId && r.status === 'PENDING');
      }

      if (!ptoRequest) {
        return { success: false, message: 'PTO request not found', error: 'NOT_FOUND' };
      }

      // Approve the request
      await this.storage.updatePtoRequest(ptoRequest.id, {
        status: 'APPROVED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNotes: `Approved by ${user.firstName} ${user.lastName} via Susan AI`
      });

      return {
        success: true,
        message: `PTO request for ${employeeName || 'employee'} has been approved!`,
        data: { requestId: ptoRequest.id, status: 'APPROVED' }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to approve PTO: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Execute PTO denial
   */
  private async executePTODenial(
    data: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    const { requestId, employeeName, reason } = data;

    if (!requestId) {
      return { success: false, message: 'Request ID is required', error: 'MISSING_ID' };
    }

    try {
      await this.storage.updatePtoRequest(requestId, {
        status: 'DENIED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNotes: reason || `Denied by ${user.firstName} ${user.lastName} via Susan AI`
      });

      return {
        success: true,
        message: `PTO request for ${employeeName || 'employee'} has been denied.`,
        data: { requestId, status: 'DENIED' }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to deny PTO: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Execute employee creation
   */
  private async executeEmployeeCreate(
    data: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    const {
      firstName,
      lastName,
      email,
      role,
      department,
      phone,
      startDate,
      salary
    } = data;

    if (!firstName || !lastName || !email) {
      return {
        success: false,
        message: 'First name, last name, and email are required',
        error: 'MISSING_FIELDS'
      };
    }

    try {
      // Generate temporary password
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

      // Import bcrypt for password hashing
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const newUser = await this.storage.createUser({
        firstName,
        lastName,
        email,
        passwordHash: hashedPassword,
        role: role || 'EMPLOYEE',
        employmentType: 'W2',
        department: department || 'Operations',
        position: 'Employee',
        phone: phone || '',
        hireDate: startDate ? String(startDate) : new Date().toISOString().split('T')[0],
        mustChangePassword: true,
        isActive: true
      });

      console.log(`[SUSAN-CONFIRM] Created employee: ${firstName} ${lastName} (${newUser.id})`);

      return {
        success: true,
        message: `Employee ${firstName} ${lastName} has been created! Temporary password: ${tempPassword}`,
        data: {
          userId: newUser.id,
          email: newUser.email,
          tempPassword
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create employee: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Execute tool assignment
   */
  private async executeToolAssignment(
    data: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    const { toolId, toolName, employeeId, employeeName, notes } = data;

    if (!toolId || !employeeId) {
      return {
        success: false,
        message: 'Tool ID and employee ID are required',
        error: 'MISSING_FIELDS'
      };
    }

    try {
      // Get all tools and find the one we need
      const allTools = await this.storage.getAllTools();
      const tool = allTools.find(t => t.id === toolId);

      if (!tool) {
        return { success: false, message: 'Tool not found', error: 'NOT_FOUND' };
      }

      if (tool.availableQuantity < 1) {
        return { success: false, message: 'Tool is not available', error: 'NOT_AVAILABLE' };
      }

      // Create assignment using direct db insert
      const { db } = await import('../../db');
      const { toolAssignments } = await import('@shared/schema');
      const { v4: uuidv4 } = await import('uuid');

      await db.insert(toolAssignments).values({
        id: uuidv4(),
        toolId,
        employeeId,
        assignedBy: user.id,
        assignedDate: new Date(),
        status: 'ASSIGNED',
        condition: tool.condition,
        notes: notes || `Assigned by ${user.firstName} ${user.lastName} via Susan AI`,
        signatureRequired: true,
        signatureReceived: false,
        emailSent: false
      });

      // Update tool quantity
      await this.storage.updateToolInventory(toolId, {
        availableQuantity: tool.availableQuantity - 1
      });

      return {
        success: true,
        message: `${toolName || 'Tool'} has been assigned to ${employeeName || 'employee'}!`,
        data: { toolId, employeeId }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to assign tool: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Execute tool return
   */
  private async executeToolReturn(
    data: ConfirmationData,
    user: User
  ): Promise<ConfirmationResult> {
    const { assignmentId, toolId, toolName, condition, notes } = data;

    if (!assignmentId && !toolId) {
      return {
        success: false,
        message: 'Assignment ID or tool ID is required',
        error: 'MISSING_FIELDS'
      };
    }

    try {
      // Update assignment
      if (assignmentId) {
        const { db } = await import('../../db');
        const { toolAssignments } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');

        await db.update(toolAssignments)
          .set({
            returnDate: new Date(),
            status: 'RETURNED',
            notes: notes || `Returned via Susan AI`
          })
          .where(eq(toolAssignments.id, assignmentId));
      }

      // Update tool quantity
      if (toolId) {
        const allTools = await this.storage.getAllTools();
        const tool = allTools.find(t => t.id === toolId);
        if (tool) {
          await this.storage.updateToolInventory(toolId, {
            availableQuantity: tool.availableQuantity + 1
          });
        }
      }

      return {
        success: true,
        message: `${toolName || 'Tool'} has been returned!`,
        data: { assignmentId, toolId }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to return tool: ${error.message}`,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const susanConfirmationHandler = new SusanConfirmationHandler();
