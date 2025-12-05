import { storage } from '../storage';
import { EmailService } from '../email-service';
import { logger } from '../middleware/logger';

let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;

/**
 * Check termination reminders and send 15-day alerts
 * This job runs daily to check for terminated employees whose equipment hasn't been returned
 */
export async function checkTerminationReminders(): Promise<{ alertsSent: number; errors: number }> {
  if (isRunning) {
    logger.warn('[Termination Reminder Job] Already running, skipping...');
    return { alertsSent: 0, errors: 0 };
  }

  isRunning = true;
  let alertsSent = 0;
  let errors = 0;

  try {
    logger.info('[Termination Reminder Job] Starting check...');

    const reminders = await storage.getPendingTerminationReminders();
    logger.info(`[Termination Reminder Job] Found ${reminders.length} pending reminders`);

    for (const reminder of reminders) {
      try {
        const daysSinceTermination = Math.floor(
          (new Date().getTime() - new Date(reminder.terminationDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if 15 days passed and alert not already sent
        if (daysSinceTermination >= 15 && !reminder.alertSentAt) {
          logger.info(`[Termination Reminder Job] Sending 15-day alert for ${reminder.employeeName}`);

          const emailService = new EmailService();
          await emailService.initialize();

          // Send alert to HR team
          await emailService.sendEmail({
            to: 'careers@theroofdocs.com',
            cc: ['support@theroofdocs.com', 'info@theroofdocs.com'],
            subject: `Equipment Return Follow-up Required: ${reminder.employeeName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Equipment Return Alert</h2>
                <p><strong>15 days have passed</strong> since <strong>${reminder.employeeName}</strong> was terminated.</p>
                <p>Equipment has <strong>NOT</strong> been marked as returned.</p>
                <p><strong>Termination Date:</strong> ${new Date(reminder.terminationDate).toLocaleDateString()}</p>
                <p><strong>Days Since Termination:</strong> ${daysSinceTermination}</p>
                <hr style="border: 1px solid #ddd; margin: 20px 0;">
                <p>Please review and take appropriate action:</p>
                <ul>
                  <li>Contact the employee to retrieve company belongings</li>
                  <li>Update the system when items are returned</li>
                  <li>Initiate deduction process if items are not returned</li>
                </ul>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  This is an automated message from the Roof-ER HR system.
                </p>
              </div>
            `,
          });

          // Update reminder to mark alert as sent
          await storage.updateTerminationReminder(reminder.id, {
            alertSentAt: new Date(),
          });

          alertsSent++;
          logger.info(`[Termination Reminder Job] Alert sent for ${reminder.employeeName}`);
        }
      } catch (error) {
        errors++;
        logger.error(`[Termination Reminder Job] Error processing reminder for ${reminder.employeeName}:`, error);
      }
    }

    logger.info(`[Termination Reminder Job] Complete. Alerts sent: ${alertsSent}, Errors: ${errors}`);
    return { alertsSent, errors };
  } catch (error) {
    logger.error('[Termination Reminder Job] Fatal error:', error);
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the termination reminder job scheduler
 * Runs daily at 9 AM local time
 */
export function startTerminationReminderJob(): void {
  if (jobInterval) {
    logger.warn('[Termination Reminder Job] Job already started');
    return;
  }

  logger.info('[Termination Reminder Job] Starting scheduler...');

  // Check every hour if it's time to run (at 9 AM)
  jobInterval = setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();

    // Run at 9:00 AM (within the first 5 minutes of the hour)
    if (hour === 9 && minutes < 5) {
      try {
        await checkTerminationReminders();
      } catch (error) {
        logger.error('[Termination Reminder Job] Scheduled run failed:', error);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  logger.info('[Termination Reminder Job] Scheduler started, will run daily at 9 AM');
}

/**
 * Stop the termination reminder job scheduler
 */
export function stopTerminationReminderJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    logger.info('[Termination Reminder Job] Scheduler stopped');
  }
}
