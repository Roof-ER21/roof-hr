import { BaseAgent, AgentConfig, AgentContext, AgentResult } from './base-agent';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

// PTO Reminder Agent
export class PTOExpirationAgent extends BaseAgent {
  constructor(context: AgentContext = {}) {
    const config: AgentConfig = {
      name: 'PTO Expiration Reminder',
      description: 'Sends reminders for upcoming PTO expiration dates',
      enabled: true,
      schedule: '0 9 * * MON', // Every Monday at 9 AM
      priority: 'medium',
      retryAttempts: 3,
      timeout: 30000
    };
    super(config, context);
  }

  async execute(): Promise<AgentResult> {
    try {
      const users = await this.getAllUsers();
      const today = new Date();
      const reminderDate = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
      
      const reminders: string[] = [];
      const warnings: string[] = [];

      for (const user of users) {
        if (!user.isActive) continue;

        // Check if user has unused PTO that might expire
        const ptoRequests = await storage.getPtoRequestsByEmployeeId(user.id);
        const usedPTO = ptoRequests
          .filter(req => req.status === 'APPROVED')
          .reduce((total, req) => total + req.days, 0);

        // Assuming 15 days PTO per year (this should be configurable)
        const totalPTOAllowance = 15;
        const unusedPTO = totalPTOAllowance - usedPTO;

        if (unusedPTO > 0) {
          await this.sendNotification(
            user.id,
            `You have ${unusedPTO} unused PTO days. Remember to plan your time off!`,
            'info'
          );
          reminders.push(`Sent PTO reminder to ${user.firstName} ${user.lastName}`);
        }
      }

      return {
        success: true,
        message: `PTO reminders processed for ${users.length} employees`,
        data: { remindersCount: reminders.length },
        warnings
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to process PTO reminders',
        errors: [(error as Error).message]
      };
    }
  }
}

// Performance Review Automation Agent
export class PerformanceReviewAgent extends BaseAgent {
  constructor(context: AgentContext = {}) {
    const config: AgentConfig = {
      name: 'Performance Review Automation',
      description: 'Automatically creates performance reviews based on schedule',
      enabled: true,
      schedule: '0 10 1 */3 *', // First day of every quarter at 10 AM
      priority: 'high',
      retryAttempts: 2,
      timeout: 60000
    };
    super(config, context);
  }

  async execute(): Promise<AgentResult> {
    try {
      const users = await this.getAllUsers();
      const today = new Date();
      const quarter = Math.floor(today.getMonth() / 3) + 1;
      const year = today.getFullYear();
      const reviewPeriod = `Q${quarter} ${year}`;

      const createdReviews: string[] = [];
      const errors: string[] = [];

      for (const employee of users) {
        if (!employee.isActive || employee.role === 'ADMIN') continue;

        try {
          // Find the employee's manager (simplified - assumes department managers exist)
          const managers = users.filter(u => 
            u.role === 'MANAGER' && 
            u.department === employee.department && 
            u.isActive
          );

          if (managers.length === 0) {
            errors.push(`No manager found for ${employee.firstName} ${employee.lastName}`);
            continue;
          }

          const manager = managers[0]; // Use first available manager

          // Check if review already exists for this period
          const existingReviews = await storage.getEmployeeReviewsByEmployeeId(employee.id);
          const hasReviewForPeriod = existingReviews.some(review => 
            review.reviewPeriod === reviewPeriod
          );

          if (hasReviewForPeriod) {
            continue; // Skip if review already exists
          }

          // Create the review
          const dueDate = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000)); // Due in 2 weeks

          await storage.createEmployeeReview({
            revieweeId: employee.id,
            reviewerId: manager.id,
            reviewPeriod,
            reviewType: 'QUARTERLY',
            status: 'DRAFT',
            dueDate: dueDate.toISOString().split('T')[0],
            goals: `Performance review for ${reviewPeriod}`,
          });

          createdReviews.push(`Created review for ${employee.firstName} ${employee.lastName}`);

          // Send notification to manager
          await this.sendNotification(
            manager.id,
            `Performance review created for ${employee.firstName} ${employee.lastName}. Due date: ${dueDate.toDateString()}`,
            'info'
          );

        } catch (error) {
          errors.push(`Failed to create review for ${employee.firstName} ${employee.lastName}: ${(error as Error).message}`);
        }
      }

