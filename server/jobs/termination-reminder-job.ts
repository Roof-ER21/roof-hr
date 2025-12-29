import { storage } from '../storage';
import { EmailService } from '../email-service';
import { logger } from '../middleware/logger';

let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;

interface ReminderJobResult {
  weekRemindersSent: number;
  fifteenDayAlertsSent: number;
  thirtyDayRemindersSent: number;
  errors: number;
}

/**
 * Check termination reminders and send alerts at various intervals:
 * - 7 days: If no equipment return has been scheduled
 * - 15 days: If equipment hasn't been returned (existing)
 * - 30 days: If no signed return form received
 *
 * This job runs daily to check for terminated employees
 */
export async function checkTerminationReminders(): Promise<ReminderJobResult> {
  if (isRunning) {
    logger.warn('[Termination Reminder Job] Already running, skipping...');
    return { weekRemindersSent: 0, fifteenDayAlertsSent: 0, thirtyDayRemindersSent: 0, errors: 0 };
  }

  isRunning = true;
  let weekRemindersSent = 0;
  let fifteenDayAlertsSent = 0;
  let thirtyDayRemindersSent = 0;
  let errors = 0;

  try {
    logger.info('[Termination Reminder Job] Starting check...');

    const reminders = await storage.getPendingTerminationReminders();
    logger.info(`[Termination Reminder Job] Found ${reminders.length} pending reminders`);

    const emailService = new EmailService();
    await emailService.initialize();

    for (const reminder of reminders) {
      try {
        const daysSinceTermination = Math.floor(
          (new Date().getTime() - new Date(reminder.terminationDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Get the associated equipment checklist to check scheduling status
        let equipmentChecklist = null;
        if (reminder.equipmentChecklistId) {
          equipmentChecklist = await storage.getEquipmentChecklistById(reminder.equipmentChecklistId);
        }

        // ========================================
        // 7-DAY REMINDER: No scheduling yet
        // ========================================
        if (daysSinceTermination >= 7 && !reminder.weekReminderSentAt) {
          // Check if equipment return has been scheduled
          const hasScheduled = equipmentChecklist?.scheduledDate || equipmentChecklist?.scheduledTime;

          if (!hasScheduled) {
            logger.info(`[Termination Reminder Job] Sending 7-day reminder for ${reminder.employeeName}`);

            // Use the proper email service method for 7-day reminders
            await emailService.sendWeekNoScheduleReminderEmail(
              reminder.employeeName,
              reminder.employeeEmail || '',
              new Date(reminder.terminationDate)
            );

            await storage.updateTerminationReminder(reminder.id, {
              weekReminderSentAt: new Date(),
            });

            weekRemindersSent++;
            logger.info(`[Termination Reminder Job] 7-day reminder sent for ${reminder.employeeName}`);
          }
        }

        // ========================================
        // 15-DAY ALERT: Equipment not returned (existing)
        // ========================================
        if (daysSinceTermination >= 15 && !reminder.alertSentAt) {
          logger.info(`[Termination Reminder Job] Sending 15-day alert for ${reminder.employeeName}`);

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
            fromUserEmail: process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com'
          });

          await storage.updateTerminationReminder(reminder.id, {
            alertSentAt: new Date(),
          });

          fifteenDayAlertsSent++;
          logger.info(`[Termination Reminder Job] 15-day alert sent for ${reminder.employeeName}`);
        }

        // ========================================
        // 30-DAY REMINDER: No signed return form
        // ========================================
        if (daysSinceTermination >= 30 && !reminder.thirtyDayReminderSentAt) {
          // Check if return form has been signed
          const hasSignedReturnForm = equipmentChecklist?.signedAt || equipmentChecklist?.status === 'SIGNED';

          if (!hasSignedReturnForm) {
            logger.info(`[Termination Reminder Job] Sending 30-day URGENT reminder for ${reminder.employeeName}`);

            // Use the proper email service method for 30-day URGENT reminders
            await emailService.sendThirtyDayReminderEmail(
              reminder.employeeName,
              reminder.employeeEmail || '',
              new Date(reminder.terminationDate)
            );

            await storage.updateTerminationReminder(reminder.id, {
              thirtyDayReminderSentAt: new Date(),
            });

            thirtyDayRemindersSent++;
            logger.info(`[Termination Reminder Job] 30-day URGENT reminder sent for ${reminder.employeeName}`);
          }
        }

      } catch (error) {
        errors++;
        logger.error(`[Termination Reminder Job] Error processing reminder for ${reminder.employeeName}:`, error);
      }
    }

    logger.info(`[Termination Reminder Job] Complete. 7-day: ${weekRemindersSent}, 15-day: ${fifteenDayAlertsSent}, 30-day: ${thirtyDayRemindersSent}, Errors: ${errors}`);
    return { weekRemindersSent, fifteenDayAlertsSent, thirtyDayRemindersSent, errors };
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
