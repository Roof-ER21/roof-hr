import { storage } from '../storage';
import { gmailService } from './gmail-service';
import { EmailService } from '../email-service';
import { CONTRACT_CORE_ALERT_RECIPIENTS, RETAIL_CONTRACT_ALERT_RECIPIENTS, HR_ROLES, TOP_LEADERSHIP_EMAILS } from '@shared/constants/roles';
import { isNotificationEnabled } from './notification-preferences';

interface ContractSignedNotification {
  contractId: string;
  employeeName: string;
  contractTitle: string;
  signedDate: Date;
  signature: string;
  fileUrl?: string;
}

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const uniqueEmails = (emails: Array<string | undefined | null>) => {
  const cleaned = emails
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0);
  return Array.from(new Set(cleaned));
};

async function sendEmailWithFallback(
  recipients: string[],
  subject: string,
  html: string,
  senderEmail?: string
) {
  const targets = uniqueEmails(recipients);
  if (targets.length === 0) return;

  const remaining = new Set(targets);

  // Try Gmail (service account) first
  try {
    await gmailService.initialize();

    for (const email of targets) {
      try {
        await gmailService.sendEmail({
          to: email,
          subject,
          html,
          userEmail: senderEmail,
        });
        remaining.delete(email);
      } catch (error) {
        console.error(`[Contract Email] Gmail send failed for ${email}:`, error);
      }
    }
  } catch (error) {
    console.error('[Contract Email] Gmail initialization failed, falling back to EmailService:', error);
  }

  // Fallback to EmailService (SendGrid/SMTP/impersonation)
  if (remaining.size > 0) {
    const emailService = new EmailService();
    try {
      await emailService.initialize();
      for (const email of Array.from(remaining)) {
        try {
          await emailService.sendEmail({
            to: email,
            subject,
            html,
            fromUserEmail: senderEmail,
          });
          remaining.delete(email);
          console.log(`[Contract Email] Sent via EmailService fallback to ${email}`);
        } catch (fallbackError) {
          console.error(`[Contract Email] Fallback send failed for ${email}:`, fallbackError);
        }
      }
    } catch (initError) {
      console.error('[Contract Email] Failed to initialize EmailService fallback:', initError);
    }
  }

  if (remaining.size > 0) {
    console.error(`[Contract Email] Failed to send to ${remaining.size} recipient(s): ${Array.from(remaining).join(', ')}`);
  }
}

async function getHrRecipients() {
  const allUsers = await storage.getAllUsers();
  const hrEmails = allUsers
    .filter((user: any) => user.role && HR_ROLES.includes(user.role))
    .map((user: any) => user.email);
  return uniqueEmails([...hrEmails, 'careers@theroofdocs.com']);
}

function getLeadershipRecipients(isRetail: boolean, senderEmail?: string) {
  const base = [...CONTRACT_CORE_ALERT_RECIPIENTS];
  if (isRetail) {
    base.push(...RETAIL_CONTRACT_ALERT_RECIPIENTS);
  }
  if (senderEmail) {
    base.push(senderEmail);
  }
  return uniqueEmails(base);
}

async function filterRecipientsByContractPreference(emails: string[]): Promise<string[]> {
  try {
    const allUsers = await storage.getAllUsers();
    const emailToUser = new Map(allUsers.map((u: any) => [normalizeEmail(u.email), u.id]));
    const filtered: string[] = [];
    for (const email of emails) {
      const userId = emailToUser.get(normalizeEmail(email));
      if (!userId) {
        // External recipient (no account) — always send
        filtered.push(email);
        continue;
      }
      const enabled = await isNotificationEnabled(userId, 'contractNotifications');
      if (enabled) {
        filtered.push(email);
      } else {
        console.log(`[Contract Email] Skipping ${email} — contractNotifications disabled`);
      }
    }
    return filtered;
  } catch (error) {
    console.error('[Contract Email] Error checking preferences, sending to all:', error);
    return emails;
  }
}

async function sendEmailBatch(recipients: string[], subject: string, html: string, senderEmail?: string) {
  const filtered = await filterRecipientsByContractPreference(recipients);
  if (filtered.length === 0) return;
  await sendEmailWithFallback(filtered, subject, html, senderEmail);
}