      return {
        success: true,
        message: `Performance review automation completed`,
        data: { 
          reviewsCreated: createdReviews.length,
          period: reviewPeriod
        },
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to automate performance reviews',
        errors: [(error as Error).message]
      };
    }
  }
}

// Document Expiration Agent
export class DocumentExpirationAgent extends BaseAgent {
  constructor(context: AgentContext = {}) {
    const config: AgentConfig = {
      name: 'Document Expiration Monitor',
      description: 'Monitors and alerts for expiring documents',
      enabled: true,
      schedule: '0 8 * * MON,WED,FRI', // Mon, Wed, Fri at 8 AM
      priority: 'high',
      retryAttempts: 3,
      timeout: 45000
    };
    super(config, context);
  }

  async execute(): Promise<AgentResult> {
    try {
      const documents = await storage.getAllDocuments();
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
      
      const expiringSoon: any[] = [];
      const expired: any[] = [];

      for (const doc of documents) {
        if (!doc.expiresAt) continue;

        const expirationDate = new Date(doc.expiresAt);
        
        if (expirationDate < today) {
          expired.push(doc);
        } else if (expirationDate <= thirtyDaysFromNow) {
          expiringSoon.push(doc);
        }
      }

      // Create tasks for document renewals
      const createdTasks: string[] = [];

      for (const doc of [...expiringSoon, ...expired]) {
        const isExpired = expired.includes(doc);
        const priority = isExpired ? 'HIGH' : 'MEDIUM';
        const status = isExpired ? 'URGENT' : 'TODO';

        // Find appropriate person to assign the task to
        const admins = (await this.getAllUsers()).filter(u => u.role === 'ADMIN' && u.isActive);
        if (admins.length === 0) continue;

        const assignedTo = admins[0].id;

        await this.createTask({
          title: `${isExpired ? 'EXPIRED' : 'Expiring'}: ${doc.name}`,
          description: `Document "${doc.name}" ${isExpired ? 'has expired' : 'expires on'} ${new Date(doc.expiresAt!).toLocaleDateString()}. Please review and renew if necessary.`,
          assignedTo,
          assignedBy: 'system',
          priority,
          status,
          category: 'Document Management',
          tags: ['document-expiration', 'compliance'],
          dueDate: isExpired ? new Date().toISOString() : doc.expiresAt
        });

        createdTasks.push(`Created task for ${doc.name}`);

        // Send notification
        await this.sendNotification(
          assignedTo,
          `Document "${doc.name}" ${isExpired ? 'has expired' : 'expires soon'}. Please review.`,
          isExpired ? 'error' : 'warning'
        );
      }

      return {
        success: true,
        message: `Document expiration monitoring completed`,
        data: {
          expiringSoon: expiringSoon.length,
          expired: expired.length,
          tasksCreated: createdTasks.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to monitor document expiration',
        errors: [(error as Error).message]
      };
    }
  }
}

// Onboarding Workflow Agent
export class OnboardingAgent extends BaseAgent {
  constructor(context: AgentContext = {}) {
    const config: AgentConfig = {
      name: 'Onboarding Workflow',
      description: 'Manages automated onboarding workflows for new employees',
      enabled: true,
      priority: 'high',
      retryAttempts: 2,
      timeout: 30000
    };
    super(config, context);
  }

