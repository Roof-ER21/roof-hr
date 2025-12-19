import { storage } from '../../storage';
import { EventEmitter } from 'events';
import cron from 'node-cron';
import { differenceInDays, addDays, isAfter, isBefore } from 'date-fns';

const EASTERN_TIMEZONE = 'America/New_York';

interface DeadlineAlert {
  type: 'COI_EXPIRY' | 'CONTRACT_EXPIRY' | 'PTO_APPROVAL' | 'PERFORMANCE_REVIEW' | 'ONBOARDING' | 'INTERVIEW';
  entityId: string;
  entityName: string;
  deadline: Date;
  daysUntilDeadline: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assignedTo?: string;
  message: string;
}

class DeadlineTracker extends EventEmitter {
  private checkInterval: string = '0 8,12,16 * * *'; // Check 3 times daily
  private alertThresholds = {
    COI_EXPIRY: [60, 30, 14, 7, 1], // Days before expiry to alert
    CONTRACT_EXPIRY: [90, 60, 30, 14, 7],
    PTO_APPROVAL: [3, 2, 1], // Days pending
    PERFORMANCE_REVIEW: [30, 14, 7, 1],
    ONBOARDING: [7, 3, 1],
    INTERVIEW: [3, 1, 0] // 0 means same day
  };
  
  private cronTask: any;
  
  constructor() {
    super();
  }
  
  async initialize() {
    console.log('[Susan AI - Deadline Tracker] Initializing...');
    
    // Schedule periodic checks
    this.cronTask = cron.schedule(
      this.checkInterval,
      async () => {
        await this.checkAllDeadlines();
      },
      { timezone: EASTERN_TIMEZONE }
    );
    
    this.cronTask.start();
    
    // Run initial check
    await this.checkAllDeadlines();
    
    console.log('[Susan AI - Deadline Tracker] Initialized with check schedule:', this.checkInterval);
  }
  
  async checkAllDeadlines() {
    const alerts: DeadlineAlert[] = [];
    
    // Check COI document expirations
    const coiAlerts = await this.checkCOIExpirations();
    alerts.push(...coiAlerts);
    
    // Check contract expirations
    const contractAlerts = await this.checkContractExpirations();
    alerts.push(...contractAlerts);
    
    // Check pending PTO approvals
    const ptoAlerts = await this.checkPendingPTORequests();
    alerts.push(...ptoAlerts);
    
    // Check upcoming performance reviews
    const reviewAlerts = await this.checkUpcomingReviews();
    alerts.push(...reviewAlerts);
    
    // Check onboarding tasks
    const onboardingAlerts = await this.checkOnboardingDeadlines();
    alerts.push(...onboardingAlerts);
    
    // Check upcoming interviews
    const interviewAlerts = await this.checkUpcomingInterviews();
    alerts.push(...interviewAlerts);
    
    // Emit alerts
    if (alerts.length > 0) {
      this.emit('deadlines-detected', alerts);
      await this.sendAlerts(alerts);
    }
    
    return alerts;
  }
  
  private async checkCOIExpirations(): Promise<DeadlineAlert[]> {
    const alerts: DeadlineAlert[] = [];
    
    try {
      const coiDocs = await storage.getAllCOIDocuments();
      const today = new Date();
      
      for (const doc of coiDocs) {
        if (!doc.expirationDate || doc.status !== 'ACTIVE') continue;
        
        const expirationDate = new Date(doc.expirationDate);
        const daysUntil = differenceInDays(expirationDate, today);
        
        // Check against thresholds
        if (this.alertThresholds.COI_EXPIRY.includes(daysUntil)) {
          const employee = await storage.getUser(doc.employeeId);
          
          alerts.push({
            type: 'COI_EXPIRY',
            entityId: doc.id,
            entityName: `${employee?.firstName} ${employee?.lastName} - ${doc.type}`,
            deadline: expirationDate,
            daysUntilDeadline: daysUntil,
            priority: daysUntil <= 7 ? 'HIGH' : daysUntil <= 30 ? 'MEDIUM' : 'LOW',
            assignedTo: employee?.primaryManagerId || undefined,
            message: `COI document ${doc.type} for ${employee?.firstName} ${employee?.lastName} expires in ${daysUntil} days`
          });
        }
      }
    } catch (error) {
      console.error('[Deadline Tracker] Error checking COI expirations:', error);
    }
    
    return alerts;
  }
  
