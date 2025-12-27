import { db } from '../../db';
import { users, employeeContracts, contractTemplates } from '../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface ContractAction {
  type: 'create_contract' | 'update_contract' | 'send_contract' | 'sign_contract' |
        'bulk_send' | 'create_template' | 'generate_report';
  contractId?: string;
  contractIds?: string[];
  data?: any;
}

export class SusanContractManager {
  private emailService: EmailService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.emailService = new EmailService();
    this.storage = storage;
  }

  /**
   * Create a new contract
   */
  async createContract(data: {
    employeeId?: string;
    candidateId?: string;
    recipientEmail: string;
    recipientName: string;
    title: string;
    templateId?: string;
    content?: string;
    createdBy: string;
  }): Promise<{ success: boolean; contractId?: string; error?: string }> {
    try {
      const contractId = uuidv4();

      // Get template content if templateId provided
      let contractContent = data.content || '';

      // Replace variables in template if employee is provided
      if (data.employeeId) {
        const [employee] = await db.select()
          .from(users)
          .where(eq(users.id, data.employeeId))
          .limit(1);

        if (employee) {
          const employeeName = `${employee.firstName} ${employee.lastName}`;
          contractContent = contractContent
            .replace(/{{EMPLOYEE_NAME}}/g, employeeName)
            .replace(/{{EMPLOYEE_EMAIL}}/g, employee.email)
            .replace(/{{DATE}}/g, new Date().toLocaleDateString());
        }
      }

      await db.insert(employeeContracts).values({
        id: contractId,
        employeeId: data.employeeId || null,
        candidateId: data.candidateId || null,
        recipientType: data.candidateId ? 'CANDIDATE' : 'EMPLOYEE',
        recipientEmail: data.recipientEmail,
        recipientName: data.recipientName,
        templateId: data.templateId || null,
        title: data.title,
        content: contractContent,
        status: 'DRAFT',
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`[SUSAN-CONTRACTS] Created contract: ${data.title} (${contractId})`);
      return { success: true, contractId };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error creating contract:', error);
      return { success: false, error: 'Failed to create contract' };
    }
  }

  /**
   * Update contract details
   */
  async updateContract(
    contractId: string,
    updates: Partial<{
      title: string;
      content: string;
      status: 'DRAFT' | 'SENT' | 'VIEWED' | 'SIGNED' | 'REJECTED';
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeContracts)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      console.log(`[SUSAN-CONTRACTS] Updated contract ${contractId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error updating contract:', error);
      return { success: false, error: 'Failed to update contract' };
    }
  }

  /**
   * Send contract for signature
   */
  async sendContract(
    contractId: string,
    recipientEmail?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [contract] = await db.select()
        .from(employeeContracts)
        .where(eq(employeeContracts.id, contractId))
        .limit(1);

      if (!contract) {
        return { success: false, error: 'Contract not found' };
      }

      // Determine recipient email
      const email = recipientEmail || contract.recipientEmail;

      if (!email) {
        return { success: false, error: 'No recipient email found' };
      }

      // Update contract status
      await db.update(employeeContracts)
        .set({
          status: 'SENT',
          sentDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      // Send email
      await this.emailService.sendEmail({
        to: email,
        subject: `Contract for Review: ${contract.title}`,
        html: `
          <p>Dear ${contract.recipientName},</p>
          <p>Please review and sign the attached contract: ${contract.title}</p>
          <p>Please log in to the system to review and sign the contract.</p>
          <p>Best regards,<br>Contract Management</p>
        `
      });

      console.log(`[SUSAN-CONTRACTS] Sent contract ${contractId} to ${email}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error sending contract:', error);
      return { success: false, error: 'Failed to send contract' };
    }
  }

  /**
   * Sign contract
   */
  async signContract(
    contractId: string,
    signatureData?: string,
    signatureIp?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeContracts)
        .set({
          status: 'SIGNED',
          signature: signatureData || '',
          signatureIp: signatureIp || null,
          signedDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      // Send confirmation
      await this.sendContractNotification(contractId, 'signed');

      console.log(`[SUSAN-CONTRACTS] Contract ${contractId} signed`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error signing contract:', error);
      return { success: false, error: 'Failed to sign contract' };
    }
  }

  /**
   * Reject contract
   */
  async rejectContract(
    contractId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeContracts)
        .set({
          status: 'REJECTED',
          rejectionReason: reason,
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      console.log(`[SUSAN-CONTRACTS] Contract ${contractId} rejected: ${reason}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error rejecting contract:', error);
      return { success: false, error: 'Failed to reject contract' };
    }
  }

  /**
   * Bulk send contracts
   */
  async bulkSendContracts(
    contractIds: string[]
  ): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    try {
      let sentCount = 0;

      for (const contractId of contractIds) {
        const result = await this.sendContract(contractId);
        if (result.success) sentCount++;
      }

      console.log(`[SUSAN-CONTRACTS] Bulk sent ${sentCount} contracts`);
      return { success: true, sentCount };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error in bulk send:', error);
      return { success: false, error: 'Failed to bulk send contracts' };
    }
  }

  /**
   * Create contract template
   */
  async createTemplate(data: {
    name: string;
    type: string;
    content: string;
    variables?: string[];
    createdBy: string;
  }): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      const templateId = uuidv4();

      await db.insert(contractTemplates).values({
        id: templateId,
        name: data.name,
        type: data.type as 'EMPLOYMENT' | 'NDA' | 'CONTRACTOR' | 'OTHER',
        content: data.content,
        variables: data.variables || [],
        isActive: true,
        createdBy: data.createdBy,
      });

      console.log(`[SUSAN-CONTRACTS] Created template: ${data.name} (${templateId})`);
      return { success: true, templateId };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error creating template:', error);
      return { success: false, error: 'Failed to create template' };
    }
  }

  /**
   * Generate contracts report
   */
  async generateReport(): Promise<{ success: boolean; report?: any; error?: string }> {
    try {
      const allContracts = await db.select().from(employeeContracts);

      const report = {
        totalContracts: allContracts.length,
        byStatus: {
          draft: allContracts.filter((c) => c.status === 'DRAFT').length,
          sent: allContracts.filter((c) => c.status === 'SENT').length,
          viewed: allContracts.filter((c) => c.status === 'VIEWED').length,
          signed: allContracts.filter((c) => c.status === 'SIGNED').length,
          rejected: allContracts.filter((c) => c.status === 'REJECTED').length
        },
        byRecipientType: {
          employee: allContracts.filter((c) => c.recipientType === 'EMPLOYEE').length,
          candidate: allContracts.filter((c) => c.recipientType === 'CANDIDATE').length
        },
        pendingSignature: allContracts.filter((c) => c.status === 'SENT' || c.status === 'VIEWED').length,
        generatedAt: new Date()
      };

      console.log(`[SUSAN-CONTRACTS] Generated contracts report`);
      return { success: true, report };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error generating report:', error);
      return { success: false, error: 'Failed to generate report' };
    }
  }

  /**
   * Send contract notification
   */
  private async sendContractNotification(
    contractId: string,
    type: 'signed' | 'rejected'
  ): Promise<void> {
    try {
      const [contract] = await db.select()
        .from(employeeContracts)
        .where(eq(employeeContracts.id, contractId))
        .limit(1);

      if (!contract) return;

      const recipient = contract.recipientEmail;
      if (!recipient) return;

      let subject = '';
      let html = '';

      switch (type) {
        case 'signed':
          subject = `Contract Signed: ${contract.title}`;
          html = `
            <p>Dear ${contract.recipientName},</p>
            <p>Your contract "${contract.title}" has been successfully signed.</p>
            <p>The contract is now active and in effect.</p>
          `;
          break;
        case 'rejected':
          subject = `Contract Status Update: ${contract.title}`;
          html = `
            <p>Dear ${contract.recipientName},</p>
            <p>There has been an update to your contract "${contract.title}".</p>
            ${contract.rejectionReason ? `<p>Reason: ${contract.rejectionReason}</p>` : ''}
          `;
          break;
      }

      await this.emailService.sendEmail({
        to: recipient,
        subject,
        html: `${html}<p>Best regards,<br>Contract Management</p>`
      });

      console.log(`[SUSAN-CONTRACTS] Sent ${type} notification for contract ${contractId}`);
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error sending notification:', error);
    }
  }

  /**
   * Parse natural language command
   */
  parseCommand(command: string): ContractAction | null {
    const lowerCommand = command.toLowerCase();

    // Create contract
    if (lowerCommand.includes('create contract') || lowerCommand.includes('new contract')) {
      return {
        type: 'create_contract',
        data: {
          title: 'New Contract'
        }
      };
    }

    // Send contract
    if (lowerCommand.includes('send contract')) {
      return { type: 'send_contract' };
    }

    // Sign contract
    if (lowerCommand.includes('sign contract')) {
      return { type: 'sign_contract' };
    }

    // Generate report
    if (lowerCommand.includes('contract report') || lowerCommand.includes('contract summary')) {
      return { type: 'generate_report' };
    }

    return null;
  }

  /**
   * Contract Lifecycle Methods
   */

  /**
   * Renew an existing contract - creates a new contract based on the existing one
   */
  async renewContract(contractId: string, renewalData?: {
    newTitle?: string;
    updatedContent?: string;
    createdBy: string;
  }): Promise<{ success: boolean; newContractId?: string; error?: string }> {
    try {
      // Get existing contract
      const [existingContract] = await db.select()
        .from(employeeContracts)
        .where(eq(employeeContracts.id, contractId))
        .limit(1);

      if (!existingContract) {
        return { success: false, error: 'Contract not found' };
      }

      if (existingContract.status !== 'SIGNED') {
        return { success: false, error: 'Only signed contracts can be renewed' };
      }

      // Create new contract based on existing
      const newContractId = uuidv4();
      const renewalTitle = renewalData?.newTitle || `${existingContract.title} (Renewal)`;

      await db.insert(employeeContracts).values({
        id: newContractId,
        employeeId: existingContract.employeeId,
        candidateId: existingContract.candidateId,
        recipientType: existingContract.recipientType,
        recipientEmail: existingContract.recipientEmail,
        recipientName: existingContract.recipientName,
        templateId: existingContract.templateId,
        title: renewalTitle,
        content: renewalData?.updatedContent || existingContract.content,
        status: 'DRAFT',
        createdBy: renewalData?.createdBy || existingContract.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`[SUSAN-CONTRACTS] Renewed contract ${contractId} -> ${newContractId}`);
      return { success: true, newContractId };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error renewing contract:', error);
      return { success: false, error: 'Failed to renew contract' };
    }
  }

  /**
   * Terminate a contract - marks it as rejected with termination reason
   */
  async terminateContract(contractId: string, reason: string, terminatedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const [contract] = await db.select()
        .from(employeeContracts)
        .where(eq(employeeContracts.id, contractId))
        .limit(1);

      if (!contract) {
        return { success: false, error: 'Contract not found' };
      }

      if (contract.status !== 'SIGNED') {
        return { success: false, error: 'Only active/signed contracts can be terminated' };
      }

      await db.update(employeeContracts)
        .set({
          status: 'REJECTED',
          rejectionReason: `TERMINATED: ${reason}`,
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      // Send termination notification
      await this.sendContractNotification(contractId, 'rejected');

      console.log(`[SUSAN-CONTRACTS] Terminated contract ${contractId}: ${reason}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error terminating contract:', error);
      return { success: false, error: 'Failed to terminate contract' };
    }
  }

  /**
   * Expire contracts that have passed their end date
   * Note: Requires endDate field in schema (placeholder for future enhancement)
   */
  async expireContracts(): Promise<{ success: boolean; expiredCount: number; error?: string }> {
    try {
      // Get all signed contracts
      const signedContracts = await db.select()
        .from(employeeContracts)
        .where(eq(employeeContracts.status, 'SIGNED'));

      let expiredCount = 0;

      // Check each contract for expiration criteria
      // Currently using signed date + 1 year as default expiration if no explicit end date
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      for (const contract of signedContracts) {
        if (contract.signedDate && contract.signedDate < oneYearAgo) {
          await db.update(employeeContracts)
            .set({
              status: 'REJECTED',
              rejectionReason: 'EXPIRED: Contract has passed its validity period',
              updatedAt: new Date()
            })
            .where(eq(employeeContracts.id, contract.id));

          expiredCount++;
          console.log(`[SUSAN-CONTRACTS] Expired contract: ${contract.id}`);
        }
      }

      console.log(`[SUSAN-CONTRACTS] Expired ${expiredCount} contracts`);
      return { success: true, expiredCount };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error expiring contracts:', error);
      return { success: false, expiredCount: 0, error: 'Failed to expire contracts' };
    }
  }
}
