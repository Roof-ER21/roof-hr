import { db } from '../db';
import { eq, and, inArray, gte } from 'drizzle-orm';
import { ptoRequests, users, userEmailPreferences } from '../../shared/schema';
import { EmailService } from '../email-service';
import { MANAGER_ROLES } from '../../shared/constants/roles';
import { getPtoReminderRecipients, getPtoDailyDigestRecipients } from '../services/authzService';
import { isNotificationEnabled } from '../services/notification-preferences';

let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;
let digestRunning = false;
let lastDigestDateET: string | null = null;

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
 * Current date/time in Eastern Time (DST-aware, unlike the fixed EST offset above)
 */
function getEasternNow(): { dateStr: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    hour: parseInt(get('hour'), 10) % 24,
    minute: parseInt(get('minute'), 10),
  };
}

/**
 * Next business day (Mon-Fri) strictly after a YYYY-MM-DD date
 */
function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().split('T')[0];
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

    const departmentManagerRoles = Array.from(new Set([...MANAGER_ROLES, 'TEAM_LEAD']));
    const departmentManagers = await db.select({
      email: users.email,
      department: users.department,
    })
      .from(users)
      .where(and(eq(users.isActive, true), inArray(users.role, departmentManagerRoles)));

    const managersByDepartment = new Map<string, Set<string>>();
    for (const manager of departmentManagers) {
      if (!manager.department) continue;
      const key = manager.department.trim().toLowerCase();
      if (!key) continue;
      if (!managersByDepartment.has(key)) {
        managersByDepartment.set(key, new Set<string>());
      }
      managersByDepartment.get(key)?.add(manager.email.toLowerCase());
    }

    // Build email→userId map for preference checks
    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    const emailToUserId = new Map(allUsers.map(u => [u.email.toLowerCase(), u.id]));

    const getRecipientsForDepartment = (department?: string, employeeEmail?: string): string[] => {
      const recipients = new Set(getPtoReminderRecipients().map((email) => email.toLowerCase()));
      const key = department?.trim().toLowerCase();
      if (key && managersByDepartment.has(key)) {
        for (const email of managersByDepartment.get(key) || []) {
          recipients.add(email);
        }
      }
      if (employeeEmail) {
        recipients.delete(employeeEmail.toLowerCase());
      }
      return Array.from(recipients);
    };

    // Send 1 week reminders
    for (const pto of weekAwayPTO) {
      try {
        const recipients = getRecipientsForDepartment(pto.department, pto.email);
        for (const recipientEmail of recipients) {
          // Check if recipient has PTO notifications enabled
          const userId = emailToUserId.get(recipientEmail.toLowerCase());
          if (userId) {
            const enabled = await isNotificationEnabled(userId, 'ptoNotifications');
            if (!enabled) {
              console.log(`[PTO Reminder Job] Skipping ${recipientEmail} — ptoNotifications disabled`);
              continue;
            }
          }
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
        const recipients = getRecipientsForDepartment(pto.department, pto.email);
        for (const recipientEmail of recipients) {
          // Check if recipient has PTO notifications enabled
          const userId = emailToUserId.get(recipientEmail.toLowerCase());
          if (userId) {
            const enabled = await isNotificationEnabled(userId, 'ptoNotifications');
            if (!enabled) {
              console.log(`[PTO Reminder Job] Skipping ${recipientEmail} — ptoNotifications disabled`);
              continue;
            }
          }
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

export interface DailyDigestResult {
  onPtoToday: number;
  emailsSent: number;
  skipped: string | null;
}

/**
 * Daily "who's out today" digest (requested by Ford, July 2026).
 * Lists everyone on approved PTO today plus their first business day back,
 * and repeats every day until the person returns. Sent only when at least
 * one person is out. Runs at 7 AM ET.
 */
export async function sendDailyPTODigest(force = false): Promise<DailyDigestResult> {
  if (digestRunning) {
    return { onPtoToday: 0, emailsSent: 0, skipped: 'already-running' };
  }
  digestRunning = true;

  try {
    const { dateStr: todayET } = getEasternNow();
    if (!force && lastDigestDateET === todayET) {
      return { onPtoToday: 0, emailsSent: 0, skipped: 'already-sent-today' };
    }

    // All approved PTO that hasn't ended yet (covers today's absences AND
    // upcoming requests, so back-to-back PTO chains into one return date)
    const activeRequests = await db.select({
      employeeId: ptoRequests.employeeId,
      startDate: ptoRequests.startDate,
      endDate: ptoRequests.endDate,
      days: ptoRequests.days,
      type: ptoRequests.type,
      firstName: users.firstName,
      lastName: users.lastName,
      department: users.department,
    })
    .from(ptoRequests)
    .innerJoin(users, eq(users.id, ptoRequests.employeeId))
    .where(and(
      eq(ptoRequests.status, 'APPROVED'),
      gte(ptoRequests.endDate, todayET),
      eq(users.isActive, true)
    ));

    const byEmployee = new Map<string, typeof activeRequests>();
    for (const req of activeRequests) {
      if (!byEmployee.has(req.employeeId)) byEmployee.set(req.employeeId, []);
      byEmployee.get(req.employeeId)!.push(req);
    }

    // Everyone out TODAY, with first-day-back chained across contiguous requests
    const outToday: Array<{
      name: string; department: string; type: string;
      outSince: string; outThrough: string; firstDayBack: string;
    }> = [];

    for (const [, reqs] of byEmployee) {
      const current = reqs.find(r => r.startDate <= todayET);
      if (!current) continue; // on PTO later, not today

      // Chain contiguous/overlapping approved requests (weekend-aware):
      // if another request starts on or before the computed return day, extend
      let effectiveEnd = current.endDate;
      let extended = true;
      while (extended) {
        extended = false;
        const back = nextBusinessDay(effectiveEnd);
        for (const r of reqs) {
          if (r.startDate <= back && r.endDate > effectiveEnd) {
            effectiveEnd = r.endDate;
            extended = true;
          }
        }
      }

      outToday.push({
        name: `${current.firstName} ${current.lastName}`,
        department: current.department || 'No Department',
        type: current.type,
        outSince: current.startDate,
        outThrough: effectiveEnd,
        firstDayBack: nextBusinessDay(effectiveEnd),
      });
    }

    lastDigestDateET = todayET;

    if (outToday.length === 0) {
      console.log('[PTO Daily Digest] Nobody on PTO today — no email sent');
      return { onPtoToday: 0, emailsSent: 0, skipped: 'nobody-out' };
    }

    outToday.sort((a, b) => a.name.localeCompare(b.name));

    const rows = outToday.map(p => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;"><strong>${p.name}</strong><br/><span style="color: #6b7280; font-size: 13px;">${p.department}</span></td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${p.type}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(p.outThrough)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;"><strong>${formatDate(p.firstDayBack)}</strong></td>
      </tr>`).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🌴 Out Today — ${formatDate(todayET)}</h2>
        <p><strong>${outToday.length}</strong> ${outToday.length === 1 ? 'person is' : 'people are'} on approved PTO today:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #fee2e2; text-align: left;">
              <th style="padding: 8px 12px;">Who</th>
              <th style="padding: 8px 12px;">Type</th>
              <th style="padding: 8px 12px;">Out Through</th>
              <th style="padding: 8px 12px;">First Day Back</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Sent every morning anyone is out, until they're back. Automated by Roof HR.
        </p>
      </div>`;

    const emailService = new EmailService();
    await emailService.initialize();

    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    const emailToUserId = new Map(allUsers.map(u => [u.email.toLowerCase(), u.id]));

    let emailsSent = 0;
    for (const recipientEmail of getPtoDailyDigestRecipients()) {
      try {
        const userId = emailToUserId.get(recipientEmail.toLowerCase());
        if (userId) {
          const enabled = await isNotificationEnabled(userId, 'ptoNotifications');
          if (!enabled) {
            console.log(`[PTO Daily Digest] Skipping ${recipientEmail} — ptoNotifications disabled`);
            continue;
          }
        }
        await emailService.sendEmail({
          to: recipientEmail,
          subject: `Out Today (${outToday.length}): ${outToday.map(p => p.name.split(' ')[0]).join(', ')}`,
          html,
          fromUserEmail: process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com'
        });
        emailsSent++;
      } catch (error) {
        console.error(`[PTO Daily Digest] Failed to send to ${recipientEmail}:`, error);
      }
    }

    console.log(`[PTO Daily Digest] ${outToday.length} out today, ${emailsSent} emails sent`);
    return { onPtoToday: outToday.length, emailsSent, skipped: null };
  } catch (error) {
    console.error('[PTO Daily Digest] Fatal error:', error);
    throw error;
  } finally {
    digestRunning = false;
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

    // Daily "who's out today" digest at 7 AM ET (DST-aware; dedup guard inside)
    const et = getEasternNow();
    if (et.hour === 7 && lastDigestDateET !== et.dateStr) {
      try {
        console.log('[PTO Daily Digest] Running scheduled 7 AM ET digest...');
        await sendDailyPTODigest();
      } catch (error) {
        console.error('[PTO Daily Digest] Scheduled run failed:', error);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  console.log('[PTO Reminder Job] Scheduler started, will run daily at 9 PM EST (reminders) + 7 AM ET (daily digest)');
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
