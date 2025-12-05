import { storage } from '../storage';
import { emailService } from '../email-service';

interface ContractSignedNotification {
  contractId: string;
  employeeName: string;
  contractTitle: string;
  signedDate: Date;
  signature: string;
}

export async function notifyManagersAndHROfSignedContract(notification: ContractSignedNotification) {
  try {
    // Get all managers and HR personnel
    const managers = await storage.getUsersByRoles(['ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TRUE_ADMIN']);
    
    // Filter out already notified managers
    const contract = await storage.getEmployeeContractById(notification.contractId);
    const notifiedManagers = contract?.notifiedManagers || [];
    
    const managersToNotify = managers.filter(m => !notifiedManagers.includes(m.id));
    
    if (managersToNotify.length === 0) {
      console.log('All managers have already been notified');
      return;
    }
    
    // Prepare email content
    const subject = `Contract Signed: ${notification.contractTitle} - ${notification.employeeName}`;
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
          <a href="${process.env.FRONTEND_URL || ''}/contracts" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            View Contract
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated notification from the ROOF-ER HR Management System.
        </p>
      </div>
    `;
    
    // Send emails to all managers and HR
    const emailPromises = managersToNotify.map(async (manager) => {
      try {
        const sent = await emailService.sendEmail({
          to: manager.email,
          subject,
          html: htmlContent
        });
        
        if (sent) {
          console.log(`Contract signed notification sent to ${manager.email}`);
          // Update the notified managers list
          const updatedNotifiedList = [...notifiedManagers, manager.id];
          await storage.updateEmployeeContract(notification.contractId, {
            notifiedManagers: updatedNotifiedList
          });
        }
        
        return sent;
      } catch (error) {
        console.error(`Failed to send notification to ${manager.email}:`, error);
        return false;
      }
    });
    
    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r).length;
    
    console.log(`Contract signed notifications sent to ${successCount}/${managersToNotify.length} managers/HR`);
    
    return {
      success: successCount > 0,
      notifiedCount: successCount,
      totalManagers: managersToNotify.length
    };
    
  } catch (error) {
    console.error('Error sending contract signed notifications:', error);
    return {
      success: false,
      notifiedCount: 0,
      totalManagers: 0
    };
  }
}

export async function notifyRecipientOfNewContract(
  recipientEmail: string,
  recipientName: string,
  contractTitle: string,
  contractId: string
) {
  try {
    const subject = `New Contract for Review: ${contractTitle}`;
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
          <a href="${process.env.FRONTEND_URL || ''}/contracts/view/${contractId}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Review Contract
          </a>
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
    
    const sent = await emailService.sendEmail({
      to: recipientEmail,
      subject,
      html: htmlContent
    });
    
    if (sent) {
      console.log(`Contract notification sent to ${recipientEmail}`);
    }
    
    return sent;
    
  } catch (error) {
    console.error('Error sending contract notification:', error);
    return false;
  }
}