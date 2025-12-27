/**
 * Susan AI Context Engine
 * Provides context awareness and enhances user queries with relevant information
 */

import { db } from '../../db';
import {
  users,
  territories
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { SusanContext } from './core';
import { susanDataService, type CompanyStats, type PtoData, type EmployeeData } from './data-service';
import { DEPARTMENTS, isValidDepartment } from '@shared/constants/departments';

export interface EnhancedContext extends SusanContext {
  userName?: string;
  userEmail?: string;
  departmentName?: string;
  territoryName?: string;
  teamMembers?: string[];
  recentActivities?: Activity[];
  currentTasks?: Task[];
  upcomingEvents?: Event[];
  // New data fields
  companyStats?: CompanyStats;
  userPtoData?: PtoData;
  userData?: EmployeeData;
}

interface Activity {
  type: string;
  description: string;
  timestamp: Date;
}

interface Task {
  id: string;
  title: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
}

interface Event {
  id: string;
  title: string;
  date: Date;
  type: string;
}

export class ContextEngine {
  private contextCache: Map<string, EnhancedContext> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize the context engine
   */
  async initialize(): Promise<void> {
    console.log('[SUSAN-AI] Context Engine initialized');
  }

  /**
   * Enhance context with additional user and environment information
   */
  async enhanceContext(context: SusanContext): Promise<EnhancedContext> {
    // Check cache first
    const cached = this.contextCache.get(context.userId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    const enhanced: EnhancedContext = { ...context };

    try {
      // Get user details
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, context.userId))
        .limit(1);

      if (user) {
        enhanced.userName = `${user.firstName} ${user.lastName}`;
        enhanced.userEmail = user.email;
      }

      // Get additional user details for current user
      if (user) {
        enhanced.department = user.department;
        enhanced.departmentName = this.getDepartmentName(user.department);
        
        // Get territory information
        if (user.territoryId) {
          const [territory] = await db.select()
            .from(territories)
            .where(eq(territories.id, user.territoryId))
            .limit(1);
          
          if (territory) {
            enhanced.territoryName = territory.name;
            enhanced.territoryId = territory.id;
          }
        }
      }

      // Get team members for managers
      if (['MANAGER', 'HR_MANAGER'].includes(context.userRole)) {
        enhanced.teamMembers = await this.getTeamMembers(context);
      }

      // Get recent activities
      enhanced.recentActivities = await this.getRecentActivities(context);

      // Get current tasks
      enhanced.currentTasks = await this.getCurrentTasks(context);

      // Get upcoming events
      enhanced.upcomingEvents = await this.getUpcomingEvents(context);

      // Get company statistics
      enhanced.companyStats = await susanDataService.getCompanyStats();

      // Get user's PTO data
      enhanced.userPtoData = await susanDataService.getEmployeePtoData(context.userId) || undefined;

      // Get user's detailed data
      enhanced.userData = await susanDataService.getEmployeeData(context.userId) || undefined;

      // Cache the enhanced context
      this.contextCache.set(context.userId, enhanced);

      return enhanced;
    } catch (error) {
      console.error('[SUSAN-AI] Error enhancing context:', error);
      return context as EnhancedContext;
    }
  }

  /**
   * Get department display name - validates against standard departments
   */
  private getDepartmentName(department?: string): string {
    if (!department) return 'Unknown';
    // If it's a valid standard department, return as-is
    if (isValidDepartment(department)) return department;
    // Legacy mapping for old department values
    const legacyMap: Record<string, string> = {
      'hr': 'Human Resources',
      'it': 'Operations', // Map old IT to Operations
      'finance': 'Administration',
      'customer_service': 'Operations',
      'installation': 'Field Operations',
      'quality': 'Operations',
      'marketing': 'Sales', // Map Marketing to Sales
      'engineering': 'Operations',
      'admin': 'Administration',
    };
    return legacyMap[department.toLowerCase()] || department;
  }

  /**
   * Get team members for a manager
   */
  private async getTeamMembers(context: SusanContext): Promise<string[]> {
    if (!context.department) return [];

    const teamMembers = await db.select()
      .from(users)
      .where(eq(users.department, context.department))
      .limit(50);

    return teamMembers.map(member => 
      `${member.firstName} ${member.lastName} (${member.position || 'Employee'})`
    );
  }

  /**
   * Get recent activities for the user
   */
  private async getRecentActivities(context: SusanContext): Promise<Activity[]> {
    const activities: Activity[] = [];

    // Add sample activities based on role
    if (context.userRole === 'HR_MANAGER' || context.userRole === 'ADMIN') {
      activities.push({
        type: 'recruitment',
        description: 'New candidate applied for Senior Developer position',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      });
      activities.push({
        type: 'pto',
        description: '3 PTO requests pending approval',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
      });
    }

    if (context.userRole === 'MANAGER') {
      activities.push({
        type: 'team',
        description: 'Performance review deadline approaching for 2 team members',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      });
    }

    activities.push({
      type: 'system',
      description: 'Company holiday calendar updated for 2025',
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago
    });

    return activities;
  }

  /**
   * Get current tasks for the user
   */
  private async getCurrentTasks(context: SusanContext): Promise<Task[]> {
    const tasks: Task[] = [];

    // Add role-based tasks
    if (context.userRole === 'HR_MANAGER' || context.userRole === 'ADMIN') {
      tasks.push({
        id: 'task-1',
        title: 'Review pending PTO requests',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        priority: 'high'
      });
      tasks.push({
        id: 'task-2',
        title: 'Schedule interviews for open positions',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        priority: 'medium'
      });
    }

    if (context.userRole === 'MANAGER') {
      tasks.push({
        id: 'task-3',
        title: 'Complete quarterly performance reviews',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        priority: 'high'
      });
      tasks.push({
        id: 'task-4',
        title: 'Update team project status',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        priority: 'medium'
      });
    }

    // Common tasks for all users
    tasks.push({
      id: 'task-5',
      title: 'Complete annual training certification',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      priority: 'low'
    });

    return tasks;
  }

  /**
   * Get upcoming events
   */
  private async getUpcomingEvents(context: SusanContext): Promise<Event[]> {
    const events: Event[] = [
      {
        id: 'event-1',
        title: 'Company All-Hands Meeting',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        type: 'meeting'
      },
      {
        id: 'event-2',
        title: 'Q1 Planning Session',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        type: 'planning'
      },
      {
        id: 'event-3',
        title: "President's Day Holiday",
        date: new Date('2025-02-17'),
        type: 'holiday'
      }
    ];

    // Add department-specific events
    if (context.department === 'hr') {
      events.push({
        id: 'event-4',
        title: 'HR Team Training',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        type: 'training'
      });
    }

    if (context.department === 'sales') {
      events.push({
        id: 'event-5',
        title: 'Sales Kickoff Meeting',
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        type: 'meeting'
      });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Check if cached context is still valid
   */
  private isCacheValid(context: EnhancedContext): boolean {
    // For now, always return false to ensure fresh data
    // In production, implement proper cache expiration
    return false;
  }

  /**
   * Clear context cache for a user
   */
  clearCache(userId: string): void {
    this.contextCache.delete(userId);
  }

  /**
   * Clear all cached contexts
   */
  clearAllCache(): void {
    this.contextCache.clear();
  }

  /**
   * Get context summary for display
   */
  getContextSummary(context: EnhancedContext): string {
    const parts: string[] = [];

    if (context.userName) {
      parts.push(`User: ${context.userName}`);
    }

    if (context.userRole) {
      parts.push(`Role: ${context.userRole}`);
    }

    if (context.departmentName) {
      parts.push(`Department: ${context.departmentName}`);
    }

    if (context.territoryName) {
      parts.push(`Territory: ${context.territoryName}`);
    }

    if (context.teamMembers && context.teamMembers.length > 0) {
      parts.push(`Team Size: ${context.teamMembers.length}`);
    }

    return parts.join(' | ');
  }
}