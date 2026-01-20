import { db } from '../db';
import { eq, and, lte } from 'drizzle-orm';
import { inventoryAlerts, toolInventory } from '../../shared/schema';
import { EmailService } from '../email-service';

let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;

interface InventoryAlertResult {
  alertsChecked: number;
  alertsTriggered: number;
  emailsSent: number;
  errors: number;
}

/**
 * Check inventory levels and send alerts when stock is low
 * Triggers when availableQuantity <= thresholdQuantity
 *
 * Runs daily at 8 AM EST
 */
export async function checkInventoryAlerts(): Promise<InventoryAlertResult> {
  if (isRunning) {
    console.log('[Inventory Alert Job] Already running, skipping...');
    return { alertsChecked: 0, alertsTriggered: 0, emailsSent: 0, errors: 0 };
  }

  isRunning = true;
  let alertsChecked = 0;
  let alertsTriggered = 0;
  let emailsSent = 0;
  let errors = 0;

  try {
    console.log('[Inventory Alert Job] Starting check...');

    // Get all enabled alerts with their associated tools
    const alerts = await db.select({
      alertId: inventoryAlerts.id,
      toolId: inventoryAlerts.toolId,
      thresholdQuantity: inventoryAlerts.thresholdQuantity,
      alertRecipients: inventoryAlerts.alertRecipients,
      lastAlertSent: inventoryAlerts.lastAlertSent,
      toolName: toolInventory.name,
      toolCategory: toolInventory.category,
      availableQuantity: toolInventory.availableQuantity,
      quantity: toolInventory.quantity,
      location: toolInventory.location,
    })
    .from(inventoryAlerts)
    .innerJoin(toolInventory, eq(toolInventory.id, inventoryAlerts.toolId))
    .where(and(
      eq(inventoryAlerts.alertEnabled, true),
      eq(toolInventory.isActive, true)
    ));

    alertsChecked = alerts.length;
    console.log(`[Inventory Alert Job] Checking ${alertsChecked} active alerts...`);

    if (alertsChecked === 0) {
      console.log('[Inventory Alert Job] No active alerts configured');
      return { alertsChecked: 0, alertsTriggered: 0, emailsSent: 0, errors: 0 };
    }

    const emailService = new EmailService();
    await emailService.initialize();

    const triggeredAlertIds: string[] = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const alert of alerts) {
      // Check if stock is below threshold
      if (alert.availableQuantity <= alert.thresholdQuantity) {
        // Check if we already sent an alert in the last 24 hours
        if (alert.lastAlertSent && new Date(alert.lastAlertSent) > oneDayAgo) {
          console.log(`[Inventory Alert Job] Skipping ${alert.toolName} - alert sent within 24 hours`);
          continue;
        }

        alertsTriggered++;
        triggeredAlertIds.push(alert.alertId);

        // Send email to all recipients
        const recipients = alert.alertRecipients as string[] || [];

        for (const recipientEmail of recipients) {
          try {
            await emailService.sendEmail({
              to: recipientEmail,
              subject: `⚠️ Low Stock Alert: ${alert.toolName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #ef4444;">⚠️ Low Inventory Alert</h2>
                  <p>The following item is running low on stock:</p>

                  <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                    <p style="margin: 5px 0;"><strong>Item:</strong> ${alert.toolName}</p>
                    <p style="margin: 5px 0;"><strong>Category:</strong> ${alert.toolCategory || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> ${alert.location || 'Not specified'}</p>
                    <p style="margin: 5px 0;"><strong>Available Quantity:</strong> <span style="color: #ef4444; font-weight: bold;">${alert.availableQuantity}</span></p>
                    <p style="margin: 5px 0;"><strong>Total Quantity:</strong> ${alert.quantity}</p>
                    <p style="margin: 5px 0;"><strong>Threshold:</strong> ${alert.thresholdQuantity}</p>
                  </div>

                  <p style="color: #666;">Please restock this item as soon as possible to avoid assignment delays.</p>

                  <div style="margin-top: 30px;">
                    <a href="${process.env.APP_URL || 'https://roofhr.up.railway.app'}/tools"
                       style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                      View Inventory
                    </a>
                  </div>

                  <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    This is an automated alert from the Roof HR Inventory System.
                  </p>
                </div>
              `,
              fromUserEmail: process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com'
            });
            emailsSent++;
          } catch (emailError) {
            errors++;
            console.error(`[Inventory Alert Job] Error sending email to ${recipientEmail}:`, emailError);
          }
        }

        console.log(`[Inventory Alert Job] Alert triggered for ${alert.toolName} (${alert.availableQuantity}/${alert.thresholdQuantity})`);
      }
    }

    // Batch update lastAlertSent for all triggered alerts
    if (triggeredAlertIds.length > 0) {
      for (const alertId of triggeredAlertIds) {
        await db.update(inventoryAlerts)
          .set({ lastAlertSent: now, updatedAt: now })
          .where(eq(inventoryAlerts.id, alertId));
      }
      console.log(`[Inventory Alert Job] Updated lastAlertSent for ${triggeredAlertIds.length} alerts`);
    }

    console.log(`[Inventory Alert Job] Complete. Checked: ${alertsChecked}, Triggered: ${alertsTriggered}, Emails: ${emailsSent}, Errors: ${errors}`);
    return { alertsChecked, alertsTriggered, emailsSent, errors };

  } catch (error) {
    console.error('[Inventory Alert Job] Fatal error:', error);
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Start the inventory alert job scheduler
 * Runs daily at 8 AM EST (08:00)
 */
export function startInventoryAlertJob(): void {
  if (jobInterval) {
    console.log('[Inventory Alert Job] Job already started');
    return;
  }

  console.log('[Inventory Alert Job] Starting scheduler...');

  // Check every 5 minutes if it's time to run
  jobInterval = setInterval(async () => {
    const now = new Date();
    // Convert to EST (UTC-5, or UTC-4 during DST)
    const estOffset = -5; // Standard EST
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const estTime = new Date(utc + (3600000 * estOffset));

    const hour = estTime.getHours();
    const minutes = estTime.getMinutes();

    // Run at 8:00 AM EST (08:00) within the first 5 minutes
    if (hour === 8 && minutes < 5) {
      try {
        console.log('[Inventory Alert Job] Running scheduled check at 8 AM EST...');
        await checkInventoryAlerts();
      } catch (error) {
        console.error('[Inventory Alert Job] Scheduled run failed:', error);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  console.log('[Inventory Alert Job] Scheduler started, will run daily at 8 AM EST');
}

/**
 * Stop the inventory alert job scheduler
 */
export function stopInventoryAlertJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[Inventory Alert Job] Scheduler stopped');
  }
}
