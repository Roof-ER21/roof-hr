import { db } from '../../db';
import { toolInventory as tools, toolAssignments, users } from '../../../shared/schema';
import { eq, and, or, sql, desc, inArray, like, gte } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface ToolsAction {
  type: 'add_tool' | 'update_tool' | 'assign_tool' | 'return_tool' | 
        'bulk_assign' | 'check_inventory' | 'order_tools' | 'retire_tools' |
        'track_maintenance' | 'generate_report';
  toolId?: string;
  toolIds?: string[];
  data?: any;
}

export class SusanToolsManager {
  private emailService: EmailService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.emailService = new EmailService();
    this.storage = storage;
  }

  /**
   * Add new tool to inventory
   */
  async addTool(data: {
    name: string;
    category: string;
    serialNumber?: string;
    model?: string;
    quantity: number;
    condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
    location?: string;
    purchasePrice?: number;
    notes?: string;
  }): Promise<{ success: boolean; toolId?: string; error?: string }> {
    try {
      const toolId = uuidv4();
      
      await db.insert(tools).values({
        id: toolId,
        name: data.name,
        category: data.category,
        serialNumber: data.serialNumber || `SN-${Date.now()}`,
        model: data.model || '',
        quantity: data.quantity,
        availableQuantity: data.quantity, // Initially all available
        condition: data.condition,
        location: data.location || 'Main Storage',
        purchaseDate: new Date(),
        purchasePrice: data.purchasePrice || 0,
        notes: data.notes || '',
        isActive: true,
        createdBy: 'susan-ai',
        createdAt: new Date()
      });

      console.log(`[SUSAN-TOOLS] Added tool: ${data.name} (${toolId})`);
      return { success: true, toolId };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error adding tool:', error);
      return { success: false, error: 'Failed to add tool' };
    }
  }

  /**
   * Update tool information
   */
  async updateTool(
    toolId: string,
    updates: Partial<{
      name: string;
      quantity: number;
      condition: string;
      location: string;
      notes: string;
      isActive: boolean;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // If quantity is updated, adjust available quantity
      if (updates.quantity !== undefined) {
        const [tool] = await db.select()
          .from(tools)
          .where(eq(tools.id, toolId))
          .limit(1);
        
        if (tool) {
          const assigned = tool.quantity - tool.availableQuantity;
          updates.availableQuantity = Math.max(0, updates.quantity - assigned);
        }
      }

      await db.update(tools)
        .set(updates)
        .where(eq(tools.id, toolId));

      console.log(`[SUSAN-TOOLS] Updated tool ${toolId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error updating tool:', error);
      return { success: false, error: 'Failed to update tool' };
    }
  }

  /**
   * Assign tool to employee
   */
  async assignTool(
    toolId: string,
    employeeId: string,
    quantity: number = 1,
    notes?: string
  ): Promise<{ success: boolean; assignmentId?: string; error?: string }> {
    try {
      // Check availability
      const [tool] = await db.select()
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (!tool || tool.availableQuantity < quantity) {
        return { success: false, error: 'Insufficient quantity available' };
      }

      const assignmentId = uuidv4();
      
      // Update available quantity
      await db.update(tools)
        .set({
          availableQuantity: tool.availableQuantity - quantity
        })
        .where(eq(tools.id, toolId));

      // Send notification
      await this.sendAssignmentNotification(employeeId, tool.name, 'assigned');

      console.log(`[SUSAN-TOOLS] Assigned ${quantity} ${tool.name} to employee ${employeeId}`);
      console.log(`[SUSAN-TOOLS] Assignment ID: ${assignmentId}, Notes: ${notes || 'None'}`);
      return { success: true, assignmentId };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error assigning tool:', error);
      return { success: false, error: 'Failed to assign tool' };
    }
  }

  /**
   * Return tool from employee
   */
  async returnTool(
    assignmentId: string,
    condition?: 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED',
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get assignment details
      const [assignment] = await db.select()
        .from(toolAssignments)
        .where(eq(toolAssignments.id, assignmentId))
        .limit(1);

      if (!assignment || assignment.status !== 'ASSIGNED') {
        return { success: false, error: 'Assignment not found or already returned' };
      }

      // Update assignment
      await db.update(toolAssignments)
        .set({
          returnedAt: new Date(),
          status: 'RETURNED',
          returnCondition: condition || 'GOOD',
          notes: sql`${toolAssignments.notes} || E'\\n[RETURNED] ${notes || 'No issues'}'`
        })
        .where(eq(toolAssignments.id, assignmentId));

      // Update tool availability
      const [tool] = await db.select()
        .from(tools)
        .where(eq(tools.id, assignment.toolId))
        .limit(1);

      if (tool) {
        await db.update(tools)
          .set({
            availableQuantity: tool.availableQuantity + assignment.quantity,
            condition: condition === 'DAMAGED' ? 'POOR' : tool.condition
          })
          .where(eq(tools.id, assignment.toolId));
      }

      console.log(`[SUSAN-TOOLS] Returned tool assignment ${assignmentId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error returning tool:', error);
      return { success: false, error: 'Failed to return tool' };
    }
  }

  /**
   * Bulk assign tools
   */
  async bulkAssignTools(
    toolIds: string[],
    employeeIds: string[],
    quantity: number = 1
  ): Promise<{ success: boolean; assignedCount?: number; error?: string }> {
    try {
      let assignedCount = 0;

      for (const toolId of toolIds) {
        for (const employeeId of employeeIds) {
          const result = await this.assignTool(toolId, employeeId, quantity);
          if (result.success) assignedCount++;
        }
      }

      console.log(`[SUSAN-TOOLS] Bulk assigned ${assignedCount} tools`);
      return { success: true, assignedCount };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error in bulk assign:', error);
      return { success: false, error: 'Failed to bulk assign tools' };
    }
  }

  /**
   * Check inventory levels
   */
  async checkInventory(
    lowThreshold: number = 5
  ): Promise<{ success: boolean; lowStock?: any[]; error?: string }> {
    try {
      const lowStockTools = await db.select()
        .from(tools)
        .where(and(
          sql`${tools.availableQuantity} < ${lowThreshold}`,
          eq(tools.isActive, true)
        ));

      if (lowStockTools.length > 0) {
        // Send low stock alert
        await this.sendInventoryAlert(lowStockTools);
      }

      console.log(`[SUSAN-TOOLS] Found ${lowStockTools.length} tools with low stock`);
      return { success: true, lowStock: lowStockTools };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error checking inventory:', error);
      return { success: false, error: 'Failed to check inventory' };
    }
  }

  /**
   * Order/restock tools
   */
  async orderTools(
    toolId: string,
    quantity: number,
    supplier?: string
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      const orderId = uuidv4();
      
      // Update tool quantity
      const [tool] = await db.select()
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (tool) {
        await db.update(tools)
          .set({
            quantity: tool.quantity + quantity,
            availableQuantity: tool.availableQuantity + quantity,
            notes: sql`${tools.notes} || E'\\n[ORDER] ${quantity} units ordered from ${supplier || 'supplier'}'`
          })
          .where(eq(tools.id, toolId));
      }

      console.log(`[SUSAN-TOOLS] Ordered ${quantity} units of tool ${toolId}`);
      return { success: true, orderId };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error ordering tools:', error);
      return { success: false, error: 'Failed to order tools' };
    }
  }

  /**
   * Retire old tools
   */
  async retireTools(
    condition: 'POOR' | 'DAMAGED'
  ): Promise<{ success: boolean; retiredCount?: number; error?: string }> {
    try {
      const result = await db.update(tools)
        .set({
          isActive: false,
          notes: sql`${tools.notes} || E'\\n[RETIRED] Due to ${condition} condition'`
        })
        .where(and(
          eq(tools.condition, condition),
          eq(tools.isActive, true)
        ));

      console.log(`[SUSAN-TOOLS] Retired tools in ${condition} condition`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error retiring tools:', error);
      return { success: false, error: 'Failed to retire tools' };
    }
  }

  /**
   * Generate tools report
   */
  async generateReport(): Promise<{ success: boolean; report?: any; error?: string }> {
    try {
      const allTools = await db.select().from(tools);
      const assignments = await db.select()
        .from(toolAssignments)
        .where(eq(toolAssignments.status, 'ASSIGNED'));

      const report = {
        totalTools: allTools.length,
        activeTools: allTools.filter(t => t.isActive).length,
        totalQuantity: allTools.reduce((sum, t) => sum + t.quantity, 0),
        availableQuantity: allTools.reduce((sum, t) => sum + t.availableQuantity, 0),
        assignedQuantity: allTools.reduce((sum, t) => sum + (t.quantity - t.availableQuantity), 0),
        byCategory: {},
        byCondition: {
          new: allTools.filter(t => t.condition === 'NEW').length,
          good: allTools.filter(t => t.condition === 'GOOD').length,
          fair: allTools.filter(t => t.condition === 'FAIR').length,
          poor: allTools.filter(t => t.condition === 'POOR').length
        },
        activeAssignments: assignments.length,
        generatedAt: new Date()
      };

      // Group by category
      allTools.forEach(tool => {
        if (!report.byCategory[tool.category]) {
          report.byCategory[tool.category] = { count: 0, quantity: 0 };
        }
        report.byCategory[tool.category].count++;
        report.byCategory[tool.category].quantity += tool.quantity;
      });

      console.log(`[SUSAN-TOOLS] Generated tools report`);
      return { success: true, report };
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error generating report:', error);
      return { success: false, error: 'Failed to generate report' };
    }
  }

  /**
   * Send assignment notification
   */
  private async sendAssignmentNotification(
    employeeId: string,
    toolName: string,
    type: 'assigned' | 'return_reminder'
  ): Promise<void> {
    try {
      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, employeeId))
        .limit(1);

      if (!employee || !employee.email) return;

      const subject = type === 'assigned' ? 
        `Tool Assigned: ${toolName}` : 
        `Reminder: Please Return ${toolName}`;

      const html = type === 'assigned' ? `
        <p>Dear ${employee.name},</p>
        <p>You have been assigned the following tool: ${toolName}</p>
        <p>Please take good care of it and return it when no longer needed.</p>
        <p>Best regards,<br>Equipment Management</p>
      ` : `
        <p>Dear ${employee.name},</p>
        <p>This is a reminder to return the ${toolName} that was assigned to you.</p>
        <p>Please return it as soon as possible.</p>
        <p>Best regards,<br>Equipment Management</p>
      `;

      await this.emailService.sendEmail({
        to: employee.email,
        subject,
        html
      });

      console.log(`[SUSAN-TOOLS] Sent ${type} notification to ${employee.email}`);
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error sending notification:', error);
    }
  }

  /**
   * Send inventory alert
   */
  private async sendInventoryAlert(lowStockTools: any[]): Promise<void> {
    try {
      const toolsList = lowStockTools.map(t => 
        `• ${t.name}: ${t.availableQuantity}/${t.quantity} available`
      ).join('\n');

      await this.emailService.sendEmail({
        to: 'inventory@theroofdocs.com',
        subject: 'Low Stock Alert - Tools Inventory',
        html: `
          <p>The following tools are running low on stock:</p>
          <pre>${toolsList}</pre>
          <p>Please consider ordering more supplies.</p>
          <p>Best regards,<br>Inventory Management System</p>
        `
      });

      console.log(`[SUSAN-TOOLS] Sent inventory alert for ${lowStockTools.length} tools`);
    } catch (error) {
      console.error('[SUSAN-TOOLS] Error sending inventory alert:', error);
    }
  }

  /**
   * Parse natural language command
   */
  parseCommand(command: string): ToolsAction | null {
    const lowerCommand = command.toLowerCase();

    // Add tool - enhanced name and category extraction
    if (lowerCommand.includes('add') && (lowerCommand.includes('tool') || lowerCommand.includes('inventory') || lowerCommand.includes('equipment'))) {
      const quantityMatch = command.match(/(\d+)\s+(?:units?|pieces?|items?)?/i);

      // Try to extract tool name - various patterns
      let toolName = '';
      let category = 'General';

      // Pattern: "add [name] to inventory"
      const toInventoryMatch = command.match(/add\s+(?:a\s+)?(.+?)\s+to\s+(?:the\s+)?inventory/i);
      if (toInventoryMatch) {
        toolName = toInventoryMatch[1].trim();
      }

      // Pattern: "add tool [name]" or "add new tool [name]"
      if (!toolName) {
        const addToolMatch = command.match(/add\s+(?:a\s+)?(?:new\s+)?tool\s+(?:called\s+|named\s+)?([A-Za-z0-9\s]+?)(?:\s+to|\s+in|\s*$)/i);
        if (addToolMatch) {
          toolName = addToolMatch[1].trim();
        }
      }

      // Pattern: "add [quantity] [name]"
      if (!toolName) {
        const qtyNameMatch = command.match(/add\s+(?:\d+\s+)?([A-Za-z][A-Za-z0-9\s]+?)(?:\s+to|\s+in|\s*$)/i);
        if (qtyNameMatch && !qtyNameMatch[1].toLowerCase().includes('tool') && !qtyNameMatch[1].toLowerCase().includes('inventory')) {
          toolName = qtyNameMatch[1].trim();
        }
      }

      // Auto-categorize based on common tool names
      const toolLower = toolName.toLowerCase();
      if (['hammer', 'screwdriver', 'wrench', 'pliers', 'saw'].some(t => toolLower.includes(t))) {
        category = 'Hand Tools';
      } else if (['drill', 'grinder', 'sander', 'jigsaw'].some(t => toolLower.includes(t))) {
        category = 'Power Tools';
      } else if (['ladder', 'scaffold', 'harness', 'rope'].some(t => toolLower.includes(t))) {
        category = 'Safety Equipment';
      } else if (['tape', 'level', 'square', 'ruler'].some(t => toolLower.includes(t))) {
        category = 'Measuring';
      } else if (['nail', 'screw', 'bolt', 'anchor'].some(t => toolLower.includes(t))) {
        category = 'Fasteners';
      }

      // If still no tool name, return prompt for more info
      if (!toolName) {
        return {
          type: 'add_tool',
          data: {
            needsMoreInfo: true,
            message: 'What tool would you like to add? Please specify the tool name.'
          }
        };
      }

      return {
        type: 'add_tool',
        data: {
          name: toolName,
          category: category,
          quantity: quantityMatch ? parseInt(quantityMatch[1]) : 1,
          condition: 'NEW'
        }
      };
    }

    // Assign tool - NOT for employee assignments
    if ((lowerCommand.includes('assign') && lowerCommand.includes('tool')) ||
        (lowerCommand.includes('give') && (lowerCommand.includes('tool') || lowerCommand.includes('equipment')))) {
      const quantityMatch = command.match(/(\d+)\s+(?:units?|pieces?|items?)/i);
      return {
        type: 'assign_tool',
        data: {
          quantity: quantityMatch ? parseInt(quantityMatch[1]) : 1
        }
      };
    }

    // Return tool
    if (lowerCommand.includes('return')) {
      const conditionMatch = lowerCommand.includes('damaged') ? 'DAMAGED' :
                           lowerCommand.includes('poor') ? 'POOR' : 'GOOD';
      return {
        type: 'return_tool',
        data: { condition: conditionMatch }
      };
    }

    // Check inventory
    if (lowerCommand.includes('check inventory') || lowerCommand.includes('low stock')) {
      return { type: 'check_inventory' };
    }

    // Order tools
    if (lowerCommand.includes('order') || lowerCommand.includes('restock')) {
      const quantityMatch = command.match(/(\d+)\s+(?:units?|pieces?|items?)/i);
      return {
        type: 'order_tools',
        data: {
          quantity: quantityMatch ? parseInt(quantityMatch[1]) : 10
        }
      };
    }

    // Generate report
    if (lowerCommand.includes('report') || lowerCommand.includes('summary')) {
      return { type: 'generate_report' };
    }

    return null;
  }
}