  private async checkContractExpirations(): Promise<DeadlineAlert[]> {
    const alerts: DeadlineAlert[] = [];

    try {
      const contracts = await storage.getAllEmployeeContracts();
      const today = new Date();

      for (const contract of contracts) {
        // Note: employeeContracts schema doesn't have expirationDate, so we check for SENT contracts pending signature
        if (contract.status !== 'SENT') continue;

        // Check if contract has been pending too long (7 days)
        const sentDate = contract.sentDate ? new Date(contract.sentDate) : null;
        if (!sentDate) continue;

        const daysPending = differenceInDays(today, sentDate);

        if (daysPending >= 7) {
          const recipientName = contract.recipientName || 'Unknown';

          alerts.push({
            type: 'CONTRACT_EXPIRY',
            entityId: contract.id,
            entityName: `${contract.title} - ${recipientName}`,
            deadline: sentDate,
            daysUntilDeadline: -daysPending, // Negative since it's past due
            priority: daysPending >= 14 ? 'HIGH' : daysPending >= 7 ? 'MEDIUM' : 'LOW',
            assignedTo: contract.createdBy,
            message: `Contract "${contract.title}" for ${recipientName} has been pending signature for ${daysPending} days`
          });
        }
      }
    } catch (error) {
      console.error('[Deadline Tracker] Error checking contract expirations:', error);
    }

    return alerts;
  }
  
  private async checkPendingPTORequests(): Promise<DeadlineAlert[]> {
    const alerts: DeadlineAlert[] = [];
    
    try {
      const ptoRequests = await storage.getAllPtoRequests();
      const today = new Date();
      
      for (const request of ptoRequests) {
        if (request.status !== 'PENDING') continue;
        
        const requestDate = new Date(request.createdAt);
        const daysPending = differenceInDays(today, requestDate);
        
        if (this.alertThresholds.PTO_APPROVAL.includes(daysPending)) {
          const employee = await storage.getUser(request.employeeId);
          
          alerts.push({
            type: 'PTO_APPROVAL',
            entityId: request.id,
            entityName: `${employee?.firstName} ${employee?.lastName} PTO Request`,
            deadline: new Date(request.startDate),
            daysUntilDeadline: differenceInDays(new Date(request.startDate), today),
            priority: daysPending >= 3 ? 'HIGH' : 'MEDIUM',
            assignedTo: employee?.primaryManagerId || undefined,
            message: `PTO request from ${employee?.firstName} ${employee?.lastName} has been pending for ${daysPending} days`
          });
        }
      }
    } catch (error) {
      console.error('[Deadline Tracker] Error checking PTO requests:', error);
    }
    
    return alerts;
  }
  
  private async checkUpcomingReviews(): Promise<DeadlineAlert[]> {
    const alerts: DeadlineAlert[] = [];

    try {
      const employees = await storage.getAllUsers();
      const today = new Date();

      for (const employee of employees) {
        // Skip inactive employees (check isActive flag)
        if (!employee.isActive) continue;

        // Skip employees without a hire date (can't calculate review schedule)
        if (!employee.hireDate) continue;

        // Calculate next review date based on hire date (quarterly reviews)
        const hireDate = new Date(employee.hireDate);
        const monthsSinceHire = Math.floor(differenceInDays(today, hireDate) / 30);
        const nextReviewMonth = Math.ceil((monthsSinceHire + 1) / 3) * 3;
        const nextReview = addDays(hireDate, nextReviewMonth * 30);
        const daysUntil = differenceInDays(nextReview, today);

        if (daysUntil > 0 && this.alertThresholds.PERFORMANCE_REVIEW.includes(daysUntil)) {
          alerts.push({
            type: 'PERFORMANCE_REVIEW',
            entityId: employee.id,
            entityName: `${employee.firstName} ${employee.lastName}`,
            deadline: nextReview,
            daysUntilDeadline: daysUntil,
            priority: daysUntil <= 7 ? 'HIGH' : daysUntil <= 14 ? 'MEDIUM' : 'LOW',
            assignedTo: employee.primaryManagerId || undefined,
            message: `Performance review for ${employee.firstName} ${employee.lastName} is due in ${daysUntil} days`
          });
        }
      }
    } catch (error) {
      console.error('[Deadline Tracker] Error checking performance reviews:', error);
    }

    return alerts;
  }
  
