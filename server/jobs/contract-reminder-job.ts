import { storage } from '../storage';
import { notifyContractReminder } from '../services/contract-notification';
import { logger } from '../middleware/logger';

let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;

const REMINDER_STAGES = [2, 4, 7];

export async function checkContractReminders(): Promise<void> {
  if (isRunning) {
    logger.warn('[Contract Reminder Job] Already running, skipping...');
    return;
  }

  isRunning = true;

  try {
    logger.info('[Contract Reminder Job] Starting check...');

    const contracts = await storage.getAllEmployeeContracts();
    const now = new Date();

    for (const contract of contracts) {
      if (!contract.sentDate) continue;
      if (!['SENT', 'VIEWED'].includes(contract.status)) continue;

      const sentDate = new Date(contract.sentDate);
      const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

      if (!REMINDER_STAGES.includes(daysSinceSent)) continue;

      const reminderStages = contract.reminderStages || [];
      const stageKey = String(daysSinceSent);
      if (reminderStages.includes(stageKey)) continue;

      const senderUserId = contract.sentBy || contract.createdBy;
      const senderUser = senderUserId ? await storage.getUserById(senderUserId) : null;
      const senderEmail = senderUser?.email || undefined;

      const includeRecipient = daysSinceSent === 7;
      const includeLeadership = daysSinceSent === 7;

      const sent = await notifyContractReminder(
        {
          id: contract.id,
          recipientName: contract.recipientName,
          recipientEmail: contract.recipientEmail,
          title: contract.title,
          fileUrl: contract.fileUrl || undefined
        },
        senderEmail,
        daysSinceSent,
        includeRecipient,
        includeLeadership
      );

      if (sent) {
        const updatedStages = [...reminderStages, stageKey];
        await storage.updateEmployeeContract(contract.id, {
          reminderStages: updatedStages
        });
      }
    }

    logger.info('[Contract Reminder Job] Check complete');
  } catch (error) {
    logger.error('[Contract Reminder Job] Failed:', error);
  } finally {
    isRunning = false;
  }
}

export function startContractReminderJob(): void {
  if (jobInterval) {
    logger.warn('[Contract Reminder Job] Job already started');
    return;
  }

  logger.info('[Contract Reminder Job] Starting scheduler...');

  jobInterval = setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();

    if (hour === 9 && minutes < 5) {
      try {
        await checkContractReminders();
      } catch (error) {
        logger.error('[Contract Reminder Job] Scheduled run failed:', error);
      }
    }
  }, 5 * 60 * 1000);

  logger.info('[Contract Reminder Job] Scheduler started, will run daily at 9 AM');
}

export function stopContractReminderJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    logger.info('[Contract Reminder Job] Scheduler stopped');
  }
}
