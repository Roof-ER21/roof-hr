import { db } from '../../db';
import { ptoRequests, users, ptoPolicies } from '../../../shared/schema';
import { eq, and, or, sql, desc, gte, lte, between } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface PTOAction {
  type: 'approve' | 'deny' | 'adjust_balance' | 'override_policy' | 'cancel' | 'create' | 'bulk_approve';
  requestId?: string;
  employeeId?: string;
  data?: any;
  reason?: string;
}

export class SusanPTOManager {
  private storage: IStorage;
  private emailService: EmailService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.emailService = new EmailService();
  }

  /**
   * Approve PTO request with optional override
   */
  async approvePTORequest(
    requestId: string, 
    overrideConflicts: boolean = false,
    approverNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the request
      const [request] = await db.select()
        .from(ptoRequests)
        .where(eq(ptoRequests.id, requestId))
        .limit(1);

      if (!request) {
        return { success: false, error: 'PTO request not found' };
      }

      if (request.status !== 'PENDING') {
        return { success: false, error: `Request is already ${request.status}` };
      }

      // Check for conflicts unless overriding
      if (!overrideConflicts) {
        const conflicts = await this.checkPTOConflicts(
          request.employeeId,
          request.startDate,
          request.endDate
        );

        if (conflicts.length > 0) {
          return { 
            success: false, 
            error: `Conflicts detected: ${conflicts.join(', ')}. Use override to approve anyway.` 
          };
        }
      }

      // Update request status
      await db.update(ptoRequests)
        .set({
          status: 'APPROVED',
          reviewedBy: 'Susan AI',
          reviewedAt: new Date(),
          reviewNotes: approverNotes || 'Approved by Susan AI',
          updatedAt: new Date()
        })
        .where(eq(ptoRequests.id, requestId));

      // Update PTO balance
      await this.updatePTOBalance(request.employeeId, request.type, -request.days);

      // Send approval email
      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, request.employeeId))
        .limit(1);

      if (employee) {
        await this.emailService.initialize();
        await this.sendPTOStatusEmail(employee, request, 'APPROVED', approverNotes);
      }

      return { success: true };
    } catch (error) {
      console.error('[SUSAN-PTO] Error approving PTO:', error);
      return { success: false, error: 'Failed to approve PTO request' };
    }
  }

  /**
   * Deny PTO request with reason
   */
  async denyPTORequest(requestId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const [request] = await db.select()
        .from(ptoRequests)
        .where(eq(ptoRequests.id, requestId))
        .limit(1);

      if (!request) {
        return { success: false, error: 'PTO request not found' };
      }

      if (request.status !== 'PENDING') {
        return { success: false, error: `Request is already ${request.status}` };
      }

      // Update request status
      await db.update(ptoRequests)
        .set({
          status: 'DENIED',
          reviewedBy: 'Susan AI',
          reviewedAt: new Date(),
          reviewNotes: reason,
          updatedAt: new Date()
        })
        .where(eq(ptoRequests.id, requestId));

      // Send denial email
      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, request.employeeId))
        .limit(1);

      if (employee) {
        await this.emailService.initialize();
        await this.sendPTOStatusEmail(employee, request, 'DENIED', reason);
      }

      return { success: true };
    } catch (error) {
      console.error('[SUSAN-PTO] Error denying PTO:', error);
      return { success: false, error: 'Failed to deny PTO request' };
    }
  }

  /**
   * Adjust PTO balance for an employee
   */
  async adjustPTOBalance(
    employeeId: string,
    type: 'VACATION' | 'SICK' | 'PERSONAL',
    adjustment: number,
    reason: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      // Calculate current balance from approved PTO requests
      const currentYear = new Date().getFullYear();
      const approvedRequests = await db.select()
        .from(ptoRequests)
        .where(and(
          eq(ptoRequests.employeeId, employeeId),
          eq(ptoRequests.status, 'APPROVED'),
          eq(ptoRequests.type, type)
        ));

      const usedDays = approvedRequests
        .filter(r => new Date(r.startDate).getFullYear() === currentYear)
        .reduce((sum, r) => sum + r.days, 0);

      // Get policy for total days available
      const [policy] = await db.select()
        .from(ptoPolicies)
        .where(eq(ptoPolicies.level, 'COMPANY'))
        .limit(1);

      const totalDays = policy?.totalDays || 20; // Default to 20 if no policy
      const currentBalance = totalDays - usedDays;
      const newBalance = currentBalance + adjustment;

      // Log the adjustment (in a real system, this would be stored)
      console.log(`[SUSAN-PTO] Adjusted ${type} balance for ${employeeId} by ${adjustment} days. New balance: ${newBalance}`);
      console.log(`[SUSAN-PTO] Reason: ${reason}`);

      return { success: true, newBalance };
    } catch (error) {
      console.error('[SUSAN-PTO] Error adjusting balance:', error);
      return { success: false, error: 'Failed to adjust PTO balance' };
    }
  }

  /**
   * Cancel an approved PTO request
   */
  async cancelPTORequest(requestId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const [request] = await db.select()
        .from(ptoRequests)
        .where(eq(ptoRequests.id, requestId))
        .limit(1);

      if (!request) {
        return { success: false, error: 'PTO request not found' };
      }

      const wasApproved = request.status === 'APPROVED';

      // Update request status
      await db.update(ptoRequests)
        .set({
          status: 'CANCELLED',
          reviewedBy: 'Susan AI',
          reviewedAt: new Date(),
          reviewNotes: `Cancelled: ${reason}`,
          updatedAt: new Date()
        })
        .where(eq(ptoRequests.id, requestId));

      // If it was approved, restore the balance
      if (wasApproved) {
        await this.updatePTOBalance(request.employeeId, request.type, request.days);
      }

      // Send cancellation email
      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, request.employeeId))
        .limit(1);

      if (employee) {
        await this.emailService.initialize();
        await this.sendPTOStatusEmail(employee, request, 'CANCELLED', reason);
      }

      return { success: true };
    } catch (error) {
      console.error('[SUSAN-PTO] Error cancelling PTO:', error);
      return { success: false, error: 'Failed to cancel PTO request' };
    }
  }

  /**
   * Bulk approve multiple PTO requests
   */
  async bulkApprovePTO(
    filter: { department?: string; dateRange?: { start: string; end: string } }
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const conditions = [eq(ptoRequests.status, 'PENDING')];

      if (filter.department) {
        // Join with users to filter by department
        const departmentUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.department, filter.department));
        
        const userIds = departmentUsers.map(u => u.id);
        if (userIds.length > 0) {
          conditions.push(sql`${ptoRequests.employeeId} IN (${sql.join(userIds, sql`, `)})`);
        }
      }

      if (filter.dateRange) {
        conditions.push(
          and(
            gte(ptoRequests.startDate, filter.dateRange.start),
            lte(ptoRequests.startDate, filter.dateRange.end)
          )
        );
      }

      // Get all matching requests
      const requests = await db.select()
        .from(ptoRequests)
        .where(and(...conditions));

      let approvedCount = 0;
      
      for (const request of requests) {
        const result = await this.approvePTORequest(request.id, false);
        if (result.success) approvedCount++;
      }

      return { success: true, count: approvedCount };
    } catch (error) {
      console.error('[SUSAN-PTO] Error in bulk approve:', error);
      return { success: false, error: 'Failed to bulk approve PTO requests' };
    }
  }

  /**
   * Get PTO statistics and insights
   */
  async getPTOStats(department?: string): Promise<any> {
    try {
      let employeeFilter = undefined;
      
      if (department) {
        const deptUsers = await db.select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.department, department),
            eq(users.isActive, true)
          ));
        
        const userIds = deptUsers.map(u => u.id);
        if (userIds.length > 0) {
          employeeFilter = sql`${ptoRequests.employeeId} IN (${sql.join(userIds, sql`, `)})`;
        }
      }

      const stats = await db.select({
        totalRequests: sql<number>`count(*)`,
        pending: sql<number>`count(*) filter (where status = 'PENDING')`,
        approved: sql<number>`count(*) filter (where status = 'APPROVED')`,
        denied: sql<number>`count(*) filter (where status = 'DENIED')`,
        totalDaysRequested: sql<number>`sum(days)`,
        avgDaysPerRequest: sql<number>`avg(days)`,
        byType: sql<any>`
          json_object_agg(
            type,
            count
          ) from (
            select type, count(*) as count
            from pto_requests
            ${employeeFilter ? sql`where ${employeeFilter}` : sql``}
            group by type
          ) t
        `
      })
      .from(ptoRequests)
      .where(employeeFilter);

      return stats[0];
    } catch (error) {
      console.error('[SUSAN-PTO] Error getting stats:', error);
      return null;
    }
  }

  /**
   * Check for PTO conflicts
   */
  private async checkPTOConflicts(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    const conflicts: string[] = [];

    try {
      // Check for overlapping PTO requests
      const overlapping = await db.select()
        .from(ptoRequests)
        .where(and(
          eq(ptoRequests.employeeId, employeeId),
          eq(ptoRequests.status, 'APPROVED'),
          or(
            between(ptoRequests.startDate, startDate, endDate),
            between(ptoRequests.endDate, startDate, endDate),
            and(
              lte(ptoRequests.startDate, startDate),
              gte(ptoRequests.endDate, endDate)
            )
          )
        ));

      if (overlapping.length > 0) {
        conflicts.push(`${overlapping.length} overlapping PTO requests`);
      }

      // Check blackout dates from policies
      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, employeeId))
        .limit(1);

      if (employee?.department) {
        const policies = await db.select()
          .from(ptoPolicies)
          .where(or(
            eq(ptoPolicies.level, 'COMPANY'),
            and(
              eq(ptoPolicies.level, 'DEPARTMENT'),
              eq(ptoPolicies.targetId, employee.department)
            )
          ));

        for (const policy of policies) {
          if (policy.blackoutDates && Array.isArray(policy.blackoutDates)) {
            for (const blackout of policy.blackoutDates) {
              if (
                (startDate >= blackout.start && startDate <= blackout.end) ||
                (endDate >= blackout.start && endDate <= blackout.end)
              ) {
                conflicts.push(`Blackout period: ${blackout.reason || 'Company policy'}`);
              }
            }
          }
        }
      }

      return conflicts;
    } catch (error) {
      console.error('[SUSAN-PTO] Error checking conflicts:', error);
      return [];
    }
  }

  /**
   * Update PTO balance (placeholder for future implementation)
   */
  private async updatePTOBalance(
    employeeId: string,
    type: string,
    days: number
  ): Promise<void> {
    try {
      // In a real system, this would update a balance tracking table
      // For now, we just log the change
      console.log(`[SUSAN-PTO] Balance update for ${employeeId}: ${days} days of ${type} PTO`);
    } catch (error) {
      console.error('[SUSAN-PTO] Error updating balance:', error);
    }
  }

  /**
   * Send PTO status email
   */
  private async sendPTOStatusEmail(
    employee: any,
    request: any,
    status: string,
    notes?: string
  ): Promise<void> {
    try {
      const subject = `PTO Request ${status}`;
      const html = `
        <h2>PTO Request ${status}</h2>
        <p>Dear ${employee.firstName},</p>
        <p>Your PTO request has been ${status.toLowerCase()}.</p>
        <h3>Request Details:</h3>
        <ul>
          <li>Type: ${request.type}</li>
          <li>Start Date: ${request.startDate}</li>
          <li>End Date: ${request.endDate}</li>
          <li>Days: ${request.days}</li>
          ${notes ? `<li>Notes: ${notes}</li>` : ''}
        </ul>
        <p>Processed by Susan AI</p>
      `;

      await this.emailService.sendEmail({
        to: employee.email,
        subject,
        html
      });
    } catch (error) {
      console.error('[SUSAN-PTO] Error sending email:', error);
    }
  }

  /**
   * Parse natural language PTO command
   */
  async parsePTOCommand(command: string): Promise<PTOAction | null> {
    const lowerCommand = command.toLowerCase();

    // Approve PTO
    if (lowerCommand.includes('approve')) {
      const overrideMatch = lowerCommand.includes('override') || lowerCommand.includes('force');
      const allMatch = lowerCommand.includes('all') || lowerCommand.includes('pending');
      
      if (allMatch) {
        return { type: 'bulk_approve', data: {} };
      }
      
      return { 
        type: 'approve',
        data: { override: overrideMatch }
      };
    }

    // Deny PTO
    if (lowerCommand.includes('deny') || lowerCommand.includes('reject')) {
      const reasonMatch = command.match(/(?:because|reason:)\s+(.+)/i);
      return {
        type: 'deny',
        reason: reasonMatch?.[1] || 'Request denied by management'
      };
    }

    // Adjust balance
    if (lowerCommand.includes('add') || lowerCommand.includes('give') || lowerCommand.includes('adjust')) {
      const daysMatch = command.match(/(\d+)\s*(?:days?|hours?)/i);
      const typeMatch = command.match(/(vacation|sick|personal)/i);
      
      if (daysMatch) {
        return {
          type: 'adjust_balance',
          data: {
            days: parseInt(daysMatch[1]),
            type: typeMatch?.[1]?.toUpperCase() || 'VACATION'
          }
        };
      }
    }

    // Cancel PTO
    if (lowerCommand.includes('cancel')) {
      return {
        type: 'cancel',
        reason: 'Cancelled by Susan AI'
      };
    }

    return null;
  }

  /**
   * Request PTO for an employee (NEW METHOD)
   */
  async requestPTO(data: {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    type: 'VACATION' | 'SICK' | 'PERSONAL';
    reason: string;
    status?: string;
  }): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      const requestId = uuidv4();

      // Calculate business days
      let days = 0;
      const current = new Date(data.startDate);
      const end = new Date(data.endDate);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) days++;
        current.setDate(current.getDate() + 1);
      }

      await db.insert(ptoRequests).values({
        id: requestId,
        employeeId: data.employeeId,
        startDate: data.startDate.toISOString().split('T')[0],
        endDate: data.endDate.toISOString().split('T')[0],
        days: days,
        type: data.type,
        reason: data.reason || 'PTO Request',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`[SUSAN-PTO] Created PTO request ${requestId} for ${days} days`);

      // Get employee info for notification
      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, data.employeeId))
        .limit(1);

      // Send confirmation email
      if (employee) {
        try {
          await this.emailService.initialize();
          await this.emailService.sendEmail({
            to: employee.email,
            subject: 'PTO Request Submitted',
            html: `
              <h2>PTO Request Submitted</h2>
              <p>Dear ${employee.firstName},</p>
              <p>Your PTO request has been submitted and is pending approval.</p>
              <h3>Request Details:</h3>
              <ul>
                <li>Type: ${data.type}</li>
                <li>Start Date: ${data.startDate.toLocaleDateString()}</li>
                <li>End Date: ${data.endDate.toLocaleDateString()}</li>
                <li>Days: ${days}</li>
                <li>Reason: ${data.reason}</li>
              </ul>
              <p>You will be notified when your request is reviewed.</p>
            `
          });
        } catch (emailError) {
          console.error('[SUSAN-PTO] Email error (non-fatal):', emailError);
        }
      }

      return { success: true, requestId };
    } catch (error) {
      console.error('[SUSAN-PTO] Error creating PTO request:', error);
      return { success: false, error: 'Failed to create PTO request: ' + (error as Error).message };
    }
  }

  /**
   * Get PTO balance for an employee (NEW METHOD)
   */
  async getBalance(employeeId: string): Promise<{
    vacation: number;
    sick: number;
    personal: number;
    used: { vacation: number; sick: number; personal: number };
    total: number;
    remaining: number;
  }> {
    try {
      // Get employee's PTO policy
      const policy = await this.storage.getPtoPolicyByEmployee(employeeId);
      const totalDays = policy?.totalDays || 20; // Default 20 days

      // Get current year's approved PTO requests
      const currentYear = new Date().getFullYear();
      const approvedRequests = await db.select()
        .from(ptoRequests)
        .where(and(
          eq(ptoRequests.employeeId, employeeId),
          eq(ptoRequests.status, 'APPROVED')
        ));

      // Calculate used days by type
      const usedVacation = approvedRequests
        .filter(r => r.type === 'VACATION' && new Date(r.startDate).getFullYear() === currentYear)
        .reduce((sum, r) => sum + r.days, 0);

      const usedSick = approvedRequests
        .filter(r => r.type === 'SICK' && new Date(r.startDate).getFullYear() === currentYear)
        .reduce((sum, r) => sum + r.days, 0);

      const usedPersonal = approvedRequests
        .filter(r => r.type === 'PERSONAL' && new Date(r.startDate).getFullYear() === currentYear)
        .reduce((sum, r) => sum + r.days, 0);

      const totalUsed = usedVacation + usedSick + usedPersonal;

      return {
        vacation: totalDays - usedVacation,
        sick: 5 - usedSick, // Default 5 sick days
        personal: 3 - usedPersonal, // Default 3 personal days
        used: { vacation: usedVacation, sick: usedSick, personal: usedPersonal },
        total: totalDays + 5 + 3,
        remaining: totalDays + 5 + 3 - totalUsed
      };
    } catch (error) {
      console.error('[SUSAN-PTO] Error getting balance:', error);
      return {
        vacation: 0,
        sick: 0,
        personal: 0,
        used: { vacation: 0, sick: 0, personal: 0 },
        total: 0,
        remaining: 0
      };
    }
  }

  /**
   * Get team PTO for a manager (NEW METHOD)
   */
  async getTeamPTO(managerId: string): Promise<{
    pending: any[];
    approved: any[];
    upcoming: any[];
    teamMembers: any[];
  }> {
    try {
      // Get the manager's info
      const [manager] = await db.select()
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1);

      if (!manager) {
        return { pending: [], approved: [], upcoming: [], teamMembers: [] };
      }

      // Get team members in same department or reporting to this manager
      const teamMembers = await db.select()
        .from(users)
        .where(and(
          eq(users.department, manager.department || ''),
          eq(users.isActive, true)
        ));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return { pending: [], approved: [], upcoming: [], teamMembers: [] };
      }

      // Get all PTO requests for team
      const allRequests = await db.select()
        .from(ptoRequests)
        .where(sql`${ptoRequests.employeeId} IN (${sql.join(teamIds, sql`, `)})`)
        .orderBy(desc(ptoRequests.createdAt));

      // Separate by status
      const pending = allRequests.filter(r => r.status === 'PENDING');
      const approved = allRequests.filter(r => r.status === 'APPROVED');

      // Get upcoming (within next 30 days)
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      const upcoming = approved.filter(r => {
        const startDate = new Date(r.startDate);
        return startDate >= today && startDate <= thirtyDaysFromNow;
      });

      // Add employee names to requests
      const enrichedPending = await Promise.all(pending.map(async (r) => {
        const emp = teamMembers.find(m => m.id === r.employeeId);
        return { ...r, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown' };
      }));

      const enrichedApproved = await Promise.all(approved.map(async (r) => {
        const emp = teamMembers.find(m => m.id === r.employeeId);
        return { ...r, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown' };
      }));

      const enrichedUpcoming = await Promise.all(upcoming.map(async (r) => {
        const emp = teamMembers.find(m => m.id === r.employeeId);
        return { ...r, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown' };
      }));

      return {
        pending: enrichedPending,
        approved: enrichedApproved,
        upcoming: enrichedUpcoming,
        teamMembers: teamMembers.map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, email: m.email }))
      };
    } catch (error) {
      console.error('[SUSAN-PTO] Error getting team PTO:', error);
      return { pending: [], approved: [], upcoming: [], teamMembers: [] };
    }
  }
}