  private async checkOnboardingDeadlines(): Promise<DeadlineAlert[]> {
    const alerts: DeadlineAlert[] = [];

    try {
      // Get recent hires by filtering all users hired within last 30 days
      const allUsers = await storage.getAllUsers();
      const today = new Date();
      const thirtyDaysAgo = addDays(today, -30);

      const recentHires = allUsers.filter((user) => {
        if (!user.hireDate || !user.isActive) return false;
        const hireDate = new Date(user.hireDate);
        return isAfter(hireDate, thirtyDaysAgo);
      });

      for (const employee of recentHires) {
        if (!employee.hireDate) continue;
        const hireDate = new Date(employee.hireDate);
        const onboardingDeadline = addDays(hireDate, 14); // 2 week onboarding period
        const daysUntil = differenceInDays(onboardingDeadline, today);

        if (daysUntil > 0 && this.alertThresholds.ONBOARDING.includes(daysUntil)) {
          alerts.push({
            type: 'ONBOARDING',
            entityId: employee.id,
            entityName: `${employee.firstName} ${employee.lastName}`,
            deadline: onboardingDeadline,
            daysUntilDeadline: daysUntil,
            priority: daysUntil <= 3 ? 'HIGH' : 'MEDIUM',
            assignedTo: employee.primaryManagerId || undefined,
            message: `Onboarding for ${employee.firstName} ${employee.lastName} needs to be completed in ${daysUntil} days`
          });
        }
      }
    } catch (error) {
      console.error('[Deadline Tracker] Error checking onboarding deadlines:', error);
    }

    return alerts;
  }
  
