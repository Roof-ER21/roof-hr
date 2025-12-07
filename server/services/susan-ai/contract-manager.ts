import { db } from '../../db';
import { users, employeeContracts, contractTemplates } from '../../../shared/schema';
import { eq, and, or, sql, desc, inArray, like, gte } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface ContractAction {
  type: 'create_contract' | 'update_contract' | 'send_contract' | 'sign_contract' | 
        'expire_contracts' | 'renew_contract' | 'terminate_contract' | 'bulk_send' |
        'create_template' | 'generate_report';
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
    vendorId?: string;
    type: 'EMPLOYMENT' | 'NDA' | 'SERVICE' | 'VENDOR';
    title: string;
    startDate: Date;
    endDate?: Date;
    value?: number;
    templateId?: string;
    content?: string;
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
            .replace(/{{START_DATE}}/g, data.startDate.toLocaleDateString());
        }
      }
      
      // In a real system, this would create a contract record
      // For now, we just log the contract creation
      console.log(`[SUSAN-CONTRACTS] Created contract: ${data.title} (${contractId})`);
      console.log(`[SUSAN-CONTRACTS] Contract details:`, data);
      console.log(`[SUSAN-CONTRACTS] Contract content preview:`, contractContent.substring(0, 200));

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
      status: string;
      startDate: Date;
      endDate: Date;
      value: number;
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

      // Determine recipient
      let email = recipientEmail;
      if (!email && contract.employeeId) {
        const [employee] = await db.select()
          .from(users)
          .where(eq(users.id, contract.employeeId))
          .limit(1);
        email = employee?.email;
      }

      if (!email) {
        return { success: false, error: 'No recipient email found' };
      }

      // Update contract status
      await db.update(employeeContracts)
        .set({
          status: 'SENT',
          sentAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      // Send email
      await this.emailService.sendEmail({
        to: email,
        subject: `Contract for Review: ${contract.title}`,
        html: `
          <p>Dear Recipient,</p>
          <p>Please review and sign the attached contract: ${contract.title}</p>
          <p>Contract Details:</p>
          <ul>
            <li>Type: ${contract.type}</li>
            <li>Start Date: ${contract.startDate}</li>
            ${contract.endDate ? `<li>End Date: ${contract.endDate}</li>` : ''}
            ${contract.value ? `<li>Value: $${contract.value.toLocaleString()}</li>` : ''}
          </ul>
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
    signedBy: string,
    signatureData?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeContracts)
        .set({
          status: 'SIGNED',
          signedBy,
          signedAt: new Date(),
          signatureData: signatureData || '',
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      // Send confirmation
      await this.sendContractNotification(contractId, 'signed');

      console.log(`[SUSAN-CONTRACTS] Contract ${contractId} signed by ${signedBy}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error signing contract:', error);
      return { success: false, error: 'Failed to sign contract' };
    }
  }

  /**
   * Expire contracts
   */
  async expireContracts(): Promise<{ success: boolean; expiredCount?: number; error?: string }> {
    try {
      const today = new Date();
      
      const result = await db.update(employeeContracts)
        .set({
          status: 'EXPIRED',
          updatedAt: new Date()
        })
        .where(and(
          sql`${employeeContracts.endDate} < ${today}`,
          inArray(employeeContracts.status, ['SIGNED', 'ACTIVE'])
        ));

      console.log(`[SUSAN-CONTRACTS] Expired contracts`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error expiring contracts:', error);
      return { success: false, error: 'Failed to expire contracts' };
    }
  }

  /**
   * Renew contract
   */
  async renewContract(
    contractId: string,
    newEndDate: Date,
    adjustments?: {
      value?: number;
      terms?: string;
    }
  ): Promise<{ success: boolean; newContractId?: string; error?: string }> {
    try {
      const [originalContract] = await db.select()
        .from(employeeContracts)
        .where(eq(employeeContracts.id, contractId))
        .limit(1);

      if (!originalContract) {
        return { success: false, error: 'Original contract not found' };
      }

      // Create renewed contract
      const newContractId = uuidv4();
      
      await db.insert(employeeContracts).values({
        id: newContractId,
        employeeId: originalContract.employeeId,
        vendorId: originalContract.vendorId,
        type: originalContract.type,
        title: `${originalContract.title} (Renewed)`,
        content: adjustments?.terms || originalContract.content,
        status: 'DRAFT',
        startDate: originalContract.endDate || new Date(),
        endDate: newEndDate,
        value: adjustments?.value || originalContract.value,
        renewedFrom: contractId,
        createdBy: 'susan-ai',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mark original as renewed
      await db.update(employeeContracts)
        .set({
          status: 'RENEWED',
          renewedTo: newContractId,
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      console.log(`[SUSAN-CONTRACTS] Renewed contract ${contractId} as ${newContractId}`);
      return { success: true, newContractId };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error renewing contract:', error);
      return { success: false, error: 'Failed to renew contract' };
    }
  }

  /**
   * Terminate contract
   */
  async terminateContract(
    contractId: string,
    reason: string,
    effectiveDate?: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeContracts)
        .set({
          status: 'TERMINATED',
          terminationReason: reason,
          terminatedAt: effectiveDate || new Date(),
          updatedAt: new Date()
        })
        .where(eq(employeeContracts.id, contractId));

      // Send termination notice
      await this.sendContractNotification(contractId, 'terminated');

      console.log(`[SUSAN-CONTRACTS] Terminated contract ${contractId}: ${reason}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-CONTRACTS] Error terminating contract:', error);
      return { success: false, error: 'Failed to terminate contract' };
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
  }): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      const templateId = uuidv4();
      
      await db.insert(contractTemplates).values({
        id: templateId,
        name: data.name,
        type: data.type,
        content: data.content,
        variables: data.variables || [],
        isActive: true,
        createdBy: 'susan-ai',
        createdAt: new Date(),
        updatedAt: new Date()
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
          draft: allContracts.filter(c => c.status === 'DRAFT').length,
          sent: allContracts.filter(c => c.status === 'SENT').length,
          signed: allContracts.filter(c => c.status === 'SIGNED').length,
          active: allContracts.filter(c => c.status === 'ACTIVE').length,
          expired: allContracts.filter(c => c.status === 'EXPIRED').length,
          terminated: allContracts.filter(c => c.status === 'TERMINATED').length
        },
        byType: {
          employment: allContracts.filter(c => c.type === 'EMPLOYMENT').length,
          nda: allContracts.filter(c => c.type === 'NDA').length,
          service: allContracts.filter(c => c.type === 'SERVICE').length,
          vendor: allContracts.filter(c => c.type === 'VENDOR').length
        },
        totalValue: allContracts.reduce((sum, c) => sum + (c.value || 0), 0),
        expiringIn30Days: 0,
        needsRenewal: 0,
        generatedAt: new Date()
      };

      // Calculate expiring contracts
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      report.expiringIn30Days = allContracts.filter(c => 
        c.endDate && c.endDate <= thirtyDaysFromNow && c.status === 'ACTIVE'
      ).length;

      report.needsRenewal = allContracts.filter(c => 
        c.endDate && c.endDate <= thirtyDaysFromNow && c.status === 'SIGNED'
      ).length;

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
    type: 'signed' | 'terminated' | 'expiring'
  ): Promise<void> {
    try {
      const [contract] = await db.select()
        .from(employeeContracts)
        .where(eq(employeeContracts.id, contractId))
        .limit(1);

      if (!contract) return;

      let recipient = '';
      if (contract.employeeId) {
        const [employee] = await db.select()
          .from(users)
          .where(eq(users.id, contract.employeeId))
          .limit(1);
        recipient = employee?.email || '';
      }

      if (!recipient) return;

      let subject = '';
      let html = '';

      switch (type) {
        case 'signed':
          subject = `Contract Signed: ${contract.title}`;
          html = `
            <p>Your contract "${contract.title}" has been successfully signed.</p>
            <p>The contract is now active and in effect.</p>
          `;
          break;
        case 'terminated':
          subject = `Contract Terminated: ${contract.title}`;
          html = `
            <p>Your contract "${contract.title}" has been terminated.</p>
            <p>Reason: ${contract.terminationReason || 'Not specified'}</p>
          `;
          break;
        case 'expiring':
          subject = `Contract Expiring Soon: ${contract.title}`;
          html = `
            <p>Your contract "${contract.title}" will expire on ${contract.endDate}.</p>
            <p>Please contact HR to discuss renewal options.</p>
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
      const typeMatch = lowerCommand.includes('employment') ? 'EMPLOYMENT' :
                       lowerCommand.includes('nda') ? 'NDA' :
                       lowerCommand.includes('service') ? 'SERVICE' : 'VENDOR';
      
      return {
        type: 'create_contract',
        data: {
          type: typeMatch,
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

    // Renew contract
    if (lowerCommand.includes('renew')) {
      return { type: 'renew_contract' };
    }

    // Terminate contract
    if (lowerCommand.includes('terminate') || lowerCommand.includes('cancel contract')) {
      const reasonMatch = command.match(/(?:because|reason:?)\s+(.+)/i);
      return {
        type: 'terminate_contract',
        data: { reason: reasonMatch?.[1] || 'Mutual agreement' }
      };
    }

    // Expire contracts
    if (lowerCommand.includes('expire')) {
      return { type: 'expire_contracts' };
    }

    // Generate report
    if (lowerCommand.includes('contract report') || lowerCommand.includes('contract summary')) {
      return { type: 'generate_report' };
    }

    return null;
  }
}