  async execute(): Promise<AgentResult> {
    try {
      // Get all new employees (hired in the last 7 days)
      const users = await this.getAllUsers();
      const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
      
      const newEmployees = users.filter(user => {
        const hireDate = new Date(user.hireDate);
        return hireDate >= sevenDaysAgo && user.isActive;
      });

      const processedEmployees: string[] = [];

      for (const employee of newEmployees) {
        // Check if onboarding workflow already exists
        // In a real implementation, you'd check the onboardingWorkflows table
        
        // Create onboarding tasks
        const onboardingTasks = [
          {
            title: 'Complete New Employee Paperwork',
            description: 'Fill out all required forms including tax documents, emergency contacts, and direct deposit information.',
            priority: 'HIGH' as const,
            category: 'Onboarding',
            tags: ['paperwork', 'hr-required'],
            dueDate: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString() // 3 days
          },
          {
            title: 'IT Setup and Equipment Assignment',
            description: 'Set up email account, assign laptop/equipment, configure access permissions.',
            priority: 'HIGH' as const,
            category: 'IT Setup',
            tags: ['equipment', 'access'],
            dueDate: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString() // 2 days
          },
          {
            title: 'Safety Training Completion',
            description: 'Complete mandatory safety training and OSHA requirements.',
            priority: 'MEDIUM' as const,
            category: 'Training',
            tags: ['safety', 'compliance'],
            dueDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString() // 1 week
          },
          {
            title: 'Department Introduction Meeting',
            description: 'Schedule and conduct introduction meeting with team members and direct supervisor.',
            priority: 'MEDIUM' as const,
            category: 'Integration',
            tags: ['team-meeting', 'introduction'],
            dueDate: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString() // 5 days
          }
        ];

        // Find HR admin to assign tasks to
        const hrAdmins = users.filter(u => 
          (u.role === 'ADMIN' || u.role === 'MANAGER') && 
          u.department === 'Administration' && 
          u.isActive
        );

        const assignedTo = hrAdmins.length > 0 ? hrAdmins[0].id : users.find(u => u.role === 'ADMIN')?.id;

        if (!assignedTo) {
          continue; // Skip if no admin found
        }

        for (const taskData of onboardingTasks) {
          await this.createTask({
            ...taskData,
            assignedTo,
            assignedBy: 'system',
            status: 'TODO'
          });
        }

        processedEmployees.push(`${employee.firstName} ${employee.lastName}`);

        // Send welcome notification
        await this.sendNotification(
          employee.id,
          'Welcome to the team! Your onboarding tasks have been created. Please check with HR for next steps.',
          'info'
        );

        await this.sendNotification(
          assignedTo,
          `Onboarding tasks created for new employee: ${employee.firstName} ${employee.lastName}`,
          'info'
        );
      }

      return {
        success: true,
        message: `Onboarding workflows processed`,
        data: {
          newEmployees: newEmployees.length,
          processed: processedEmployees.length,
          employees: processedEmployees
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to process onboarding workflows',
        errors: [(error as Error).message]
      };
    }
  }
}

// Helper function to run agents for testing
export async function runAgent(agentName: string, testMode = false): Promise<any> {
  let agent: BaseAgent;
  
  switch (agentName) {
    case 'PTO Expiration Reminder':
      agent = new PTOExpirationAgent({ testMode });
      break;
    case 'Performance Review Automation':
      agent = new PerformanceReviewAgent({ testMode });
      break;
    case 'Document Expiration Monitor':
      agent = new DocumentExpirationAgent({ testMode });
      break;
    case 'Onboarding Workflow':
      agent = new OnboardingAgent({ testMode });
      break;
    default:
      return {
        success: false,
        message: `Unknown agent: ${agentName}`,
        errors: [`Agent ${agentName} not found`]
      };
  }
  
  // Log the test run
  await storage.createHrAgentLog({
    agentName,
    status: 'RUNNING',
    message: testMode ? 'Test run initiated' : 'Manual run initiated',
    affectedRecords: 0
  });
  
  const startTime = Date.now();
  const result = await agent.run();
  const executionTime = Date.now() - startTime;
  
  // Log the result
  await storage.createHrAgentLog({
    agentName,
    status: result.success ? 'SUCCESS' : 'FAILED',
    message: result.message,
    affectedRecords: result.data?.affectedRecords || 0,
    executionTime,
    details: JSON.stringify(result.data || {})
  });
  
  // Update agent config with last run info
  const config = await storage.getHrAgentConfigByName(agentName);
  if (config) {
    await storage.updateHrAgentConfig(config.id, {
      lastRun: new Date().toISOString(),
      lastStatus: result.success ? 'SUCCESS' : 'FAILED',
      lastError: result.errors?.[0] || null
    });
  }
  
  return result;
}