import OpenAI from 'openai';
import { 
  BotNotification, 
  CandidateValidation,
  BotConfiguration 
} from '../../shared/recruitment-bot-schema';
import { Candidate } from '../../shared/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class RecruitmentBot {
  private static instance: RecruitmentBot;
  private notifications: BotNotification[] = [];
  private config: BotConfiguration = {
    idleThresholdDays: 7,
    autoArchiveAfterDays: 30,
    enableAutoNotifications: true,
    enableInconsistencyChecks: true,
    notificationRecipients: ['ADMIN', 'MANAGER'],
  };

  private constructor() {}

  static getInstance(): RecruitmentBot {
    if (!RecruitmentBot.instance) {
      RecruitmentBot.instance = new RecruitmentBot();
    }
    return RecruitmentBot.instance;
  }

  // Validate candidate data against requirements
  async validateCandidate(candidate: any, nextStage?: string): Promise<CandidateValidation> {
    const issues: any[] = [];
    const missingRequirements: string[] = [];

    // Check for idle candidates
    const daysSinceLastUpdate = this.getDaysSinceLastUpdate(candidate.updatedAt);
    if (daysSinceLastUpdate > this.config.idleThresholdDays) {
      issues.push({
        field: 'lastActivity',
        issue: `Candidate has been idle for ${daysSinceLastUpdate} days`,
        severity: 'WARNING',
        suggestion: 'Follow up with candidate or archive'
      });
    }

    // Check license consistency
    const licenseInconsistency = await this.checkLicenseConsistency(candidate);
    if (licenseInconsistency) {
      issues.push(licenseInconsistency);
    }

    // Check experience consistency
    const experienceInconsistency = await this.checkExperienceConsistency(candidate);
    if (experienceInconsistency) {
      issues.push(experienceInconsistency);
    }

    // Check stage transition requirements
    if (nextStage) {
      const stageRequirements = this.getStageRequirements(nextStage);
      for (const req of stageRequirements) {
        if (!this.meetsRequirement(candidate, req)) {
          missingRequirements.push(req);
          issues.push({
            field: req,
            issue: `Missing requirement: ${req}`,
            severity: 'ERROR',
            suggestion: `Complete ${req} before moving to ${nextStage}`
          });
        }
      }
    }

    return {
      candidateId: candidate.id,
      isValid: issues.filter(i => i.severity === 'ERROR').length === 0,
      issues,
      readyForNextStage: missingRequirements.length === 0,
      missingRequirements: missingRequirements.length > 0 ? missingRequirements : undefined
    };
  }

  // Check for license inconsistencies using AI
  async checkLicenseConsistency(candidate: any): Promise<any> {
    if (!candidate.resume || !candidate.hasDriversLicense) {
      return null;
    }

    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an HR assistant checking for inconsistencies in candidate data. Analyze the resume text and check if it mentions driver's license status. Respond in JSON format with: {hasInconsistency: boolean, details: string}"
          },
          {
            role: "user",
            content: `Resume: ${candidate.resume}\n\nCandidate marked as having driver's license: ${candidate.hasDriversLicense}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 200,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.hasInconsistency) {
        return {
          field: 'driversLicense',
          issue: `License status inconsistency detected: ${result.details}`,
          severity: 'ERROR',
          suggestion: 'Verify driver\'s license status with candidate'
        };
      }
    } catch (error) {
      console.error('Error checking license consistency:', error);
    }

    return null;
  }

  // Check experience consistency
  async checkExperienceConsistency(candidate: any): Promise<any> {
    if (!candidate.resume || !candidate.experience) {
      return null;
    }

    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Check if the stated years of experience matches what's in the resume. Respond in JSON: {hasInconsistency: boolean, details: string}"
          },
          {
            role: "user",
            content: `Resume: ${candidate.resume}\n\nStated experience: ${candidate.experience} years`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 200,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.hasInconsistency) {
        return {
          field: 'experience',
          issue: `Experience inconsistency: ${result.details}`,
          severity: 'WARNING',
          suggestion: 'Verify experience details during interview'
        };
      }
    } catch (error) {
      console.error('Error checking experience consistency:', error);
    }

    return null;
  }

  // Create notification for admins and managers
  async createNotification(
    type: BotNotification['type'],
    candidate: any,
    message: string,
    severity: BotNotification['severity'] = 'MEDIUM',
    details?: any
  ): Promise<BotNotification> {
    const notification: BotNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      candidateId: candidate.id,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      message,
      severity,
      details,
      createdAt: new Date(),
      resolved: false
    };

    this.notifications.push(notification);
    
    // In a real implementation, this would send actual notifications
    console.log('[RECRUITMENT BOT] Notification created:', notification);
    
    return notification;
  }

  // Get stage requirements
  private getStageRequirements(stage: string): string[] {
    const requirements: Record<string, string[]> = {
      'SCREENING': ['email', 'phone', 'resume'],
      'INTERVIEW': ['email', 'phone', 'resume', 'availability'],
      'TECHNICAL': ['email', 'phone', 'resume', 'technicalSkills'],
      'OFFER': ['email', 'phone', 'resume', 'references', 'backgroundCheck'],
      'HIRED': ['email', 'phone', 'resume', 'signedOffer', 'i9Form']
    };

    return requirements[stage] || [];
  }

  // Check if candidate meets requirement
  private meetsRequirement(candidate: any, requirement: string): boolean {
    // Simple check - in production this would be more sophisticated
    return candidate[requirement] !== null && candidate[requirement] !== undefined && candidate[requirement] !== '';
  }

  // Calculate days since last update
  private getDaysSinceLastUpdate(updatedAt: string | Date): number {
    const lastUpdate = new Date(updatedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Get suggested next steps for a candidate
  async getSuggestedNextSteps(candidate: any): Promise<string[]> {
    const suggestions: string[] = [];
    const validation = await this.validateCandidate(candidate);

    if (validation.issues.length > 0) {
      validation.issues.forEach(issue => {
        if (issue.suggestion) {
          suggestions.push(issue.suggestion);
        }
      });
    }

    // Add stage-specific suggestions
    switch (candidate.status) {
      case 'SCREENING':
        suggestions.push('Schedule initial phone screening');
        suggestions.push('Review resume and qualifications');
        break;
      case 'INTERVIEW':
        suggestions.push('Prepare interview questions');
        suggestions.push('Send calendar invite');
        suggestions.push('Review candidate portfolio');
        break;
      case 'TECHNICAL':
        suggestions.push('Prepare technical assessment');
        suggestions.push('Schedule technical interview');
        break;
      case 'OFFER':
        suggestions.push('Prepare offer letter');
        suggestions.push('Check references');
        suggestions.push('Initiate background check');
        break;
    }

    return suggestions;
  }

  // Monitor all candidates for issues
  async monitorCandidates(candidates: any[]): Promise<BotNotification[]> {
    const newNotifications: BotNotification[] = [];

    for (const candidate of candidates) {
      const validation = await this.validateCandidate(candidate);

      // Check for idle candidates
      const daysSinceUpdate = this.getDaysSinceLastUpdate(candidate.updatedAt);
      if (daysSinceUpdate > this.config.idleThresholdDays) {
        const notification = await this.createNotification(
          'IDLE_CANDIDATE',
          candidate,
          `Candidate has been idle for ${daysSinceUpdate} days in ${candidate.status} stage`,
          daysSinceUpdate > 14 ? 'HIGH' : 'MEDIUM',
          { daysSinceUpdate, currentStage: candidate.status }
        );
        newNotifications.push(notification);
      }

      // Check for validation issues
      for (const issue of validation.issues) {
        if (issue.severity === 'ERROR') {
          const notification = await this.createNotification(
            issue.field === 'driversLicense' ? 'LICENSE_MISMATCH' : 'INCONSISTENCY_DETECTED',
            candidate,
            issue.issue,
            'HIGH',
            issue
          );
          newNotifications.push(notification);
        }
      }
    }

    return newNotifications;
  }

  // Get all notifications
  getNotifications(unacknowledgedOnly = false): BotNotification[] {
    if (unacknowledgedOnly) {
      return this.notifications.filter(n => !n.acknowledgedAt);
    }
    return this.notifications;
  }

  // Acknowledge notification
  acknowledgeNotification(notificationId: string, userId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.acknowledgedAt = new Date();
      notification.acknowledgedBy = userId;
    }
  }

  // Update bot configuration
  updateConfiguration(config: Partial<BotConfiguration>): void {
    this.config = { ...this.config, ...config };
  }

  // Get bot status and statistics
  getBotStatus(): any {
    const unacknowledged = this.notifications.filter(n => !n.acknowledgedAt);
    const critical = this.notifications.filter(n => n.severity === 'CRITICAL');
    const high = this.notifications.filter(n => n.severity === 'HIGH');

    return {
      isActive: true,
      configuration: this.config,
      statistics: {
        totalNotifications: this.notifications.length,
        unacknowledgedNotifications: unacknowledged.length,
        criticalNotifications: critical.length,
        highPriorityNotifications: high.length,
      },
      lastCheck: new Date(),
    };
  }
}

export const recruitmentBot = RecruitmentBot.getInstance();