export async function notifyManagersAndHROfSignedContract(notification: ContractSignedNotification, senderEmail?: string, isRetail = false) {
  try {
    const recipients = getLeadershipRecipients(isRetail, senderEmail);
    console.log(`[Contract Alert] Sending signed notice to ${recipients.length} recipients`);

    const subject = `Contract Signed: ${notification.contractTitle} - ${notification.employeeName}`;
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://roofhr.up.railway.app';
    const baseUrl = appUrl.replace(/\/+$/, '');
    const fileLink = notification.fileUrl ? `${baseUrl}${notification.fileUrl.startsWith('/') ? '' : '/'}${notification.fileUrl}` : '';
    const signLink = `${baseUrl}/contracts?contractId=${notification.contractId}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Contract Signature Notification</h2>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Contract Details:</h3>
          <p><strong>Employee/Candidate:</strong> ${notification.employeeName}</p>
          <p><strong>Contract Title:</strong> ${notification.contractTitle}</p>
          <p><strong>Signed Date:</strong> ${notification.signedDate.toLocaleString()}</p>
          <p><strong>Contract ID:</strong> ${notification.contractId}</p>
        </div>
        
        <p>The contract has been successfully signed and is now legally binding.</p>
        
        <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b;">
          <p style="margin: 0;"><strong>Action Required:</strong> Please review the signed contract and ensure all necessary follow-up actions are completed.</p>
        </div>
        
        <div style="margin-top: 30px;">
          <a href="${signLink}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            View Contract
          </a>
          ${notification.fileUrl ? `
          <a href="${fileLink}" 
             style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; margin-left: 10px;">
            Download Signed PDF
          </a>` : ''}
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated notification from the ROOF-ER HR Management System.
        </p>
      </div>
    `;

    await sendEmailBatch(recipients, subject, htmlContent, senderEmail);

    return { success: true, notifiedCount: recipients.length, totalManagers: recipients.length };
  } catch (error) {
    console.error('Error sending contract signed notifications:', error);
    return {
      success: false,
      notifiedCount: 0,
      totalManagers: 0
    };
  }
}

export async function notifyContractRejected(
  contract: { id: string; recipientName: string; recipientEmail: string; title: string; fileUrl?: string; rejectionReason?: string },
  senderEmail?: string,
  isRetail = false
) {
  try {
    const recipients = getLeadershipRecipients(isRetail, senderEmail);
    console.log(`[Contract Alert] Sending rejected notice to ${recipients.length} recipients`);

    const subject = `Contract Rejected: ${contract.title} - ${contract.recipientName}`;
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://roofhr.up.railway.app';
    const baseUrl = appUrl.replace(/\/+$/, '');
    const fileLink = contract.fileUrl ? `${baseUrl}${contract.fileUrl.startsWith('/') ? '' : '/'}${contract.fileUrl}` : '';
    const signLink = `${baseUrl}/contracts?contractId=${contract.id}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Contract Rejected</h2>
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Employee/Candidate:</strong> ${contract.recipientName}</p>
          <p><strong>Contract Title:</strong> ${contract.title}</p>
          ${contract.rejectionReason ? `<p><strong>Reason:</strong> ${contract.rejectionReason}</p>` : ''}
        </div>
        <div style="margin-top: 30px;">
          <a href="${signLink}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            View Contract
          </a>
          ${contract.fileUrl ? `
          <a href="${fileLink}" 
             style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; margin-left: 10px;">
            Download PDF
          </a>` : ''}
        </div>
      </div>
    `;

    await sendEmailBatch(recipients, subject, htmlContent, senderEmail);
    return true;
  } catch (error) {
    console.error('Error sending contract rejected notifications:', error);
    return false;
  }
}

export async function notifyRecipientOfRescindedContract(
  contract: { id: string; recipientName: string; recipientEmail: string; title: string },
  senderEmail?: string,
  reason?: string
) {
  try {
    const subject = `Contract Rescinded: ${contract.title}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Contract Rescinded</h2>
        <p>Dear ${contract.recipientName},</p>
        <p>Your contract for <strong>${contract.title}</strong> has been rescinded.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>If you have questions, please reply to this email.</p>
      </div>
    `;

    const filtered = await filterRecipientsByContractPreference([contract.recipientEmail]);
    if (filtered.length > 0) {
      await sendEmailWithFallback(filtered, subject, htmlContent, senderEmail);
    }

    return true;
  } catch (error) {
    console.error('Error sending rescind notification to recipient:', error);
    return false;
  }
}

