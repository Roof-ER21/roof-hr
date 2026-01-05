import { db } from '../db';
import { interviews, candidates, users } from '@shared/schema';
import { gmailService } from '../services/gmail-service';
import { logger } from '../middleware/logger';
import { eq, and, lt } from 'drizzle-orm';
import { differenceInDays } from 'date-fns';

let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;

interface OverdueJobResult {
  feedbackRemindersSent: number;
  escalationsSent: number;
  autoMarkedNoShow: number;
  errors: number;
}

/**
 * Check for overdue interviews and take appropriate action:
 * - Day 1+: Send reminder emails to interviewers requesting feedback
 * - Day 3+: Escalate notification to management
 * - Day 7+: Auto-mark as NO_SHOW and update candidate status to DEAD_BY_CANDIDATE
 *
 * This job runs daily to check for overdue interviews
 */
export async function checkOverdueInterviews(): Promise<OverdueJobResult> {
  if (isRunning) {
    logger.warn('[Interview Overdue Job] Already running, skipping...');
    return { feedbackRemindersSent: 0, escalationsSent: 0, autoMarkedNoShow: 0, errors: 0 };
  }

  isRunning = true;
  let feedbackRemindersSent = 0;
  let escalationsSent = 0;
  let autoMarkedNoShow = 0;
  let errors = 0;

  try {
    logger.info('[Interview Overdue Job] Starting check...');

    const now = new Date();

    // Find all interviews that are scheduled but past their scheduled date
    const overdueInterviews = await db
      .select({
        interview: interviews,
        candidate: candidates,
        interviewer: users,
      })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(users, eq(interviews.interviewerId, users.id))
      .where(
        and(
          eq(interviews.status, 'SCHEDULED'),
          lt(interviews.scheduledDate, now)
        )
      );

    logger.info(`[Interview Overdue Job] Found ${overdueInterviews.length} overdue interviews`);

    // Initialize Gmail service
    await gmailService.initialize();

    for (const record of overdueInterviews) {
      try {
        const interview = record.interview;
        const candidate = record.candidate;
        const interviewer = record.interviewer;

        if (!interview || !candidate) {
          logger.warn(`[Interview Overdue Job] Missing interview or candidate data, skipping`);
          continue;
        }

        const daysOverdue = differenceInDays(now, interview.scheduledDate);
        const candidateName = `${candidate.firstName} ${candidate.lastName}`;
        const interviewerName = interviewer
          ? `${interviewer.firstName} ${interviewer.lastName}`
          : interview.customInterviewerName || 'Unknown Interviewer';
        const interviewerEmail = interviewer?.email;

        logger.info(
          `[Interview Overdue Job] Processing: ${candidateName} - ${daysOverdue} days overdue`
        );

        // ========================================
        // DAY 7+: AUTO-MARK AS NO_SHOW
        // ========================================
        if (daysOverdue >= 7) {
          logger.info(
            `[Interview Overdue Job] 7+ days overdue - auto-marking as NO_SHOW: ${candidateName}`
          );

          // Update interview status to NO_SHOW
          await db
            .update(interviews)
            .set({
              status: 'NO_SHOW',
              updatedAt: now,
            })
            .where(eq(interviews.id, interview.id));

          // Update candidate status to DEAD_BY_CANDIDATE
          await db
            .update(candidates)
            .set({
              status: 'DEAD_BY_CANDIDATE',
            })
            .where(eq(candidates.id, candidate.id));

          // Send notification to HR and interviewer
          await gmailService.sendEmail({
            to: 'careers@theroofdocs.com',
            cc: interviewerEmail ? [interviewerEmail, 'support@theroofdocs.com'] : ['support@theroofdocs.com'],
            subject: `Interview Auto-Closed: ${candidateName} - No Feedback After 7 Days`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Interview Automatically Closed</h2>
                <p>The following interview has been <strong>automatically marked as NO_SHOW</strong> due to no feedback after 7 days:</p>

                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Candidate:</strong> ${candidateName}</p>
                  <p><strong>Position:</strong> ${candidate.position}</p>
                  <p><strong>Interviewer:</strong> ${interviewerName}</p>
                  <p><strong>Scheduled Date:</strong> ${interview.scheduledDate.toLocaleDateString()}</p>
                  <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
                  <p><strong>Interview Type:</strong> ${interview.type}</p>
                </div>

                <p><strong>Actions Taken:</strong></p>
                <ul>
                  <li>Interview status changed to: <strong>NO_SHOW</strong></li>
                  <li>Candidate status changed to: <strong>DEAD_BY_CANDIDATE</strong></li>
                </ul>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  If this was completed and feedback was not recorded, please update the system manually.
                </p>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  This is an automated message from the Roof-ER HR system.
                </p>
              </div>
            `,
          });

          autoMarkedNoShow++;
          logger.info(
            `[Interview Overdue Job] Auto-marked as NO_SHOW and notified: ${candidateName}`
          );
          continue; // Skip other checks for this interview
        }

        // ========================================
        // DAY 3+: ESCALATION NOTIFICATION
        // ========================================
        if (daysOverdue >= 3) {
          logger.info(
            `[Interview Overdue Job] 3+ days overdue - sending escalation: ${candidateName}`
          );

          await gmailService.sendEmail({
            to: 'careers@theroofdocs.com',
            cc: interviewerEmail ? [interviewerEmail, 'support@theroofdocs.com', 'info@theroofdocs.com'] : ['support@theroofdocs.com', 'info@theroofdocs.com'],
            subject: `URGENT: Interview Feedback Overdue - ${candidateName} (${daysOverdue} Days)`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">URGENT: Interview Feedback Overdue</h2>
                <p>This is an <strong>escalation notice</strong>. The following interview is <strong>${daysOverdue} days overdue</strong> for feedback:</p>

                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                  <p><strong>Candidate:</strong> ${candidateName}</p>
                  <p><strong>Email:</strong> ${candidate.email}</p>
                  <p><strong>Phone:</strong> ${candidate.phone}</p>
                  <p><strong>Position:</strong> ${candidate.position}</p>
                  <p><strong>Interviewer:</strong> ${interviewerName}</p>
                  <p><strong>Scheduled Date:</strong> ${interview.scheduledDate.toLocaleDateString()}</p>
                  <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
                  <p><strong>Interview Type:</strong> ${interview.type}</p>
                  ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
                  ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> ${interview.meetingLink}</p>` : ''}
                </div>

                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                  <p><strong>⚠️ WARNING:</strong> If feedback is not provided within <strong>4 more days</strong>, the system will:</p>
                  <ul>
                    <li>Automatically mark the interview as <strong>NO_SHOW</strong></li>
                    <li>Change candidate status to <strong>DEAD_BY_CANDIDATE</strong></li>
                  </ul>
                </div>

                <p><strong>Required Action:</strong></p>
                <ul>
                  <li>Contact the interviewer immediately</li>
                  <li>Collect and record interview feedback</li>
                  <li>Update interview status in the system</li>
                  <li>If interview was cancelled or no-show, update accordingly</li>
                </ul>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  This is an automated escalation from the Roof-ER HR system.
                </p>
              </div>
            `,
          });

          escalationsSent++;
          logger.info(`[Interview Overdue Job] Escalation sent for: ${candidateName}`);
          continue; // Skip reminder since we sent escalation
        }

        // ========================================
        // DAY 1+: FEEDBACK REMINDER
        // ========================================
        if (daysOverdue >= 1 && interviewerEmail) {
          logger.info(
            `[Interview Overdue Job] 1+ days overdue - sending reminder: ${candidateName}`
          );

          await gmailService.sendEmail({
            to: interviewerEmail,
            cc: ['careers@theroofdocs.com'],
            subject: `Interview Feedback Needed: ${candidateName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Interview Feedback Reminder</h2>
                <p>Hi ${interviewerName},</p>

                <p>This is a friendly reminder that feedback is needed for the following interview:</p>

                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Candidate:</strong> ${candidateName}</p>
                  <p><strong>Email:</strong> ${candidate.email}</p>
                  <p><strong>Phone:</strong> ${candidate.phone}</p>
                  <p><strong>Position:</strong> ${candidate.position}</p>
                  <p><strong>Interview Date:</strong> ${interview.scheduledDate.toLocaleDateString()}</p>
                  <p><strong>Interview Type:</strong> ${interview.type}</p>
                  ${interview.location ? `<p><strong>Location:</strong> ${interview.location}</p>` : ''}
                  ${interview.meetingLink ? `<p><strong>Meeting Link:</strong> ${interview.meetingLink}</p>` : ''}
                </div>

                <p>Please take a moment to:</p>
                <ul>
                  <li>Provide your feedback and rating in the HR system</li>
                  <li>Update the interview status (Completed, No-Show, etc.)</li>
                  <li>Add any relevant notes about the candidate</li>
                </ul>

                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  If this interview did not take place or was rescheduled, please update the status accordingly.
                </p>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  This is an automated reminder from the Roof-ER HR system.
                </p>
              </div>
            `,
          });

          feedbackRemindersSent++;
          logger.info(`[Interview Overdue Job] Feedback reminder sent to: ${interviewerEmail}`);
        }

      } catch (error) {
        errors++;
        logger.error(
          `[Interview Overdue Job] Error processing interview ${record.interview?.id}:`,
          error
        );
      }
    }

    logger.info(
      `[Interview Overdue Job] Complete. Reminders: ${feedbackRemindersSent}, Escalations: ${escalationsSent}, Auto NO_SHOW: ${autoMarkedNoShow}, Errors: ${errors}`
    );
    return { feedbackRemindersSent, escalationsSent, autoMarkedNoShow, errors };
  } catch (error) {
    logger.error('[Interview Overdue Job] Fatal error:', error);
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the interview overdue job scheduler
 * Runs daily at 10 AM local time
 */
export function startInterviewOverdueJob(): void {
  if (jobInterval) {
    logger.warn('[Interview Overdue Job] Job already started');
    return;
  }

  logger.info('[Interview Overdue Job] Starting scheduler...');

  // Check every hour if it's time to run (at 10 AM)
  jobInterval = setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();

    // Run at 10:00 AM (within the first 5 minutes of the hour)
    if (hour === 10 && minutes < 5) {
      try {
        await checkOverdueInterviews();
      } catch (error) {
        logger.error('[Interview Overdue Job] Scheduled run failed:', error);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  logger.info('[Interview Overdue Job] Scheduler started, will run daily at 10 AM');
}

/**
 * Stop the interview overdue job scheduler
 */
export function stopInterviewOverdueJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    logger.info('[Interview Overdue Job] Scheduler stopped');
  }
}
