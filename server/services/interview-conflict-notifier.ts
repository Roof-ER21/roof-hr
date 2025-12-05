import { emailService } from '../email-service';
import type { CalendarConflict } from './calendar-conflict-detector';
import { format } from 'date-fns';
import type { IStorage } from '../storage';

// HTML escape helper to prevent injection
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class InterviewConflictNotifier {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Send conflict alert emails to all affected parties
   */
  async sendConflictAlerts(
    conflicts: CalendarConflict[],
    interviewDetails: {
      candidateId: string;
      interviewerId: string;
      scheduledDate: Date;
      duration: number;
      type: string;
      location?: string;
      meetingLink?: string;
    },
    forcedSchedule: boolean = false,
    scheduledByUserEmail?: string // Email of user who scheduled the interview (for impersonation)
  ): Promise<void> {
    try {
      // Get candidate and interviewer details
      const candidate = await this.storage.getCandidateById(interviewDetails.candidateId);
      const interviewer = await this.storage.getUserById(interviewDetails.interviewerId);

      if (!candidate || !interviewer) {
        console.error('[ConflictNotifier] Missing candidate or interviewer data');
        return;
      }

      // Format the conflicts for email
      const conflictSummary = this.formatConflictsForEmail(conflicts);
      const scheduledTime = format(interviewDetails.scheduledDate, 'EEEE, MMMM d, yyyy \'at\' h:mm a');

      // Send email to interviewer
      if (interviewer.email) {
        await this.sendInterviewerAlert(
          interviewer,
          candidate,
          scheduledTime,
          conflictSummary,
          forcedSchedule,
          scheduledByUserEmail
        );
      }

      // Send email to HR/Admin
      await this.sendAdminAlert(
        interviewer,
        candidate,
        scheduledTime,
        conflictSummary,
        forcedSchedule,
        scheduledByUserEmail
      );

      // If candidate has conflicts and was forced, notify them
      if (forcedSchedule && candidate.email) {
        const candidateConflicts = conflicts.filter(c =>
          c.attendees?.includes(candidate.email!)
        );

        if (candidateConflicts.length > 0) {
          await this.sendCandidateAlert(
            candidate,
            interviewer,
            scheduledTime,
            this.formatConflictsForEmail(candidateConflicts),
            scheduledByUserEmail
          );
        }
      }

      console.log('[ConflictNotifier] Conflict alerts sent successfully');
    } catch (error) {
      console.error('[ConflictNotifier] Failed to send conflict alerts:', error);
    }
  }

  /**
   * Send alert to interviewer about conflicts
   */
  private async sendInterviewerAlert(
    interviewer: any,
    candidate: any,
    scheduledTime: string,
    conflictSummary: string,
    forcedSchedule: boolean,
    fromUserEmail?: string
  ): Promise<void> {
    const subject = forcedSchedule 
      ? `⚠️ Interview Scheduled Despite Conflicts - ${candidate.firstName} ${candidate.lastName}`
      : `⚠️ Interview Conflict Alert - ${candidate.firstName} ${candidate.lastName}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ff6b6b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Interview Scheduling Alert</h2>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p><strong>Dear ${interviewer.firstName},</strong></p>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>⚠️ Calendar conflicts were detected for the following interview:</strong></p>
          </div>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Interview Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Candidate:</strong> ${escapeHtml(candidate.firstName)} ${escapeHtml(candidate.lastName)}</li>
              <li><strong>Position:</strong> ${escapeHtml(candidate.position)}</li>
              <li><strong>Scheduled Time:</strong> ${escapeHtml(scheduledTime)}</li>
              <li><strong>Status:</strong> ${forcedSchedule ? '✅ Scheduled despite conflicts' : '⚠️ Requires attention'}</li>
            </ul>
          </div>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Detected Conflicts:</h3>
            ${conflictSummary}
          </div>
          
          ${forcedSchedule ? `
            <div style="background-color: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>✅ The interview has been scheduled as requested.</strong></p>
              <p style="margin: 10px 0 0 0;">Please review the conflicts above and make any necessary adjustments to your schedule.</p>
            </div>
          ` : `
            <div style="background-color: #f8d7da; border: 1px solid #dc3545; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Action Required:</strong> Please review these conflicts and either:</p>
              <ul>
                <li>Choose an alternative time slot</li>
                <li>Confirm if you want to proceed despite the conflicts</li>
              </ul>
            </div>
          `}
          
          <p style="margin-top: 20px;">
            <a href="${process.env.APP_URL || 'https://Roof-HR.replit.app'}/recruiting" 
               style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              View in HR System
            </a>
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 12px;">
            This is an automated notification from the ROOF-ER HR System. 
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    await emailService.sendEmail({
      to: interviewer.email,
      subject,
      html: emailHtml,
      fromUserEmail,
    });
  }

  /**
   * Send alert to candidate about scheduling conflicts
   */
  private async sendCandidateAlert(
    candidate: any,
    interviewer: any,
    scheduledTime: string,
    conflictSummary: string,
    fromUserEmail?: string
  ): Promise<void> {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Interview Scheduling Update</h2>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p><strong>Dear ${escapeHtml(candidate.firstName)},</strong></p>
          
          <p>We wanted to inform you that your interview has been scheduled, though we noticed some potential conflicts with your calendar:</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Interview Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Position:</strong> ${escapeHtml(candidate.position)}</li>
              <li><strong>Interviewer:</strong> ${escapeHtml(interviewer.firstName)} ${escapeHtml(interviewer.lastName)}</li>
              <li><strong>Scheduled Time:</strong> ${escapeHtml(scheduledTime)}</li>
            </ul>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Please Note:</strong> The following calendar conflicts were detected:</p>
            ${conflictSummary}
          </div>
          
          <p>If this time doesn't work for you, please contact us immediately at hr@theroofdocs.com or reply to this email so we can reschedule.</p>
          
          <p>We look forward to meeting with you!</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666;">
            Best regards,<br>
            ROOF-ER HR Team
          </p>
        </div>
      </div>
    `;

    await emailService.sendEmail({
      to: candidate.email,
      subject: `Interview Scheduled - Please Review Time Conflicts`,
      html: emailHtml,
      candidateId: candidate.id,
      fromUserEmail,
    });
  }

  /**
   * Send alert to HR/Admin about conflicts
   */
  private async sendAdminAlert(
    interviewer: any,
    candidate: any,
    scheduledTime: string,
    conflictSummary: string,
    forcedSchedule: boolean,
    fromUserEmail?: string
  ): Promise<void> {
    // Get all admin users
    const allUsers = await this.storage.getAllUsers();
    const admins = allUsers.filter(u => u.role === 'ADMIN' && u.email);

    if (admins.length === 0) return;

    const subject = `[HR Alert] Interview Conflict Detected - ${candidate.firstName} ${candidate.lastName}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">HR System Alert: Interview Scheduling Conflict</h2>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Interview Information:</h3>
            <ul>
              <li><strong>Candidate:</strong> ${escapeHtml(candidate.firstName)} ${escapeHtml(candidate.lastName)} (${escapeHtml(candidate.position)})</li>
              <li><strong>Interviewer:</strong> ${escapeHtml(interviewer.firstName)} ${escapeHtml(interviewer.lastName)}</li>
              <li><strong>Scheduled Time:</strong> ${escapeHtml(scheduledTime)}</li>
              <li><strong>Status:</strong> ${forcedSchedule ? 'Scheduled with conflicts' : 'Pending resolution'}</li>
            </ul>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Conflicts Detected:</h3>
            ${conflictSummary}
          </div>
          
          ${forcedSchedule ? `
            <p><strong>Note:</strong> The interview was scheduled despite these conflicts. 
            Please monitor for any issues or cancellations.</p>
          ` : `
            <p><strong>Action Required:</strong> Please review and help resolve these scheduling conflicts.</p>
          `}
          
          <p style="margin-top: 20px;">
            <a href="${process.env.APP_URL || 'https://Roof-HR.replit.app'}/recruiting" 
               style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">
              View in HR System
            </a>
          </p>
        </div>
      </div>
    `;

    // Send to all admins
    for (const admin of admins) {
      if (admin.email) {
        await emailService.sendEmail({
          to: admin.email,
          subject,
          html: emailHtml,
          fromUserEmail,
        });
      }
    }
  }

  /**
   * Format conflicts into HTML for email
   */
  private formatConflictsForEmail(conflicts: CalendarConflict[]): string {
    if (conflicts.length === 0) {
      return '<p>No conflicts detected.</p>';
    }

    const hardConflicts = conflicts.filter(c => c.severity === 'hard');
    const softConflicts = conflicts.filter(c => c.severity === 'soft');

    let html = '<ul>';

    if (hardConflicts.length > 0) {
      html += '<li><strong style="color: #dc3545;">Hard Conflicts (Must Resolve):</strong><ul>';
      for (const conflict of hardConflicts) {
        const timeRange = `${format(conflict.start, 'h:mm a')} - ${format(conflict.end, 'h:mm a')}`;
        html += `<li>${escapeHtml(conflict.type)}: ${escapeHtml(conflict.title)} (${escapeHtml(timeRange)})</li>`;
      }
      html += '</ul></li>';
    }

    if (softConflicts.length > 0) {
      html += '<li><strong style="color: #ffc107;">Soft Conflicts (Warnings):</strong><ul>';
      for (const conflict of softConflicts) {
        const timeRange = `${format(conflict.start, 'h:mm a')} - ${format(conflict.end, 'h:mm a')}`;
        html += `<li>${escapeHtml(conflict.type)}: ${escapeHtml(conflict.title)} (${escapeHtml(timeRange)})</li>`;
      }
      html += '</ul></li>';
    }

    html += '</ul>';
    return html;
  }

  /**
   * Send reminder about upcoming interview with conflicts
   */
  async sendConflictReminder(
    interviewId: string,
    hoursBeforeInterview: number = 24
  ): Promise<void> {
    try {
      const interview = await this.storage.getInterviewById(interviewId);
      if (!interview || interview.status !== 'SCHEDULED') return;

      const candidate = await this.storage.getCandidateById(interview.candidateId);
      const interviewer = await this.storage.getUserById(interview.interviewerId);

      if (!candidate || !interviewer) return;

      const scheduledTime = format(new Date(interview.scheduledDate), 'EEEE, MMMM d, yyyy \'at\' h:mm a');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ffc107; color: #333; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Interview Reminder - Potential Conflicts</h2>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <p>This is a reminder that an interview is scheduled for <strong>${scheduledTime}</strong></p>
            
            <p><strong>Note:</strong> This interview was scheduled with known calendar conflicts. 
            Please ensure all parties are still available.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <ul style="list-style: none; padding: 0;">
                <li><strong>Candidate:</strong> ${escapeHtml(candidate.firstName)} ${escapeHtml(candidate.lastName)}</li>
                <li><strong>Position:</strong> ${escapeHtml(candidate.position)}</li>
                <li><strong>Interviewer:</strong> ${escapeHtml(interviewer.firstName)} ${escapeHtml(interviewer.lastName)}</li>
              </ul>
            </div>
            
            <p>If you need to reschedule, please do so as soon as possible.</p>
          </div>
        </div>
      `;

      // Send reminder to interviewer
      if (interviewer.email) {
        await emailService.sendEmail({
          to: interviewer.email,
          subject: `⚠️ Interview Reminder (${hoursBeforeInterview}h) - Potential Conflicts`,
          html: emailHtml,
        });
      }

      console.log(`[ConflictNotifier] Sent conflict reminder for interview ${interviewId}`);
    } catch (error) {
      console.error('[ConflictNotifier] Failed to send conflict reminder:', error);
    }
  }
}

// Export singleton instance
let conflictNotifier: InterviewConflictNotifier | null = null;

export function getConflictNotifier(storage: IStorage): InterviewConflictNotifier {
  if (!conflictNotifier) {
    conflictNotifier = new InterviewConflictNotifier(storage);
  }
  return conflictNotifier;
}