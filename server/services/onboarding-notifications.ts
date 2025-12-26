import { storage } from '../storage';
import { googleEmailService } from './google-email-service';

/**
 * Onboarding Notification Service
 *
 * Handles all notification-related functionality for the onboarding system:
 * - Assignment notifications (in-app + email)
 * - Overdue task notifications
 * - Scheduled overdue checks
 */

interface NotificationMetadata {
  instanceId?: string;
  stepId?: string;
  templateId?: string;
  dueDate?: string;
  [key: string]: any;
}

/**
 * Send notification when an onboarding template is assigned to an employee
 */
export async function sendOnboardingAssignedNotification(
  employeeId: string,
  instanceId: string,
  templateName: string,
  managerName: string
): Promise<void> {
  try {
    console.log(`[Onboarding Notification] Sending assignment notification to employee ${employeeId}`);

    // Get employee details
    const employee = await storage.getUserById(employeeId);
    if (!employee) {
      console.error(`[Onboarding Notification] Employee not found: ${employeeId}`);
      return;
    }

    // Create in-app notification
    const metadata: NotificationMetadata = {
      instanceId,
      templateName,
      managerName,
    };

    await storage.createNotification({
      userId: employeeId,
      type: 'onboarding_assigned',
      title: 'New Onboarding Process Assigned',
      message: `${managerName} has assigned you the "${templateName}" onboarding process. Please check your tasks to get started.`,
      link: '/dashboard?tab=onboarding',
      metadata: JSON.stringify(metadata),
      read: false,
    });

    console.log(`[Onboarding Notification] In-app notification created for employee ${employeeId}`);

    // Send email notification
    if (employee.email) {
      const emailSubject = 'New Onboarding Process Assigned';
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Your Onboarding Journey!</h2>

          <p>Hi ${employee.firstName || 'there'},</p>

          <p>${managerName} has assigned you a new onboarding process:</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">${templateName}</h3>
            <p style="margin-bottom: 0;">This onboarding process will help you get started and complete all necessary tasks.</p>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Log in to your account</li>
            <li>Navigate to the Onboarding section</li>
            <li>Review and complete your assigned tasks</li>
          </ol>

          <div style="margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://app.theroofdocs.com'}/dashboard?tab=onboarding"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Your Onboarding Tasks
            </a>
          </div>

          <p>If you have any questions, please reach out to ${managerName} or your HR department.</p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from the Roof HR system.
          </p>
        </div>
      `;

      const emailSent = await googleEmailService.sendEmail({
        to: employee.email,
        subject: emailSubject,
        html: emailBody,
      });

      if (emailSent) {
        console.log(`[Onboarding Notification] Email sent to ${employee.email}`);
      } else {
        console.warn(`[Onboarding Notification] Failed to send email to ${employee.email}`);
      }
    } else {
      console.warn(`[Onboarding Notification] No email address found for employee ${employeeId}`);
    }
  } catch (error) {
    console.error('[Onboarding Notification] Error sending assignment notification:', error);
    // Don't throw - notification failures shouldn't break the assignment process
  }
}

/**
 * Send notification for an overdue onboarding task
 */
export async function sendOverdueTaskNotification(
  employeeId: string,
  stepId: string,
  taskTitle: string,
  dueDate: Date
): Promise<void> {
  try {
    console.log(`[Onboarding Notification] Sending overdue notification for step ${stepId}`);

    // Check if we've already sent a notification for this step in the last 24 hours
    const recentNotification = await storage.getRecentNotification(
      employeeId,
      'task_overdue',
      stepId,
      24 // hours
    );

    if (recentNotification) {
      console.log(`[Onboarding Notification] Overdue notification already sent in last 24 hours for step ${stepId}`);
      return;
    }

    // Get employee details
    const employee = await storage.getUserById(employeeId);
    if (!employee) {
      console.error(`[Onboarding Notification] Employee not found: ${employeeId}`);
      return;
    }

    // Calculate how many days overdue
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Create in-app notification
    const metadata: NotificationMetadata = {
      stepId,
      taskTitle,
      dueDate: dueDate.toISOString(),
      daysOverdue,
    };

    await storage.createNotification({
      userId: employeeId,
      type: 'task_overdue',
      title: 'Overdue Onboarding Task',
      message: `Your task "${taskTitle}" is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Please complete it as soon as possible.`,
      link: '/dashboard?tab=onboarding',
      metadata: JSON.stringify(metadata),
      read: false,
    });

    console.log(`[Onboarding Notification] In-app notification created for employee ${employeeId}`);

    // Send email reminder
    if (employee.email) {
      const emailSubject = `Reminder: Overdue Onboarding Task - ${taskTitle}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Overdue Task Reminder</h2>

          <p>Hi ${employee.firstName || 'there'},</p>

          <p>This is a friendly reminder that you have an overdue onboarding task that needs your attention.</p>

          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #991b1b;">${taskTitle}</h3>
            <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
            <p><strong>Days Overdue:</strong> ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</p>
          </div>

          <p>Please complete this task as soon as possible to stay on track with your onboarding process.</p>

          <div style="margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://app.theroofdocs.com'}/dashboard?tab=onboarding"
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Complete Task Now
            </a>
          </div>

          <p>If you need assistance or have questions about this task, please contact your manager or HR department.</p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #6b7280; font-size: 14px;">
            This is an automated reminder from the Roof HR system.
          </p>
        </div>
      `;

      const emailSent = await googleEmailService.sendEmail({
        to: employee.email,
        subject: emailSubject,
        html: emailBody,
      });

      if (emailSent) {
        console.log(`[Onboarding Notification] Overdue email sent to ${employee.email}`);
      } else {
        console.warn(`[Onboarding Notification] Failed to send overdue email to ${employee.email}`);
      }
    } else {
      console.warn(`[Onboarding Notification] No email address found for employee ${employeeId}`);
    }
  } catch (error) {
    console.error('[Onboarding Notification] Error sending overdue task notification:', error);
    // Don't throw - notification failures shouldn't break other processes
  }
}

/**
 * Check for overdue onboarding tasks and send notifications
 * This function should be called on a schedule (e.g., daily at 9 AM)
 */
export async function checkOverdueTasks(): Promise<void> {
  try {
    console.log('[Onboarding Notification] Starting overdue tasks check...');

    // Get all overdue steps
    const overdueSteps = await storage.getOverdueOnboardingSteps();

    if (overdueSteps.length === 0) {
      console.log('[Onboarding Notification] No overdue tasks found');
      return;
    }

    console.log(`[Onboarding Notification] Found ${overdueSteps.length} overdue tasks`);

    // Group overdue steps by employee to avoid sending too many emails
    const stepsByEmployee = new Map<string, typeof overdueSteps>();

    for (const step of overdueSteps) {
      // Get the workflow/instance to find the employee
      const workflow = await storage.getOnboardingWorkflowById(step.workflowId);
      const instance = await storage.getOnboardingInstanceById(step.workflowId);
      const workflowOrInstance = workflow || instance;

      if (!workflowOrInstance || !workflowOrInstance.employeeId) {
        console.warn(`[Onboarding Notification] Could not find employee for step ${step.id}`);
        continue;
      }

      const employeeId = workflowOrInstance.employeeId;

      if (!stepsByEmployee.has(employeeId)) {
        stepsByEmployee.set(employeeId, []);
      }

      stepsByEmployee.get(employeeId)!.push(step);
    }

    console.log(`[Onboarding Notification] Processing overdue tasks for ${stepsByEmployee.size} employees`);

    // Send notifications for each employee's overdue tasks
    let notificationsSent = 0;
    let notificationsFailed = 0;

    for (const [employeeId, steps] of Array.from(stepsByEmployee.entries())) {
      try {
        // If employee has multiple overdue tasks, send individual notifications for each
        // but they'll be grouped together in the notification center
        for (const step of steps) {
          await sendOverdueTaskNotification(
            employeeId,
            step.id,
            step.title,
            step.dueDate!
          );
          notificationsSent++;
        }
      } catch (error) {
        console.error(`[Onboarding Notification] Failed to send notifications to employee ${employeeId}:`, error);
        notificationsFailed++;
      }
    }

    console.log(`[Onboarding Notification] Overdue tasks check complete. Notifications sent: ${notificationsSent}, Failed: ${notificationsFailed}`);
  } catch (error) {
    console.error('[Onboarding Notification] Error checking overdue tasks:', error);
  }
}

/**
 * Setup scheduled job for checking overdue tasks
 * Call this function when the server starts
 */
export function setupOverdueTasksScheduler(): void {
  // Run check every day at 9 AM
  const NINE_AM = 9; // 9:00 AM
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const scheduleNextCheck = () => {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(NINE_AM, 0, 0, 0);

    // If it's already past 9 AM today, schedule for tomorrow
    if (now.getHours() >= NINE_AM) {
      nextRun.setTime(nextRun.getTime() + ONE_DAY_MS);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    console.log(`[Onboarding Notification] Next overdue tasks check scheduled for ${nextRun.toLocaleString()}`);

    setTimeout(async () => {
      await checkOverdueTasks();
      scheduleNextCheck(); // Schedule the next check after this one completes
    }, msUntilNextRun);
  };

  // Start the scheduler
  scheduleNextCheck();

  // Also run an immediate check on startup (optional, can be commented out)
  console.log('[Onboarding Notification] Running initial overdue tasks check...');
  checkOverdueTasks().catch(error => {
    console.error('[Onboarding Notification] Error in initial overdue check:', error);
  });
}
