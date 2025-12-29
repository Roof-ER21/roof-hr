import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { ptoRequests, users } from '../../shared/schema';
import { EmailService } from '../email-service';
import { PTO_REMINDER_RECIPIENTS } from '../../shared/constants/roles';

let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;

interface PTOReminderResult {
  weekRemindersSent: number;
  monthRemindersSent: number;
  errors: number;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Add days to a date and return YYYY-MM-DD string
 */
function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
}

/**
 * Check for upcoming PTO and send reminder emails to managers
 * - 7 days before: Send "1 week away" reminder
 * - 30 days before: Send "1 month away" reminder
 *
 * Runs daily at 9 PM EST
 */
export async function checkPTOReminders(): Promise<PTOReminderResult> {
  if (isRunning) {
    console.log('[PTO Reminder Job] Already running, skipping...');
    return { weekRemindersSent: 0, monthRemindersSent: 0, errors: 0 };
  }

  isRunning = true;
  let weekRemindersSent = 0;
  let monthRemindersSent = 0;
  let errors = 0;

  try {
    console.log('[PTO Reminder Job] Starting check...');

    const today = new Date();
    const oneWeekFromNow = addDays(today, 7);
    const oneMonthFromNow = addDays(today, 30);

    // Find approved PTO starting in exactly 7 days
    const weekAwayPTO = await db.select({
      id: ptoRequests.id,
      startDate: ptoRequests.startDate,
      endDate: ptoRequests.endDate,
      days: ptoRequests.days,
      type: ptoRequests.type,
      reason: ptoRequests.reason,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      department: users.department,
    })
    .from(ptoRequests)
    .innerJoin(users, eq(users.id, ptoRequests.employeeId))
    .where(and(
      eq(ptoRequests.status, 'APPROVED'),
      eq(ptoRequests.startDate, oneWeekFromNow)
    ));

    // Find approved PTO starting in exactly 30 days
    const monthAwayPTO = await db.select({
      id: ptoRequests.id,
      startDate: ptoRequests.startDate,
      endDate: ptoRequests.endDate,
      days: ptoRequests.days,
      type: ptoRequests.type,
      reason: ptoRequests.reason,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      department: users.department,
    })
    .from(ptoRequests)
    .innerJoin(users, eq(users.id, ptoRequests.employeeId))
    .where(and(
      eq(ptoRequests.status, 'APPROVED'),
      eq(ptoRequests.startDate, oneMonthFromNow)
    ));

    console.log(`[PTO Reminder Job] Found ${weekAwayPTO.length} PTO requests starting in 1 week`);
    console.log(`[PTO Reminder Job] Found ${monthAwayPTO.length} PTO requests starting in 1 month`);

    const emailService = new EmailService();
    await emailService.initialize();

    // Send 1 week reminders
    for (const pto of weekAwayPTO) {
      try {
        for (const recipientEmail of PTO_REMINDER_RECIPIENTS) {
          await emailService.sendEmail({
            to: recipientEmail,
            subject: `PTO Reminder: ${pto.firstName} ${pto.lastName} - 1 Week Away`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">⏰ PTO Reminder - 1 Week Away</h2>
                <p><strong>${pto.firstName} ${pto.lastName}</strong> (${pto.department || 'No Department'}) has approved PTO starting in <strong>1 week</strong>.</p>
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Start Date:</strong> ${formatDate(pto.startDate)}</p>
                  <p style="margin: 5px 0;"><strong>End Date:</strong> ${formatDate(pto.endDate)}</p>
                  <p style="margin: 5px 0;"><strong>Days:</strong> ${pto.days}</p>
                  <p style="margin: 5px 0;"><strong>Type:</strong> ${pto.type}</p>
                  <p style="margin: 5px 0;"><strong>Reason:</strong> ${pto.reason || 'Not specified'}</p>
                </div>
                <p style="color: #666;">Please ensure appropriate coverage is arranged.</p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  This is an automated reminder from the Roof HR system.
                </p>
              </div>
            `,
            fromUserEmail: process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com'
          });
        }
        weekRemindersSent++;
        console.log(`[PTO Reminder Job] 1-week reminder sent for ${pto.firstName} ${pto.lastName}`);
      } catch (error) {
        errors++;
        console.error(`[PTO Reminder Job] Error sending 1-week reminder for ${pto.firstName} ${pto.lastName}:`, error);
      }
    }

    // Send 1 month reminders
    for (const pto of monthAwayPTO) {
      try {
        for (const recipientEmail of PTO_REMINDER_RECIPIENTS) {
          await emailService.sendEmail({
            to: recipientEmail,
            subject: `PTO Notice: ${pto.firstName} ${pto.lastName} - 1 Month Away`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #3b82f6;">📅 PTO Notice - 1 Month Away</h2>
                <p><strong>${pto.firstName} ${pto.lastName}</strong> (${pto.department || 'No Department'}) has approved PTO starting in <strong>1 month</strong>.</p>
                <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Start Date:</strong> ${formatDate(pto.startDate)}</p>
                  <p style="margin: 5px 0;"><strong>End Date:</strong> ${formatDate(pto.endDate)}</p>
                  <p style="margin: 5px 0;"><strong>Days:</strong> ${pto.days}</p>
                  <p style="margin: 5px 0;"><strong>Type:</strong> ${pto.type}</p>
                  <p style="margin: 5px 0;"><strong>Reason:</strong> ${pto.reason || 'Not specified'}</p>
                </div>
                <p style="color: #666;">This is an advance notice to help with planning.</p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  This is an automated notice from the Roof HR system.
                </p>
              </div>
            `,
            fromUserEmail: process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com'
          });
        }
        monthRemindersSent++;
        console.log(`[PTO Reminder Job] 1-month reminder sent for ${pto.firstName} ${pto.lastName}`);
      } catch (error) {
        errors++;
        console.error(`[PTO Reminder Job] Error sending 1-month reminder for ${pto.firstName} ${pto.lastName}:`, error);
      }
    }

    console.log(`[PTO Reminder Job] Complete. 1-week: ${weekRemindersSent}, 1-month: ${monthRemindersSent}, Errors: ${errors}`);
    return { weekRemindersSent, monthRemindersSent, errors };
  } catch (error) {
    console.error('[PTO Reminder Job] Fatal error:', error);
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the PTO reminder job scheduler
 * Runs daily at 9 PM EST (21:00)
 */
export function startPTOReminderJob(): void {
  if (jobInterval) {
    console.log('[PTO Reminder Job] Job already started');
    return;
  }

  console.log('[PTO Reminder Job] Starting scheduler...');

  // Check every 5 minutes if it's time to run
  jobInterval = setInterval(async () => {
    const now = new Date();
    // Convert to EST (UTC-5, or UTC-4 during DST)
    const estOffset = -5; // Standard EST
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const estTime = new Date(utc + (3600000 * estOffset));

    const hour = estTime.getHours();
    const minutes = estTime.getMinutes();

    // Run at 9:00 PM EST (21:00) within the first 5 minutes
    if (hour === 21 && minutes < 5) {
      try {
        console.log('[PTO Reminder Job] Running scheduled check at 9 PM EST...');
        await checkPTOReminders();
      } catch (error) {
        console.error('[PTO Reminder Job] Scheduled run failed:', error);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  console.log('[PTO Reminder Job] Scheduler started, will run daily at 9 PM EST');
}

/**
 * Stop the PTO reminder job scheduler
 */
export function stopPTOReminderJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[PTO Reminder Job] Scheduler stopped');
  }
}