export async function notifyContractSentInternal(
  contract: { id: string; recipientName: string; recipientEmail: string; title: string; fileUrl?: string },
  senderEmail?: string
) {
  try {
    const hrRecipients = await getHrRecipients();
    const recipients = uniqueEmails([...hrRecipients, senderEmail]);
    if (recipients.length === 0) return true;

    const subject = `Contract Sent: ${contract.title} - ${contract.recipientName}`;
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://roofhr.up.railway.app';
    const baseUrl = appUrl.replace(/\/+$/, '');
    const signLink = `${baseUrl}/contracts?contractId=${contract.id}`;
    const fileLink = contract.fileUrl ? `${baseUrl}${contract.fileUrl.startsWith('/') ? '' : '/'}${contract.fileUrl}` : '';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Contract Sent</h2>
        <p>The contract has been sent to ${contract.recipientName} (${contract.recipientEmail}).</p>
        <div style="margin-top: 20px;">
          <a href="${signLink}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            View Contract
          </a>
          ${contract.fileUrl ? `
          <a href="${fileLink}" 
             style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; margin-left: 10px;">
            Download PDF
          </a>` : ''}
        </div>
      </div>
    `;

    await sendEmailBatch(recipients, subject, htmlContent, senderEmail);
    return true;
  } catch (error) {
    console.error('Error sending contract sent notifications:', error);
    return false;
  }
}

export async function notifyContractReminder(
  contract: { id: string; recipientName: string; recipientEmail: string; title: string; fileUrl?: string; accessToken?: string | null },
  senderEmail: string | undefined,
  daysSinceSent: number,
  includeRecipient: boolean,
  includeLeadership: boolean
) {
  try {
    const hrRecipients = await getHrRecipients();
    const leadership = includeLeadership ? TOP_LEADERSHIP_EMAILS : [];
    const recipients = uniqueEmails([
      ...hrRecipients,
      senderEmail,
      ...(includeRecipient ? [contract.recipientEmail] : []),
      ...leadership
    ]);

    if (recipients.length === 0) return true;

    const subject = `Contract Follow-Up (${daysSinceSent} days): ${contract.title} - ${contract.recipientName}`;
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://roofhr.up.railway.app';
    const baseUrl = appUrl.replace(/\/+$/, '');
    // Use public link with token for recipient, authenticated link for internal users
    const signLink = contract.accessToken
      ? `${baseUrl}/contract/${contract.accessToken}`
      : `${baseUrl}/contracts?contractId=${contract.id}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Contract Follow-Up</h2>
        <p>This contract has been awaiting signature for ${daysSinceSent} days.</p>
        <p><strong>Recipient:</strong> ${contract.recipientName} (${contract.recipientEmail})</p>
        <div style="margin-top: 20px;">
          <a href="${signLink}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Review Contract
          </a>
        </div>
      </div>
    `;

    await sendEmailBatch(recipients, subject, htmlContent, senderEmail);
    return true;
  } catch (error) {
    console.error('Error sending contract reminder notifications:', error);
    return false;
  }
}

export async function notifyRecipientOfNewContract(
  recipientEmail: string,
  recipientName: string,
  contractTitle: string,
  contractId: string,
  senderEmail?: string, // Email of the user sending this (for Gmail impersonation)
  fileUrl?: string,
  accessToken?: string // Optional token for public access link (no login required)
) {
  try {
    const subject = `New Contract for Review: ${contractTitle}`;
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://roofhr.up.railway.app';
    const baseUrl = appUrl.replace(/\/+$/, '');

    // Use public link with token if available (no login required)
    // Otherwise fall back to authenticated link
    const signLink = accessToken
      ? `${baseUrl}/contract/${accessToken}`
      : `${baseUrl}/contracts?contractId=${contractId}`;

    // For PDF download, use token-based link if available
    const fileLink = accessToken && fileUrl
      ? `${baseUrl}/api/public/contract/${accessToken}/download`
      : fileUrl
        ? `${baseUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`
        : '';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Contract Ready for Review</h2>
        
        <p>Dear ${recipientName},</p>
        
        <p>A new contract has been prepared for your review and signature.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Contract Details:</h3>
          <p><strong>Contract Title:</strong> ${contractTitle}</p>
          <p><strong>Recipient:</strong> ${recipientName}</p>
        </div>
        
        <p>Please review the contract carefully. You can:</p>
        <ul>
          <li>Review all terms and conditions</li>
          <li>Sign the contract electronically</li>
          <li>Request changes if needed</li>
        </ul>
        
        <div style="margin-top: 30px;">
          <a href="${signLink}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Review & Sign
          </a>
          ${fileUrl ? `
          <a href="${fileLink}" 
             style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; margin-left: 10px;">
            Download PDF
          </a>` : ''}
        </div>
        
        <p style="margin-top: 20px; color: #6b7280;">
          If you have any questions or concerns about the contract, please contact HR immediately.
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated notification from the ROOF-ER HR Management System.
        </p>
      </div>
    `;

    const filtered = await filterRecipientsByContractPreference([recipientEmail]);
    if (filtered.length > 0) {
      await sendEmailWithFallback(filtered, subject, htmlContent, senderEmail);
    }
    return true;
  } catch (error) {
    console.error('Error sending contract notification:', error);
    return false;
  }
}
