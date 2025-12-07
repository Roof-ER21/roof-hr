import { db } from '../../db';
import { users, territories } from '../../../shared/schema';
import { eq, and, or, sql, desc, inArray, like } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface TerritoryAction {
  type: 'create_territory' | 'update_territory' | 'delete_territory' | 'assign_manager' | 
        'transfer_employees' | 'merge_territories' | 'split_territory' | 'generate_report';
  territoryId?: string;
  territoryIds?: string[];
  data?: any;
}

export class SusanTerritoryManager {
  private emailService: EmailService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.emailService = new EmailService();
    this.storage = storage;
  }

  /**
   * Create a new territory
   */
  async createTerritory(data: {
    name: string;
    region: string;
    salesManagerId?: string;
    description?: string;
  }): Promise<{ success: boolean; territoryId?: string; error?: string }> {
    try {
      const territoryId = uuidv4();

      // Create territory record
      await db.insert(territories).values({
        id: territoryId,
        name: data.name,
        region: data.region,
        salesManagerId: data.salesManagerId,
        description: data.description,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[SUSAN-TERRITORY] Creating territory: ${data.name} (${territoryId})`);
      console.log(`[SUSAN-TERRITORY] Territory details:`, data);

      // Notify manager if assigned
      if (data.salesManagerId) {
        await this.sendTerritoryNotification(data.salesManagerId, territoryId, 'assigned');
      }

      return { success: true, territoryId };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error creating territory:', error);
      return { success: false, error: 'Failed to create territory' };
    }
  }

  /**
   * Update territory information
   */
  async updateTerritory(
    territoryId: string,
    updates: Partial<{
      name: string;
      region: string;
      salesManagerId: string;
      description: string;
      isActive: boolean;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // If manager changed, notify both old and new
      if (updates.salesManagerId) {
        const [territory] = await db.select()
          .from(territories)
          .where(eq(territories.id, territoryId))
          .limit(1);

        if (territory && territory.salesManagerId && territory.salesManagerId !== updates.salesManagerId) {
          await this.sendTerritoryNotification(territory.salesManagerId, territoryId, 'removed');
          await this.sendTerritoryNotification(updates.salesManagerId, territoryId, 'assigned');
        }
      }

      await db.update(territories)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(territories.id, territoryId));

      console.log(`[SUSAN-TERRITORY] Updated territory ${territoryId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error updating territory:', error);
      return { success: false, error: 'Failed to update territory' };
    }
  }

  /**
   * Assign manager to territory
   */
  async assignManager(
    territoryId: string,
    salesManagerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [territory] = await db.select()
        .from(territories)
        .where(eq(territories.id, territoryId))
        .limit(1);

      if (!territory) {
        return { success: false, error: 'Territory not found' };
      }

      // Remove old manager if exists
      if (territory.salesManagerId) {
        await this.sendTerritoryNotification(territory.salesManagerId, territoryId, 'removed');
      }

      await db.update(territories)
        .set({
          salesManagerId,
          updatedAt: new Date()
        })
        .where(eq(territories.id, territoryId));

      // Notify new manager
      await this.sendTerritoryNotification(salesManagerId, territoryId, 'assigned');

      console.log(`[SUSAN-TERRITORY] Assigned manager ${salesManagerId} to territory ${territoryId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error assigning manager:', error);
      return { success: false, error: 'Failed to assign manager' };
    }
  }

  /**
   * Transfer employees between territories
   */
  async transferEmployees(
    fromTerritoryId: string,
    toTerritoryId: string,
    employeeIds?: string[]
  ): Promise<{ success: boolean; transferredCount?: number; error?: string }> {
    try {
      let transferredCount = 0;

      if (employeeIds && employeeIds.length > 0) {
        // Transfer specific employees
        await db.update(users)
          .set({
            territoryId: toTerritoryId,
            updatedAt: new Date()
          })
          .where(and(
            inArray(users.id, employeeIds),
            eq(users.territoryId, fromTerritoryId)
          ));

        transferredCount = employeeIds.length;
      } else {
        // Transfer all employees - first count them
        const employeesToTransfer = await db.select()
          .from(users)
          .where(eq(users.territoryId, fromTerritoryId));

        transferredCount = employeesToTransfer.length;

        if (transferredCount > 0) {
          await db.update(users)
            .set({
              territoryId: toTerritoryId,
              updatedAt: new Date()
            })
            .where(eq(users.territoryId, fromTerritoryId));
        }
      }

      console.log(`[SUSAN-TERRITORY] Transferred ${transferredCount} employees from ${fromTerritoryId} to ${toTerritoryId}`);
      return { success: true, transferredCount };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error transferring employees:', error);
      return { success: false, error: 'Failed to transfer employees' };
    }
  }

  /**
   * Merge territories
   */
  async mergeTerritories(
    sourceIds: string[],
    targetId: string,
    newName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all territories
      const allTerritories = await db.select()
        .from(territories)
        .where(inArray(territories.id, [...sourceIds, targetId]));

      const target = allTerritories.find(t => t.id === targetId);
      if (!target) {
        return { success: false, error: 'Target territory not found' };
      }

      // Update target territory if new name provided
      if (newName) {
        await db.update(territories)
          .set({
            name: newName,
            updatedAt: new Date()
          })
          .where(eq(territories.id, targetId));
      }

      // Transfer all employees to target
      for (const sourceId of sourceIds) {
        await this.transferEmployees(sourceId, targetId);
      }

      // Deactivate source territories
      await db.update(territories)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(inArray(territories.id, sourceIds));

      console.log(`[SUSAN-TERRITORY] Merged ${sourceIds.length} territories into ${targetId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error merging territories:', error);
      return { success: false, error: 'Failed to merge territories' };
    }
  }

  /**
   * Split territory
   */
  async splitTerritory(
    territoryId: string,
    newTerritories: Array<{
      name: string;
      region: string;
      salesManagerId?: string;
      description?: string;
    }>
  ): Promise<{ success: boolean; createdIds?: string[]; error?: string }> {
    try {
      const createdIds: string[] = [];

      // Create new territories
      for (const newTerritory of newTerritories) {
        const result = await this.createTerritory(newTerritory);
        if (result.success && result.territoryId) {
          createdIds.push(result.territoryId);
        }
      }

      // Deactivate original territory
      await db.update(territories)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(territories.id, territoryId));

      console.log(`[SUSAN-TERRITORY] Split territory ${territoryId} into ${createdIds.length} new territories`);
      return { success: true, createdIds };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error splitting territory:', error);
      return { success: false, error: 'Failed to split territory' };
    }
  }

  /**
   * Delete territory
   */
  async deleteTerritory(
    territoryId: string,
    reassignToId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // If reassign territory provided, transfer employees
      if (reassignToId) {
        await this.transferEmployees(territoryId, reassignToId);
      }

      // Soft delete (deactivate)
      await db.update(territories)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(territories.id, territoryId));

      console.log(`[SUSAN-TERRITORY] Deleted territory ${territoryId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error deleting territory:', error);
      return { success: false, error: 'Failed to delete territory' };
    }
  }

  /**
   * Generate territory report
   */
  async generateReport(): Promise<{ success: boolean; report?: any; error?: string }> {
    try {
      const allTerritories = await db.select()
        .from(territories)
        .where(eq(territories.isActive, true));

      // Get employee counts for each territory
      const territoriesWithCounts = await Promise.all(
        allTerritories.map(async (territory) => {
          const employees = await db.select()
            .from(users)
            .where(eq(users.territoryId, territory.id));
          return {
            ...territory,
            employeeCount: employees.length
          };
        })
      );

      const report: {
        totalTerritories: number;
        byRegion: Record<string, {
          count: number;
          employees: number;
        }>;
        totalEmployees: number;
        generatedAt: Date;
      } = {
        totalTerritories: allTerritories.length,
        byRegion: {},
        totalEmployees: territoriesWithCounts.reduce((sum, t) => sum + t.employeeCount, 0),
        generatedAt: new Date()
      };

      // Group by region
      territoriesWithCounts.forEach(territory => {
        if (!report.byRegion[territory.region]) {
          report.byRegion[territory.region] = {
            count: 0,
            employees: 0
          };
        }
        report.byRegion[territory.region].count++;
        report.byRegion[territory.region].employees += territory.employeeCount;
      });

      console.log(`[SUSAN-TERRITORY] Generated territory report`);
      return { success: true, report };
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error generating report:', error);
      return { success: false, error: 'Failed to generate report' };
    }
  }


  /**
   * Send territory notification
   */
  private async sendTerritoryNotification(
    managerId: string,
    territoryId: string,
    type: 'assigned' | 'removed'
  ): Promise<void> {
    try {
      const [manager] = await db.select()
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1);

      const [territory] = await db.select()
        .from(territories)
        .where(eq(territories.id, territoryId))
        .limit(1);

      if (!manager || !territory || !manager.email) return;

      const subject = type === 'assigned' ?
        `Territory Assignment: ${territory.name}` :
        `Territory Removal: ${territory.name}`;

      const managerName = `${manager.firstName} ${manager.lastName}`;

      const html = type === 'assigned' ? `
        <p>Dear ${managerName},</p>
        <p>You have been assigned as the manager of ${territory.name} territory.</p>
        <p>Region: ${territory.region}</p>
        <p>Please log in to view your territory details.</p>
        <p>Best regards,<br>Territory Management</p>
      ` : `
        <p>Dear ${managerName},</p>
        <p>You have been removed as the manager of ${territory.name} territory.</p>
        <p>A new manager will be assigned shortly.</p>
        <p>Best regards,<br>Territory Management</p>
      `;

      await this.emailService.sendEmail({
        to: manager.email,
        subject,
        html
      });

      console.log(`[SUSAN-TERRITORY] Sent ${type} notification to ${manager.email}`);
    } catch (error) {
      console.error('[SUSAN-TERRITORY] Error sending notification:', error);
    }
  }

  /**
   * Parse natural language command
   */
  parseCommand(command: string): TerritoryAction | null {
    const lowerCommand = command.toLowerCase();

    // Create territory
    if (lowerCommand.includes('create territory') || lowerCommand.includes('new territory')) {
      const nameMatch = command.match(/(?:called|named)\s+([^,]+)/i);
      const regionMatch = command.match(/(?:in|region)\s+([^,]+)/i);
      
      return {
        type: 'create_territory',
        data: {
          name: nameMatch?.[1]?.trim() || 'New Territory',
          region: regionMatch?.[1]?.trim() || 'Default'
        }
      };
    }

    // Assign manager
    if (lowerCommand.includes('assign manager')) {
      return { type: 'assign_manager' };
    }

    // Transfer employees
    if (lowerCommand.includes('transfer') || lowerCommand.includes('move employees')) {
      return { type: 'transfer_employees' };
    }

    // Merge territories
    if (lowerCommand.includes('merge')) {
      return { type: 'merge_territories' };
    }

    // Split territory
    if (lowerCommand.includes('split')) {
      return { type: 'split_territory' };
    }

    // Delete territory
    if (lowerCommand.includes('delete territory') || lowerCommand.includes('remove territory')) {
      return { type: 'delete_territory' };
    }

    // Generate report
    if (lowerCommand.includes('territory report') || lowerCommand.includes('territory summary')) {
      return { type: 'generate_report' };
    }

    return null;
  }
}