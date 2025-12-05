/**
 * Susan AI Data Service
 * Provides access to all HR data for Susan AI queries
 */

import { db } from '../../db';
import { 
  users, 
  ptoPolicies, 
  ptoRequests,
  territories,
  candidates
} from '@shared/schema';
import { eq, count, and, isNull, desc, asc } from 'drizzle-orm';

export interface EmployeeData {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  hireDate: string;
  isActive: boolean;
  territory?: string;
}

export interface PtoData {
  employeeId: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  vacationDays: number;
  sickDays: number;
  personalDays: number;
}

export interface CompanyStats {
  totalEmployees: number;
  activeEmployees: number;
  totalCandidates: number;
  pendingPtoRequests: number;
  totalTerritories: number;
  recentHires: number; // Last 30 days
}

export class SusanDataService {
  /**
   * Get employee count and basic statistics
   */
  async getCompanyStats(): Promise<CompanyStats> {
    try {
      // Get total and active employee counts
      const [totalResult] = await db.select({ count: count() }).from(users);
      const [activeResult] = await db.select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true));

      // Get candidate count
      const [candidateResult] = await db.select({ count: count() })
        .from(candidates);

      // Get pending PTO requests
      const [ptoResult] = await db.select({ count: count() })
        .from(ptoRequests)
        .where(eq(ptoRequests.status, 'PENDING'));

      // Get territory count
      const [territoryResult] = await db.select({ count: count() })
        .from(territories)
        .where(eq(territories.isActive, true));

      // Get recent hires (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const hireDate = thirtyDaysAgo.toISOString().split('T')[0];
      
      const [recentHiresResult] = await db.select({ count: count() })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          // Note: This is a text comparison, may need adjustment based on date format
        ));

      return {
        totalEmployees: totalResult.count,
        activeEmployees: activeResult.count,
        totalCandidates: candidateResult.count,
        pendingPtoRequests: ptoResult.count,
        totalTerritories: territoryResult.count,
        recentHires: 0 // Will calculate this properly later
      };
    } catch (error) {
      console.error('[SUSAN-DATA] Error getting company stats:', error);
      return {
        totalEmployees: 0,
        activeEmployees: 0,
        totalCandidates: 0,
        pendingPtoRequests: 0,
        totalTerritories: 0,
        recentHires: 0
      };
    }
  }

  /**
   * Get PTO information for a specific employee
   */
  async getEmployeePtoData(employeeId: string): Promise<PtoData | null> {
    try {
      const [ptoPolicy] = await db.select()
        .from(ptoPolicies)
        .where(eq(ptoPolicies.employeeId, employeeId))
        .limit(1);

      if (!ptoPolicy) {
        return null;
      }

      return {
        employeeId,
        totalDays: ptoPolicy.totalDays,
        usedDays: ptoPolicy.usedDays,
        remainingDays: ptoPolicy.remainingDays,
        vacationDays: ptoPolicy.vacationDays,
        sickDays: ptoPolicy.sickDays,
        personalDays: ptoPolicy.personalDays
      };
    } catch (error) {
      console.error('[SUSAN-DATA] Error getting PTO data:', error);
      return null;
    }
  }

  /**
   * Get employee information
   */
  async getEmployeeData(employeeId: string): Promise<EmployeeData | null> {
    try {
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, employeeId))
        .limit(1);

      if (!user) {
        return null;
      }

      let territoryName = undefined;
      if (user.territoryId) {
        const [territory] = await db.select()
          .from(territories)
          .where(eq(territories.id, user.territoryId))
          .limit(1);
        territoryName = territory?.name;
      }

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        department: user.department,
        position: user.position,
        role: user.role,
        hireDate: user.hireDate,
        isActive: user.isActive,
        territory: territoryName
      };
    } catch (error) {
      console.error('[SUSAN-DATA] Error getting employee data:', error);
      return null;
    }
  }

  /**
   * Get all employees by department
   */
  async getEmployeesByDepartment(department?: string): Promise<EmployeeData[]> {
    try {
      let query = db.select().from(users).where(eq(users.isActive, true));
      
      if (department) {
        query = db.select().from(users).where(
          and(eq(users.isActive, true), eq(users.department, department))
        );
      }

      const employees = await query;

      return employees.map(user => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        department: user.department,
        position: user.position,
        role: user.role,
        hireDate: user.hireDate,
        isActive: user.isActive
      }));
    } catch (error) {
      console.error('[SUSAN-DATA] Error getting employees by department:', error);
      return [];
    }
  }

  /**
   * Get pending PTO requests for approval
   */
  async getPendingPtoRequests(): Promise<any[]> {
    try {
      const requests = await db.select({
        id: ptoRequests.id,
        employeeId: ptoRequests.employeeId,
        startDate: ptoRequests.startDate,
        endDate: ptoRequests.endDate,
        days: ptoRequests.days,
        reason: ptoRequests.reason,
        createdAt: ptoRequests.createdAt,
        employeeName: users.firstName,
        employeeLastName: users.lastName,
        employeeDepartment: users.department
      })
      .from(ptoRequests)
      .innerJoin(users, eq(ptoRequests.employeeId, users.id))
      .where(eq(ptoRequests.status, 'PENDING'))
      .orderBy(asc(ptoRequests.createdAt));

      return requests.map(req => ({
        id: req.id,
        employeeId: req.employeeId,
        employeeName: `${req.employeeName} ${req.employeeLastName}`,
        department: req.employeeDepartment,
        startDate: req.startDate,
        endDate: req.endDate,
        days: req.days,
        reason: req.reason,
        createdAt: req.createdAt
      }));
    } catch (error) {
      console.error('[SUSAN-DATA] Error getting pending PTO requests:', error);
      return [];
    }
  }

  /**
   * Get recent activities for context
   */
  async getRecentActivities(userId: string, limit: number = 10): Promise<any[]> {
    try {
      // This would combine various recent activities
      // For now, return recent PTO requests from user
      const requests = await db.select({
        id: ptoRequests.id,
        startDate: ptoRequests.startDate,
        endDate: ptoRequests.endDate,
        days: ptoRequests.days,
        status: ptoRequests.status,
        createdAt: ptoRequests.createdAt
      })
      .from(ptoRequests)
      .where(eq(ptoRequests.employeeId, userId))
      .orderBy(desc(ptoRequests.createdAt))
      .limit(limit);

      return requests.map(req => ({
        type: 'PTO_REQUEST',
        description: `PTO request for ${req.days} days (${req.startDate} - ${req.endDate}) - ${req.status}`,
        timestamp: req.createdAt
      }));
    } catch (error) {
      console.error('[SUSAN-DATA] Error getting recent activities:', error);
      return [];
    }
  }

  /**
   * Search employees by name or email
   */
  async searchEmployees(query: string): Promise<EmployeeData[]> {
    try {
      // This is a simplified search - in production you'd use full-text search
      const employees = await db.select()
        .from(users)
        .where(eq(users.isActive, true))
        .limit(50);

      return employees
        .filter(user => 
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase())
        )
        .map(user => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          department: user.department,
          position: user.position,
          role: user.role,
          hireDate: user.hireDate,
          isActive: user.isActive
        }));
    } catch (error) {
      console.error('[SUSAN-DATA] Error searching employees:', error);
      return [];
    }
  }
}

export const susanDataService = new SusanDataService();