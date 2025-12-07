import { db } from '../../db';
import { users, ptoRequests, sessions } from '../../../shared/schema';
import { eq, and, or, sql, desc, asc, like } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';
import { EmailService } from '../../email-service';

export interface EmployeeAction {
  type: 'create' | 'update' | 'delete' | 'deactivate' | 'reactivate' | 'reset_password' | 'change_role' | 'transfer' | 'bulk_update';
  employeeId?: string;
  data?: any;
  reason?: string;
}

export class SusanEmployeeManager {
  private storage: IStorage;
  private emailService: EmailService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.emailService = new EmailService();
  }

  /**
   * Create a new employee with full details
   */
  async createEmployee(data: any): Promise<{ success: boolean; employee?: any; error?: string }> {
    try {
      // Check if email already exists
      const existing = await db.select()
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1);

      if (existing.length > 0) {
        return { success: false, error: `Employee with email ${data.email} already exists` };
      }

      // Generate temporary password
      const temporaryPassword = this.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      // Create employee
      const [newEmployee] = await db.insert(users).values({
        id: uuidv4(),
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: hashedPassword,
        role: data.role || 'EMPLOYEE',
        department: data.department,
        position: data.position,
        employmentType: data.employmentType || 'FULL_TIME',
        hireDate: data.hireDate || new Date().toISOString().split('T')[0],
        phone: data.phone,
        address: data.address,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        shirtSize: data.shirtSize,
        territoryId: data.territoryId,
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      // Send welcome email
      await this.emailService.initialize();
      await this.emailService.sendWelcomeEmail(newEmployee, temporaryPassword);

      return {
        success: true,
        employee: {
          ...newEmployee,
          temporaryPassword // Return for admin reference
        }
      };
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error creating employee:', error);
      return { success: false, error: 'Failed to create employee' };
    }
  }

  /**
   * Update employee information
   */
  async updateEmployee(employeeId: string, updates: any): Promise<{ success: boolean; employee?: any; error?: string }> {
    try {
      // Validate employee exists
      const [existing] = await db.select()
        .from(users)
        .where(eq(users.id, employeeId))
        .limit(1);

      if (!existing) {
        return { success: false, error: 'Employee not found' };
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date()
      };

      // Only include fields that are provided
      const allowedFields = [
        'firstName', 'lastName', 'email', 'role', 'department', 'position',
        'employmentType', 'phone', 'address', 'emergencyContact', 'emergencyPhone',
        'shirtSize', 'territoryId', 'isActive', 'salary', 'manager'
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      }

      // Perform update
      const [updated] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, employeeId))
        .returning();

      return { success: true, employee: updated };
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error updating employee:', error);
      return { success: false, error: 'Failed to update employee' };
    }
  }

  /**
   * Delete or deactivate an employee
   */
  async removeEmployee(employeeId: string, permanent: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      if (permanent) {
        // Permanent deletion - handle with care
        await db.delete(sessions).where(eq(sessions.userId, employeeId));
        await db.delete(users).where(eq(users.id, employeeId));
        return { success: true };
      } else {
        // Soft delete - just deactivate
        await db.update(users)
          .set({ 
            isActive: false,
            updatedAt: new Date(),
            terminationDate: new Date().toISOString().split('T')[0]
          })
          .where(eq(users.id, employeeId));
        
        // Invalidate all sessions
        await db.delete(sessions).where(eq(sessions.userId, employeeId));
        
        return { success: true };
      }
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error removing employee:', error);
      return { success: false, error: 'Failed to remove employee' };
    }
  }

  /**
   * Reset employee password
   */
  async resetPassword(employeeId: string): Promise<{ success: boolean; temporaryPassword?: string; error?: string }> {
    try {
      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, employeeId))
        .limit(1);

      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }

      const temporaryPassword = this.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      await db.update(users)
        .set({
          passwordHash: hashedPassword,
          mustChangePassword: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, employeeId));

      // Send password reset email
      await this.emailService.initialize();
      await this.emailService.sendEmail({
        to: employee.email,
        subject: 'Password Reset - Roof HR',
        html: `<p>Hello ${employee.firstName},</p>
               <p>Your password has been reset. Your temporary password is: <strong>${temporaryPassword}</strong></p>
               <p>Please log in and change your password immediately.</p>
               <p>Best regards,<br>HR Team</p>`
      });

      return { success: true, temporaryPassword };
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error resetting password:', error);
      return { success: false, error: 'Failed to reset password' };
    }
  }

  /**
   * Change employee role or department
   */
  async transferEmployee(
    employeeId: string, 
    newDepartment?: string, 
    newRole?: string,
    newManager?: string
  ): Promise<{ success: boolean; employee?: any; error?: string }> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };

      if (newDepartment) updateData.department = newDepartment;
      if (newRole) updateData.role = newRole;
      if (newManager) updateData.manager = newManager;

      const [updated] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, employeeId))
        .returning();

      if (!updated) {
        return { success: false, error: 'Employee not found' };
      }

      return { success: true, employee: updated };
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error transferring employee:', error);
      return { success: false, error: 'Failed to transfer employee' };
    }
  }

  /**
   * Bulk update employees
   */
  async bulkUpdateEmployees(
    filter: { department?: string; role?: string; isActive?: boolean },
    updates: any
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const conditions = [];
      
      if (filter.department) {
        conditions.push(eq(users.department, filter.department));
      }
      if (filter.role) {
        conditions.push(eq(users.role, filter.role as typeof users.role.$type));
      }
      if (filter.isActive !== undefined) {
        conditions.push(eq(users.isActive, filter.isActive));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const result = await db.update(users)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(whereClause);

      return { success: true, count: result.rowCount ?? undefined };
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error in bulk update:', error);
      return { success: false, error: 'Failed to bulk update employees' };
    }
  }

  /**
   * Search employees with filters
   */
  async searchEmployees(query: string, filters?: any): Promise<any[]> {
    try {
      const conditions = [];

      // Text search across multiple fields
      if (query) {
        conditions.push(
          or(
            like(users.firstName, `%${query}%`),
            like(users.lastName, `%${query}%`),
            like(users.email, `%${query}%`),
            like(users.position, `%${query}%`)
          )
        );
      }

      // Apply filters
      if (filters?.department) {
        conditions.push(eq(users.department, filters.department));
      }
      if (filters?.role) {
        conditions.push(eq(users.role, filters.role));
      }
      if (filters?.isActive !== undefined) {
        conditions.push(eq(users.isActive, filters.isActive));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db.select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(50);

      return results;
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error searching employees:', error);
      return [];
    }
  }

  /**
   * Get employee statistics
   */
  async getEmployeeStats(): Promise<any> {
    try {
      const stats = await db.select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where is_active = true)`,
        byDepartment: sql<any>`
          json_object_agg(
            department, 
            count
          ) filter (where department is not null)
          from (
            select department, count(*) as count 
            from users 
            where is_active = true 
            group by department
          ) t
        `,
        byRole: sql<any>`
          json_object_agg(
            role_agg, 
            count
          ) from (
            select role as role_agg, count(*) as count 
            from users 
            where is_active = true 
            group by role
          ) t
        `
      }).from(users);

      return stats[0];
    } catch (error) {
      console.error('[SUSAN-EMPLOYEE] Error getting stats:', error);
      return null;
    }
  }

  /**
   * Generate a secure temporary password
   */
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Parse natural language employee command
   */
  async parseEmployeeCommand(command: string): Promise<EmployeeAction | null> {
    const lowerCommand = command.toLowerCase();

    // Create employee
    if (lowerCommand.includes('create') || lowerCommand.includes('add') || lowerCommand.includes('hire')) {
      // Extract employee details from command
      const emailMatch = command.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      const nameMatch = command.match(/(?:named?|called?)\s+(\w+)\s+(\w+)/i);
      
      if (emailMatch || nameMatch) {
        return {
          type: 'create',
          data: {
            email: emailMatch?.[0],
            firstName: nameMatch?.[1],
            lastName: nameMatch?.[2]
          }
        };
      }
    }

    // Delete/deactivate employee
    if (lowerCommand.includes('delete') || lowerCommand.includes('remove') || lowerCommand.includes('terminate')) {
      const emailMatch = command.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      if (emailMatch) {
        return {
          type: lowerCommand.includes('delete') ? 'delete' : 'deactivate',
          data: { email: emailMatch[0] }
        };
      }
    }

    // Reset password
    if (lowerCommand.includes('reset password') || lowerCommand.includes('new password')) {
      const emailMatch = command.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
      if (emailMatch) {
        return {
          type: 'reset_password',
          data: { email: emailMatch[0] }
        };
      }
    }

    // Change role
    if (lowerCommand.includes('promote') || lowerCommand.includes('make') && lowerCommand.includes('manager')) {
      return {
        type: 'change_role',
        data: { role: 'MANAGER' }
      };
    }

    // Transfer department
    if (lowerCommand.includes('transfer') || lowerCommand.includes('move to')) {
      const deptMatch = command.match(/(?:to|into)\s+(\w+)\s+(?:department|team)/i);
      if (deptMatch) {
        return {
          type: 'transfer',
          data: { department: deptMatch[1] }
        };
      }
    }

    return null;
  }
}