  private async checkUpcomingInterviews(): Promise<DeadlineAlert[]> {
    const alerts: DeadlineAlert[] = [];

    try {
      // Get all interviews and filter for upcoming scheduled ones
      const allInterviews = await storage.getAllInterviews();
      const today = new Date();

      const upcomingInterviews = allInterviews.filter((interview) => {
        if (interview.status !== 'SCHEDULED') return false;
        const scheduledDate = new Date(interview.scheduledDate);
        return isAfter(scheduledDate, today);
      });

      for (const interview of upcomingInterviews) {
        const interviewDate = new Date(interview.scheduledDate);
        const daysUntil = differenceInDays(interviewDate, today);
        const hoursUntil = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60));

        if (this.alertThresholds.INTERVIEW.includes(daysUntil)) {
          const candidate = await storage.getCandidateById(interview.candidateId);

          alerts.push({
            type: 'INTERVIEW',
            entityId: interview.id,
            entityName: `${candidate?.firstName} ${candidate?.lastName} - ${interview.type}`,
            deadline: interviewDate,
            daysUntilDeadline: daysUntil,
            priority: daysUntil === 0 ? 'HIGH' : daysUntil === 1 ? 'MEDIUM' : 'LOW',
            assignedTo: interview.interviewerId || undefined,
            message: daysUntil === 0
              ? `Interview with ${candidate?.firstName} ${candidate?.lastName} is TODAY in ${hoursUntil} hours`
              : `Interview with ${candidate?.firstName} ${candidate?.lastName} is in ${daysUntil} days`
          });
        }
      }
    } catch (error) {
      console.error('[Deadline Tracker] Error checking upcoming interviews:', error);
    }

    return alerts;
  }
  
  private async sendAlerts(alerts: DeadlineAlert[]) {
    // Group alerts by assignee
    const alertsByAssignee = new Map<string, DeadlineAlert[]>();
    
    for (const alert of alerts) {
      const assigneeId = alert.assignedTo || 'admin';
      if (!alertsByAssignee.has(assigneeId)) {
        alertsByAssignee.set(assigneeId, []);
      }
      alertsByAssignee.get(assigneeId)!.push(alert);
    }
    
    // Send notifications
    for (const [assigneeId, assigneeAlerts] of Array.from(alertsByAssignee)) {
      // Get assignee details
      const assignee = assigneeId === 'admin' 
        ? { email: 'admin@roof-er.com', firstName: 'Admin' }
        : await storage.getUser(assigneeId);
      
      if (!assignee) continue;
      
      // Prepare notification
      const highPriorityAlerts = assigneeAlerts.filter((a: DeadlineAlert) => a.priority === 'HIGH');
      const mediumPriorityAlerts = assigneeAlerts.filter((a: DeadlineAlert) => a.priority === 'MEDIUM');
      const lowPriorityAlerts = assigneeAlerts.filter((a: DeadlineAlert) => a.priority === 'LOW');
      
      let message = `Hello ${assignee.firstName},\n\nYou have ${assigneeAlerts.length} upcoming deadlines:\n\n`;
      
      if (highPriorityAlerts.length > 0) {
        message += '🔴 HIGH PRIORITY:\n';
        highPriorityAlerts.forEach((alert: DeadlineAlert) => {
          message += `- ${alert.message}\n`;
        });
        message += '\n';
      }

      if (mediumPriorityAlerts.length > 0) {
        message += '🟡 MEDIUM PRIORITY:\n';
        mediumPriorityAlerts.forEach((alert: DeadlineAlert) => {
          message += `- ${alert.message}\n`;
        });
        message += '\n';
      }

      if (lowPriorityAlerts.length > 0) {
        message += '🟢 LOW PRIORITY:\n';
        lowPriorityAlerts.forEach((alert: DeadlineAlert) => {
          message += `- ${alert.message}\n`;
        });
      }
      
      // Send email notification (integrate with email service)
      await storage.sendEmailNotification(
        assignee.email || 'hr@roof-er.com',
        `HR System - ${highPriorityAlerts.length > 0 ? 'URGENT: ' : ''}Deadline Alerts`,
        message
      );
      
      // Log the alert
      console.log(`[Deadline Tracker] Sent ${assigneeAlerts.length} alerts to ${assignee.firstName}`);
    }
  }
  
  // Manual trigger for testing
  async triggerManualCheck(): Promise<DeadlineAlert[]> {
    console.log('[Deadline Tracker] Manual check triggered');
    return await this.checkAllDeadlines();
  }
  
  // Get current alert status
  async getAlertSummary() {
    const alerts = await this.checkAllDeadlines();
    
    return {
      total: alerts.length,
      byType: {
        COI_EXPIRY: alerts.filter(a => a.type === 'COI_EXPIRY').length,
        CONTRACT_EXPIRY: alerts.filter(a => a.type === 'CONTRACT_EXPIRY').length,
        PTO_APPROVAL: alerts.filter(a => a.type === 'PTO_APPROVAL').length,
        PERFORMANCE_REVIEW: alerts.filter(a => a.type === 'PERFORMANCE_REVIEW').length,
        ONBOARDING: alerts.filter(a => a.type === 'ONBOARDING').length,
        INTERVIEW: alerts.filter(a => a.type === 'INTERVIEW').length
      },
      byPriority: {
        HIGH: alerts.filter(a => a.priority === 'HIGH').length,
        MEDIUM: alerts.filter(a => a.priority === 'MEDIUM').length,
        LOW: alerts.filter(a => a.priority === 'LOW').length
      },
      alerts
    };
  }
  
  // Stop the tracker
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('[Deadline Tracker] Stopped');
    }
  }
}

export const deadlineTracker = new DeadlineTracker();
