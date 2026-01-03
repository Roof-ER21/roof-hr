import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { 
  toolInventory, 
  toolAssignments, 
  toolSignatures,
  users,
  inventoryAlerts,
  welcomePackBundles,
  bundleItems,
  bundleAssignments,
  bundleAssignmentItems,
  insertToolInventorySchema,
  insertToolAssignmentSchema,
  insertToolSignatureSchema,
  insertInventoryAlertSchema,
  insertWelcomePackBundleSchema,
  insertBundleItemSchema,
  insertBundleAssignmentSchema,
  insertBundleAssignmentItemSchema
} from '@shared/schema';
import { eq, and, desc, or, sql, inArray } from 'drizzle-orm';
import sgMail from '@sendgrid/mail';
import { googleSheetsService } from '../services/google-sheets-service';
import { googleDriveService } from '../services/google-drive-service';

const router = Router();

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function checkRole(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Helper function to sync tools inventory with Google Sheets
async function syncToolsToGoogleSheets() {
  try {
    // Initialize the service if not already initialized
    await googleSheetsService.initialize();
    
    // Get all tools from database
    const tools = await db
      .select()
      .from(toolInventory)
      .where(eq(toolInventory.isActive, true));
    
    // Define the proper size order for clothing
    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', '3X', '4X'];
    
    // Helper function to extract size from tool name
    const extractSize = (toolName: string): string | null => {
      const sizeMatch = toolName.match(/ - Size ([A-Z0-9]+)$/);
      return sizeMatch ? sizeMatch[1] : null;
    };
    
    // Helper function to get size order index
    const getSizeIndex = (size: string | null): number => {
      if (!size) return 999; // Items without sizes go to the end
      const index = sizeOrder.indexOf(size);
      return index === -1 ? 999 : index;
    };
    
    // Sort tools with proper size ordering for clothing
    tools.sort((a, b) => {
      // First sort by category
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      
      // For clothing items (POLO and OTHER categories), check if they have sizes
      if (a.category === 'POLO' || a.category === 'OTHER') {
        // Extract base names (without size)
        const aBaseName = a.name.replace(/ - Size [A-Z0-9]+$/, '');
        const bBaseName = b.name.replace(/ - Size [A-Z0-9]+$/, '');
        
        // If same base item, sort by size
        if (aBaseName === bBaseName) {
          const aSize = extractSize(a.name);
          const bSize = extractSize(b.name);
          return getSizeIndex(aSize) - getSizeIndex(bSize);
        }
        
        // Different base items, sort alphabetically by base name
        return aBaseName.localeCompare(bBaseName);
      }
      
      // For non-clothing items, sort alphabetically
      return a.name.localeCompare(b.name);
    });
    
    // Format data for Google Sheets
    const headers = ['ID', 'Name', 'Category', 'Description', 'Serial Number', 'Model', 'Quantity', 'Available', 'Condition', 'Location', 'Purchase Date', 'Purchase Price'];
    const rows = tools.map(tool => [
      tool.id,
      tool.name,
      tool.category,
      tool.description || '',
      tool.serialNumber || '',
      tool.model || '',
      tool.quantity.toString(),
      tool.availableQuantity.toString(),
      tool.condition,
      tool.location || '',
      tool.purchaseDate ? new Date(tool.purchaseDate).toLocaleDateString() : '',
      tool.purchasePrice ? `$${tool.purchasePrice}` : ''
    ]);
    
    // Update or create spreadsheet
    let spreadsheetId = process.env.TOOLS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      // Create new spreadsheet if it doesn't exist
      const spreadsheet = await googleSheetsService.createSpreadsheet('ROOF-ER Tools Inventory', ['Inventory']);
      spreadsheetId = spreadsheet.spreadsheetId;
      console.log('Created new tools spreadsheet:', spreadsheetId);
      // Consider saving this ID to environment variables or database
    }

    // Write data to the spreadsheet (only if spreadsheetId is defined)
    if (spreadsheetId) {
      await googleSheetsService.writeToSpreadsheet(spreadsheetId, 'Inventory!A1', [headers, ...rows]);
    }
    
    console.log('Successfully synced tools to Google Sheets');
  } catch (error) {
    console.error('Error syncing tools to Google Sheets:', error);
    // Don't throw - we don't want to break the API if sync fails
  }
}

// Get all tools inventory
// Supports pagination and search to handle large datasets
router.get('/inventory', async (req, res) => {
  try {
    // Pagination params with defaults
    const limit = Math.min(parseInt(req.query.limit as string) || 1000, 5000);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string)?.toLowerCase() || '';
    const category = req.query.category as string;

    // Build where conditions
    const conditions = [eq(toolInventory.isActive, true)];
    if (category) {
      conditions.push(eq(toolInventory.category, category));
    }
    if (search) {
      conditions.push(
        sql`LOWER(${toolInventory.name}) LIKE ${'%' + search + '%'}`
      );
    }

    const tools = await db
      .select({
        id: toolInventory.id,
        name: toolInventory.name,
        category: toolInventory.category,
        description: toolInventory.description,
        serialNumber: toolInventory.serialNumber,
        model: toolInventory.model,
        quantity: toolInventory.quantity,
        availableQuantity: toolInventory.availableQuantity,
        condition: toolInventory.condition,
        purchaseDate: toolInventory.purchaseDate,
        purchasePrice: toolInventory.purchasePrice,
        location: toolInventory.location,
        notes: toolInventory.notes,
        isActive: toolInventory.isActive,
        createdBy: toolInventory.createdBy,
        createdAt: toolInventory.createdAt,
        creatorName: sql`${users.firstName} || ' ' || ${users.lastName}`.as('creatorName')
      })
      .from(toolInventory)
      .leftJoin(users, eq(toolInventory.createdBy, users.id))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Define the proper size order for clothing
    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', '3X', '4X'];
    
    // Helper function to extract size from tool name
    const extractSize = (toolName: string): string | null => {
      const sizeMatch = toolName.match(/ - Size ([A-Z0-9]+)$/);
      return sizeMatch ? sizeMatch[1] : null;
    };
    
    // Helper function to get size order index
    const getSizeIndex = (size: string | null): number => {
      if (!size) return 999; // Items without sizes go to the end
      const index = sizeOrder.indexOf(size);
      return index === -1 ? 999 : index;
    };
    
    // Sort tools with proper size ordering for clothing
    tools.sort((a, b) => {
      // First sort by category
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      
      // For clothing items (POLO and OTHER categories), check if they have sizes
      if (a.category === 'POLO' || a.category === 'OTHER') {
        // Extract base names (without size)
        const aBaseName = a.name.replace(/ - Size [A-Z0-9]+$/, '');
        const bBaseName = b.name.replace(/ - Size [A-Z0-9]+$/, '');
        
        // If same base item, sort by size
        if (aBaseName === bBaseName) {
          const aSize = extractSize(a.name);
          const bSize = extractSize(b.name);
          return getSizeIndex(aSize) - getSizeIndex(bSize);
        }
        
        // Different base items, sort alphabetically by base name
        return aBaseName.localeCompare(bBaseName);
      }
      
      // For non-clothing items, sort alphabetically
      return a.name.localeCompare(b.name);
    });

    res.json(tools);
  } catch (error) {
    console.error('Error fetching tool inventory:', error);
    res.status(500).json({ error: 'Failed to fetch tool inventory' });
  }
});

// Create new tool (Admin/Manager only)
router.post('/inventory', checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const user = req.user!;

    // Check for duplicate name (case-insensitive to prevent duplicates)
    const existingTool = await db
      .select()
      .from(toolInventory)
      .where(and(
        sql`LOWER(${toolInventory.name}) = LOWER(${req.body.name})`,
        eq(toolInventory.isActive, true)
      ))
      .limit(1);

    if (existingTool.length > 0) {
      return res.status(400).json({
        error: 'A tool with this name already exists (case-insensitive match)',
        existingId: existingTool[0].id,
        existingName: existingTool[0].name
      });
    }

    // Valid categories for tool inventory
    const validCategories = ['LAPTOP', 'LADDER', 'IPAD', 'BOOTS', 'POLO', 'CAR', 'OTHER'] as const;
    type ValidCategory = typeof validCategories[number];

    // Map invalid categories to 'OTHER'
    const category: ValidCategory = validCategories.includes(req.body.category) ? req.body.category : 'OTHER';

    // Transform purchaseDate string to Date object if it exists
    const dataToValidate = {
      ...req.body,
      category,
      purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined
    };

    const validatedData = insertToolInventorySchema.parse(dataToValidate);

    // Explicitly type the values to match schema constraints
    const insertValues: any = {
      id: uuidv4(),
      ...validatedData,
      category,
      createdBy: user.id
    };

    const newTool = await db.insert(toolInventory).values(insertValues).returning();

    // Sync with Google Sheets after creating (non-blocking to prevent slowdowns)
    syncToolsToGoogleSheets().catch(err => console.error('[TOOLS] Sheets sync failed:', err));

    res.json(newTool[0]);
  } catch (error) {
    console.error('Error creating tool:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create tool' });
    }
  }
});

// Update tool (Admin/Manager only)
router.patch('/inventory/:id', checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If name is being changed, check for duplicates (case-insensitive)
    if (updates.name) {
      const existingTool = await db
        .select()
        .from(toolInventory)
        .where(and(
          sql`LOWER(${toolInventory.name}) = LOWER(${updates.name})`,
          eq(toolInventory.isActive, true)
        ))
        .limit(1);

      // Check if there's another tool with this name (not the current one)
      if (existingTool.length > 0 && existingTool[0].id !== id) {
        return res.status(400).json({
          error: 'Another tool with this name already exists (case-insensitive match)',
          existingId: existingTool[0].id,
          existingName: existingTool[0].name
        });
      }
    }

    const updatedTool = await db
      .update(toolInventory)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(toolInventory.id, id))
      .returning();

    if (updatedTool.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Sync with Google Sheets after updating (non-blocking to prevent slowdowns)
    syncToolsToGoogleSheets().catch(err => console.error('[TOOLS] Sheets sync failed:', err));

    res.json(updatedTool[0]);
  } catch (error) {
    console.error('Error updating tool:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// Adjust tool quantity (Admin/Manager only)
router.patch('/inventory/:id/adjust-quantity', checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, notes } = req.body;

    if (typeof adjustment !== 'number') {
      return res.status(400).json({ error: 'Adjustment must be a number' });
    }

    if (!notes || !notes.trim()) {
      return res.status(400).json({ error: 'Notes are required for quantity adjustment' });
    }

    // Get current tool data
    const [currentTool] = await db
      .select()
      .from(toolInventory)
      .where(eq(toolInventory.id, id));

    if (!currentTool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const newQuantity = currentTool.quantity + adjustment;
    const newAvailableQuantity = currentTool.availableQuantity + adjustment;

    if (newQuantity < 0) {
      return res.status(400).json({ error: 'Total quantity cannot be negative' });
    }

    if (newAvailableQuantity < 0) {
      return res.status(400).json({ error: 'Available quantity cannot be negative' });
    }

    // Update tool quantities
    const [updatedTool] = await db
      .update(toolInventory)
      .set({
        quantity: newQuantity,
        availableQuantity: newAvailableQuantity,
        notes: `${currentTool.notes || ''}\n[${new Date().toISOString()}] Quantity adjusted by ${adjustment}: ${notes}`.trim(),
        updatedAt: new Date()
      })
      .where(eq(toolInventory.id, id))
      .returning();

    // Sync with Google Sheets after quantity adjustment (non-blocking to prevent slowdowns)
    syncToolsToGoogleSheets().catch(err => console.error('[TOOLS] Sheets sync failed:', err));

    res.json(updatedTool);
  } catch (error) {
    console.error('Error adjusting tool quantity:', error);
    res.status(500).json({ error: 'Failed to adjust tool quantity' });
  }
});

// Delete tool (Admin/Manager only) - soft delete
router.delete('/inventory/:id', checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tool has active assignments
    const activeAssignments = await db
      .select()
      .from(toolAssignments)
      .where(and(
        eq(toolAssignments.toolId, id),
        eq(toolAssignments.status, 'ASSIGNED')
      ));

    if (activeAssignments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete tool with active assignments' 
      });
    }

    await db
      .update(toolInventory)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(toolInventory.id, id));

    // Sync with Google Sheets after deletion (non-blocking to prevent slowdowns)
    syncToolsToGoogleSheets().catch(err => console.error('[TOOLS] Sheets sync failed:', err));

    res.json({ message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Error deleting tool:', error);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// Sync tools inventory with Google Sheets
router.post('/sync-sheets', checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    await syncToolsToGoogleSheets();
    res.json({ message: 'Tools inventory synced with Google Sheets successfully' });
  } catch (error) {
    console.error('Error syncing with Google Sheets:', error);
    res.status(500).json({ error: 'Failed to sync with Google Sheets' });
  }
});

// Import tools inventory from Google Sheets
router.post('/import-sheets', checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { spreadsheetId } = req.body;
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }
    
    await googleSheetsService.initialize();
    const importedTools = await googleSheetsService.importToolsInventory(spreadsheetId);
    
    // OPTIMIZED: Batch update/insert imported tools
    // First, get all existing tool IDs in one query
    const importedIds = importedTools.map(t => t.id);
    const existingTools = await db
      .select({ id: toolInventory.id })
      .from(toolInventory)
      .where(inArray(toolInventory.id, importedIds));

    const existingIdSet = new Set(existingTools.map(t => t.id));

    // Separate into updates and inserts
    const toUpdate = importedTools.filter(t => existingIdSet.has(t.id));
    const toInsert = importedTools.filter(t => !existingIdSet.has(t.id));

    // Batch update existing tools
    if (toUpdate.length > 0) {
      for (const tool of toUpdate) {
        // Use individual updates but no existence check (we already know they exist)
        await db.update(toolInventory)
          .set({
            quantity: tool.quantity,
            availableQuantity: tool.availableQuantity,
            condition: tool.condition,
            location: tool.location,
            notes: tool.notes,
            updatedAt: new Date()
          })
          .where(eq(toolInventory.id, tool.id));
      }
    }

    // Batch insert new tools
    if (toInsert.length > 0) {
      await db.insert(toolInventory).values(
        toInsert.map(tool => ({
          ...tool,
          createdBy: req.user!.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      );
    }

    const updatedCount = toUpdate.length;
    const createdCount = toInsert.length;
    
    res.json({ 
      message: 'Tools imported from Google Sheets successfully',
      created: createdCount,
      updated: updatedCount,
      total: importedTools.length
    });
  } catch (error) {
    console.error('Error importing from Google Sheets:', error);
    res.status(500).json({ error: 'Failed to import from Google Sheets' });
  }
});

// Get all assignments
router.get('/assignments', async (req, res) => {
  try {
    const assignments = await db
      .select({
        id: toolAssignments.id,
        toolId: toolAssignments.toolId,
        employeeId: toolAssignments.employeeId,
        assignedBy: toolAssignments.assignedBy,
        assignedDate: toolAssignments.assignedDate,
        returnDate: toolAssignments.returnDate,
        status: toolAssignments.status,
        condition: toolAssignments.condition,
        notes: toolAssignments.notes,
        signatureRequired: toolAssignments.signatureRequired,
        signatureReceived: toolAssignments.signatureReceived,
        signatureDate: toolAssignments.signatureDate,
        emailSent: toolAssignments.emailSent,
        toolName: toolInventory.name,
        toolCategory: toolInventory.category,
        toolSerialNumber: toolInventory.serialNumber,
        employeeName: sql`${users.firstName} || ' ' || ${users.lastName}`.as('employeeName'),
        employeeEmail: users.email,
        assignerName: sql`a.first_name || ' ' || a.last_name`.as('assignerName')
      })
      .from(toolAssignments)
      .leftJoin(toolInventory, eq(toolAssignments.toolId, toolInventory.id))
      .leftJoin(users, eq(toolAssignments.employeeId, users.id))
      .leftJoin(sql`users a`, sql`${toolAssignments.assignedBy} = a.id`)
      .orderBy(desc(toolAssignments.assignedDate));

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Create new assignment(s) with email notification
router.post('/assignments', async (req, res) => {
  try {
    const user = req.user!;
    const { employeeId, toolIds, notes } = req.body;

    if (!employeeId || !toolIds || !Array.isArray(toolIds) || toolIds.length === 0) {
      return res.status(400).json({ error: 'Invalid assignment data' });
    }

    // Get employee details
    const [employee] = await db
      .select()
      .from(users)
      .where(eq(users.id, employeeId));

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get tool details
    const tools = await db
      .select()
      .from(toolInventory)
      .where(inArray(toolInventory.id, toolIds));

    if (tools.length !== toolIds.length) {
      return res.status(404).json({ error: 'One or more tools not found' });
    }

    // Create assignments and collect quantity updates
    const assignments = [];
    const assignmentTokens: { [key: string]: string } = {};
    const quantityUpdates: { id: string; newQuantity: number }[] = [];

    for (const toolId of toolIds) {
      const tool = tools.find(t => t.id === toolId);
      if (!tool) continue;

      // Check availability
      if (tool.availableQuantity <= 0) {
        return res.status(400).json({
          error: `Tool "${tool.name}" is not available`
        });
      }

      const assignmentId = uuidv4();
      const signatureToken = uuidv4();

      assignments.push({
        id: assignmentId,
        toolId,
        employeeId,
        assignedBy: user.id,
        condition: 'GOOD' as const,
        notes,
        signatureToken,
        signatureRequired: true,
        signatureReceived: false,
        emailSent: false
      });

      assignmentTokens[assignmentId] = signatureToken;

      // Queue quantity update (will batch after loop)
      quantityUpdates.push({
        id: toolId,
        newQuantity: tool.availableQuantity - 1
      });
    }

    // OPTIMIZED: Batch update all tool quantities in a single query
    if (quantityUpdates.length > 0) {
      const updateCases = quantityUpdates.map(u =>
        sql`WHEN ${toolInventory.id} = ${u.id} THEN ${u.newQuantity}`
      );
      const updateIds = quantityUpdates.map(u => u.id);

      await db.execute(sql`
        UPDATE tool_inventory
        SET available_quantity = CASE ${sql.join(updateCases, sql` `)} END,
            updated_at = NOW()
        WHERE id IN (${sql.join(updateIds.map(id => sql`${id}`), sql`, `)})
      `);
    }

    // Insert all assignments
    const createdAssignments = await db
      .insert(toolAssignments)
      .values(assignments)
      .returning();

    // Send email notification if SendGrid is configured
    if (process.env.SENDGRID_API_KEY && employee.email) {
      const toolsList = tools.map(t => 
        `• ${t.name} (${t.category})${t.serialNumber ? ` - Serial: ${t.serialNumber}` : ''}`
      ).join('\n');

      const signatureLinks = createdAssignments.map(a => {
        const tool = tools.find(t => t.id === a.toolId);
        return `${tool?.name}: ${process.env.VITE_BASE_URL || 'http://localhost:5000'}/tools/signature/${assignmentTokens[a.id]}`;
      }).join('\n');

      const emailContent = {
        to: employee.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@theroofdocs.com',
        subject: 'Equipment Assignment - Signature Required',
        text: `Dear ${employee.firstName} ${employee.lastName},

You have been assigned the following equipment:

${toolsList}

Please review and sign for these items by clicking the links below:

${signatureLinks}

By signing, you acknowledge:
• Receipt of the listed equipment in good working condition
• Responsibility for proper care and maintenance
• Agreement to return items upon request or employment termination

Thank you for your cooperation.

Best regards,
ROOF-ER HR Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Equipment Assignment - Signature Required</h2>
            <p>Dear ${employee.firstName} ${employee.lastName},</p>
            <p>You have been assigned the following equipment:</p>
            <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
              ${tools.map(t => 
                `<li><strong>${t.name}</strong> (${t.category})${t.serialNumber ? ` - Serial: ${t.serialNumber}` : ''}</li>`
              ).join('')}
            </ul>
            <p><strong>Action Required:</strong> Please review and sign for these items:</p>
            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              ${createdAssignments.map(a => {
                const tool = tools.find(t => t.id === a.toolId);
                return `<p><a href="${process.env.VITE_BASE_URL || 'http://localhost:5000'}/tools/signature/${assignmentTokens[a.id]}" 
                  style="color: #1976d2; text-decoration: none; font-weight: bold;">
                  ✅ Sign for ${tool?.name}
                </a></p>`;
              }).join('')}
            </div>
            <p><strong>By signing, you acknowledge:</strong></p>
            <ul>
              <li>Receipt of the listed equipment in good working condition</li>
              <li>Responsibility for proper care and maintenance</li>
              <li>Agreement to return items upon request or employment termination</li>
            </ul>
            <p>Thank you for your cooperation.</p>
            <p>Best regards,<br>ROOF-ER HR Team</p>
          </div>
        `
      };

      try {
        await sgMail.send(emailContent);

        // OPTIMIZED: Batch update all assignments in single query
        const assignmentIds = createdAssignments.map(a => a.id);
        await db
          .update(toolAssignments)
          .set({
            emailSent: true,
            emailSentDate: new Date()
          })
          .where(inArray(toolAssignments.id, assignmentIds));
      } catch (emailError) {
        console.error('Failed to send assignment email:', emailError);
      }
    }

    res.json(createdAssignments);
  } catch (error) {
    console.error('Error creating assignments:', error);
    res.status(500).json({ error: 'Failed to create assignments' });
  }
});

// Return tool
router.post('/assignments/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, notes } = req.body;

    // Get assignment details
    const [assignment] = await db
      .select()
      .from(toolAssignments)
      .where(eq(toolAssignments.id, id));

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Tool is not currently assigned' });
    }

    // Update assignment
    await db
      .update(toolAssignments)
      .set({
        status: 'RETURNED',
        returnDate: new Date(),
        condition: condition || assignment.condition,
        notes: notes ? `${assignment.notes || ''}\nReturn: ${notes}` : assignment.notes,
        updatedAt: new Date()
      })
      .where(eq(toolAssignments.id, id));

    // Update tool availability
    const [tool] = await db
      .select()
      .from(toolInventory)
      .where(eq(toolInventory.id, assignment.toolId));

    if (tool) {
      await db
        .update(toolInventory)
        .set({
          availableQuantity: tool.availableQuantity + 1,
          condition: condition || tool.condition,
          updatedAt: new Date()
        })
        .where(eq(toolInventory.id, tool.id));
    }

    res.json({ message: 'Tool returned successfully' });
  } catch (error) {
    console.error('Error returning tool:', error);
    res.status(500).json({ error: 'Failed to return tool' });
  }
});

// Get signature by token (public endpoint for employees)
router.get('/signature/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const [assignment] = await db
      .select({
        assignment: toolAssignments,
        tool: toolInventory,
        employee: users
      })
      .from(toolAssignments)
      .leftJoin(toolInventory, eq(toolAssignments.toolId, toolInventory.id))
      .leftJoin(users, eq(toolAssignments.employeeId, users.id))
      .where(eq(toolAssignments.signatureToken, token));

    if (!assignment) {
      return res.status(404).json({ error: 'Invalid signature link' });
    }

    if (assignment.assignment.signatureReceived) {
      return res.status(400).json({ error: 'Signature already received' });
    }

    res.json({
      assignmentId: assignment.assignment.id,
      tool: {
        name: assignment.tool?.name,
        category: assignment.tool?.category,
        serialNumber: assignment.tool?.serialNumber,
        model: assignment.tool?.model
      },
      employee: {
        name: `${assignment.employee?.firstName} ${assignment.employee?.lastName}`,
        email: assignment.employee?.email
      }
    });
  } catch (error) {
    console.error('Error fetching signature details:', error);
    res.status(500).json({ error: 'Failed to fetch signature details' });
  }
});

// Submit signature (public endpoint for employees)
router.post('/signature/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { signatureData, signatureType = 'TEXT' } = req.body;

    if (!signatureData) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    const [assignment] = await db
      .select()
      .from(toolAssignments)
      .where(eq(toolAssignments.signatureToken, token));

    if (!assignment) {
      return res.status(404).json({ error: 'Invalid signature link' });
    }

    if (assignment.signatureReceived) {
      return res.status(400).json({ error: 'Signature already received' });
    }

    // Create signature record
    await db.insert(toolSignatures).values({
      id: uuidv4(),
      assignmentId: assignment.id,
      employeeId: assignment.employeeId,
      signatureData,
      signatureType,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
      acknowledgedTerms: true
    });

    // Update assignment
    await db
      .update(toolAssignments)
      .set({
        signatureReceived: true,
        signatureDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(toolAssignments.id, assignment.id));

    res.json({ message: 'Signature received successfully' });
  } catch (error) {
    console.error('Error submitting signature:', error);
    res.status(500).json({ error: 'Failed to submit signature' });
  }
});

// Get assignments for a specific employee
router.get('/assignments/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    const assignments = await db
      .select({
        assignment: toolAssignments,
        tool: toolInventory
      })
      .from(toolAssignments)
      .leftJoin(toolInventory, eq(toolAssignments.toolId, toolInventory.id))
      .where(eq(toolAssignments.employeeId, employeeId))
      .orderBy(desc(toolAssignments.assignedDate));

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching employee assignments:', error);
    res.status(500).json({ error: 'Failed to fetch employee assignments' });
  }
});

// ============= INVENTORY ALERTS =============

// Get all inventory alerts
router.get('/alerts', requireAuth, checkRole(['ADMIN', 'MANAGER', 'TRUE_ADMIN']), async (req, res) => {
  try {
    const alerts = await db
      .select({
        alert: inventoryAlerts,
        tool: toolInventory
      })
      .from(inventoryAlerts)
      .leftJoin(toolInventory, eq(inventoryAlerts.toolId, toolInventory.id))
      .orderBy(inventoryAlerts.createdAt);

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    res.status(500).json({ error: 'Failed to fetch inventory alerts' });
  }
});

// Create or update inventory alert
router.post('/alerts', requireAuth, checkRole(['ADMIN', 'MANAGER', 'TRUE_ADMIN']), async (req, res) => {
  try {
    const user = req.user!;
    const { toolId, thresholdQuantity, alertRecipients } = req.body;

    // Check if alert already exists for this tool
    const existingAlert = await db
      .select()
      .from(inventoryAlerts)
      .where(eq(inventoryAlerts.toolId, toolId))
      .limit(1);

    if (existingAlert.length > 0) {
      // Update existing alert
      const [updated] = await db
        .update(inventoryAlerts)
        .set({
          thresholdQuantity,
          alertRecipients,
          updatedAt: new Date()
        })
        .where(eq(inventoryAlerts.toolId, toolId))
        .returning();
      
      res.json(updated);
    } else {
      // Create new alert
      const [created] = await db
        .insert(inventoryAlerts)
        .values({
          id: uuidv4(),
          toolId,
          thresholdQuantity,
          alertRecipients,
          alertEnabled: true,
          createdBy: user.id
        })
        .returning();

      res.json(created);
    }
  } catch (error) {
    console.error('Error creating/updating inventory alert:', error);
    res.status(500).json({ error: 'Failed to create/update inventory alert' });
  }
});

// Check and send inventory alerts
router.post('/alerts/check', requireAuth, checkRole(['ADMIN', 'MANAGER', 'TRUE_ADMIN']), async (req, res) => {
  try {
    // Get all active alerts
    const alerts = await db
      .select({
        alert: inventoryAlerts,
        tool: toolInventory
      })
      .from(inventoryAlerts)
      .leftJoin(toolInventory, eq(inventoryAlerts.toolId, toolInventory.id))
      .where(eq(inventoryAlerts.alertEnabled, true));

    const triggeredAlerts = [];
    const triggeredAlertIds: string[] = [];

    for (const { alert, tool } of alerts) {
      if (tool && tool.availableQuantity <= alert.thresholdQuantity) {
        triggeredAlerts.push({
          tool: tool.name,
          currentQuantity: tool.availableQuantity,
          threshold: alert.thresholdQuantity,
          recipients: alert.alertRecipients
        });

        // Collect alert ID for batch update
        triggeredAlertIds.push(alert.id);
      }
    }

    // OPTIMIZED: Batch update all triggered alert timestamps in single query
    if (triggeredAlertIds.length > 0) {
      await db
        .update(inventoryAlerts)
        .set({ lastAlertSent: new Date() })
        .where(inArray(inventoryAlerts.id, triggeredAlertIds));
    }

    res.json({
      message: `Checked ${alerts.length} alerts, ${triggeredAlerts.length} triggered`,
      triggeredAlerts
    });
  } catch (error) {
    console.error('Error checking inventory alerts:', error);
    res.status(500).json({ error: 'Failed to check inventory alerts' });
  }
});

// ============= WELCOME PACK BUNDLES =============

// Get all bundles
// OPTIMIZED: Fetches all data in 3 queries instead of N+1 pattern
router.get('/bundles', requireAuth, async (req, res) => {
  try {
    // Query 1: Fetch all active bundles
    const bundles = await db
      .select()
      .from(welcomePackBundles)
      .where(eq(welcomePackBundles.isActive, true))
      .orderBy(welcomePackBundles.name);

    if (bundles.length === 0) {
      return res.json([]);
    }

    // Query 2: Fetch ALL bundle items in ONE query (fixes N+1)
    const bundleIds = bundles.map(b => b.id);
    const allBundleItems = await db
      .select()
      .from(bundleItems)
      .where(inArray(bundleItems.bundleId, bundleIds))
      .orderBy(bundleItems.itemName);

    // Group items by bundleId in memory
    const itemsByBundleId = new Map<string, typeof allBundleItems>();
    for (const item of allBundleItems) {
      const existing = itemsByBundleId.get(item.bundleId) || [];
      existing.push(item);
      itemsByBundleId.set(item.bundleId, existing);
    }

    // Query 3: Fetch ONLY active inventory items (not all 650K duplicates!)
    const inventory = await db
      .select()
      .from(toolInventory)
      .where(eq(toolInventory.isActive, true));

    // Build bundles with enriched items (all in-memory, no more queries)
    const bundlesWithItems = bundles.map(bundle => {
      const items = itemsByBundleId.get(bundle.id) || [];

      const enrichedItems = items.map(item => {
        let availableQuantity = 0;
        let matchedInventoryItem = null;
        let availableBySize: any = {};

        // For clothing items, get availability per size
        if (item.itemCategory === 'CLOTHING' || item.itemCategory === 'POLO') {
          // Find all matching items by name pattern
          const matchingItems = inventory.filter(inv => {
            const invNameLower = inv.name.toLowerCase();
            const itemNameLower = item.itemName.toLowerCase();

            // Handle "Light" vs "light" variations
            const normalizedItemName = itemNameLower.replace(' light ', ' Light ');

            // Check if inventory name contains the item name
            return invNameLower.includes(normalizedItemName) ||
                   invNameLower.includes(itemNameLower);
          });

          // Build size availability map
          matchingItems.forEach(inv => {
            // Extract size from name (e.g., "Black Polo (Size XL)" -> "XL")
            const sizeMatch = inv.name.match(/\(Size ([^)]+)\)/);
            if (sizeMatch) {
              const size = sizeMatch[1];
              availableBySize[size] = (availableBySize[size] || 0) + inv.availableQuantity;
            }
          });

          // For display: show minimum available across all sizes
          const sizeCounts = Object.values(availableBySize) as number[];
          availableQuantity = sizeCounts.length > 0 ? Math.min(...sizeCounts) : 0;

          // Item is available if at least one size has enough quantity
          const hasAnySizeAvailable = Object.values(availableBySize).some((count: any) => count >= item.quantity);

          return {
            ...item,
            availableQuantity,
            availableBySize,
            isAvailable: hasAnySizeAvailable
          };
        } else {
          // For non-clothing items, exact match or special cases
          matchedInventoryItem = inventory.find(inv =>
            inv.name === item.itemName ||
            (item.itemName === 'Ladder' && inv.id === 'ladder-utility') ||
            (item.itemName === 'iPad only (New)' && inv.id === 'ipad-new')
          );
          availableQuantity = matchedInventoryItem?.availableQuantity || 0;

          return {
            ...item,
            availableQuantity,
            isAvailable: availableQuantity >= item.quantity
          };
        }
      });

      return { ...bundle, items: enrichedItems };
    });

    res.json(bundlesWithItems);
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

// Create bundle
router.post('/bundles', requireAuth, checkRole(['ADMIN', 'MANAGER', 'TRUE_ADMIN']), async (req, res) => {
  try {
    const user = req.user!;
    const { name, description, items } = req.body;

    // Create bundle
    const [bundle] = await db
      .insert(welcomePackBundles)
      .values({
        id: uuidv4(),
        name,
        description,
        createdBy: user.id
      })
      .returning();

    // Create bundle items
    if (items && items.length > 0) {
      await db
        .insert(bundleItems)
        .values(
          items.map((item: any) => ({
            id: uuidv4(),
            bundleId: bundle.id,
            itemName: item.itemName,
            itemCategory: item.itemCategory,
            quantity: item.quantity,
            requiresSize: item.requiresSize,
            notes: item.notes
          }))
        );
    }

    res.json(bundle);
  } catch (error) {
    console.error('Error creating bundle:', error);
    res.status(500).json({ error: 'Failed to create bundle' });
  }
});

// Assign bundle to employee
router.post('/bundles/assign', requireAuth, checkRole(['ADMIN', 'MANAGER', 'TRUE_ADMIN']), async (req, res) => {
  try {
    const user = req.user!;
    const { bundleId, employeeId, itemSelections } = req.body;

    // Get employee details including shirt size
    const [employee] = await db
      .select()
      .from(users)
      .where(eq(users.id, employeeId))
      .limit(1);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Create bundle assignment
    const [assignment] = await db
      .insert(bundleAssignments)
      .values({
        id: uuidv4(),
        bundleId,
        employeeId,
        assignedBy: user.id,
        status: 'PENDING'
      })
      .returning();

    // Get bundle items
    const items = await db
      .select()
      .from(bundleItems)
      .where(eq(bundleItems.bundleId, bundleId));

    // OPTIMIZED: Pre-fetch all active inventory in one query
    const allInventory = await db
      .select()
      .from(toolInventory)
      .where(eq(toolInventory.isActive, true));

    // Process each item in the bundle (in-memory lookups, no N+1)
    const assignmentItems = [];
    const inventoryUpdates: { id: string; reduceBy: number }[] = [];

    for (const item of items) {
      let toolId = null;
      let size = null;

      // If item requires size (clothing), use employee's shirt size or provided selection
      if (item.requiresSize) {
        size = itemSelections?.[item.id]?.size || employee.shirtSize;

        if (!size) {
          continue; // Skip if no size available
        }

        // FIXED: Use parameterized ILIKE pattern (prevents SQL injection)
        const sizePattern = size.toLowerCase();
        const inventoryItem = allInventory.find(inv =>
          inv.category === item.itemCategory &&
          inv.name.toLowerCase().includes(sizePattern) &&
          inv.availableQuantity >= item.quantity
        );

        if (inventoryItem) {
          toolId = inventoryItem.id;

          // Queue inventory update
          inventoryUpdates.push({
            id: inventoryItem.id,
            reduceBy: item.quantity
          });

          // Reduce in-memory to handle multiple items needing same tool
          inventoryItem.availableQuantity -= item.quantity;
        }
      } else {
        // For non-clothing items, find by category (in-memory)
        const inventoryItem = allInventory.find(inv =>
          inv.category === item.itemCategory &&
          inv.availableQuantity >= item.quantity
        );

        if (inventoryItem) {
          toolId = inventoryItem.id;

          // Queue inventory update
          inventoryUpdates.push({
            id: inventoryItem.id,
            reduceBy: item.quantity
          });

          // Reduce in-memory to handle multiple items needing same tool
          inventoryItem.availableQuantity -= item.quantity;
        }
      }

      // Create assignment item record
      assignmentItems.push({
        id: uuidv4(),
        assignmentId: assignment.id,
        bundleItemId: item.id,
        toolId,
        size,
        quantity: item.quantity,
        status: toolId ? 'ASSIGNED' : 'UNAVAILABLE'
      });
    }

    // Insert assignment items
    if (assignmentItems.length > 0) {
      await db.insert(bundleAssignmentItems).values(assignmentItems as any);
    }

    // OPTIMIZED: Batch update all inventory quantities
    // Group updates by tool ID to combine reductions
    const updatesByToolId = new Map<string, number>();
    for (const update of inventoryUpdates) {
      const current = updatesByToolId.get(update.id) || 0;
      updatesByToolId.set(update.id, current + update.reduceBy);
    }

    if (updatesByToolId.size > 0) {
      // Batch inventory update
      const updateCases = Array.from(updatesByToolId.entries()).map(([id, reduceBy]) =>
        sql`WHEN ${toolInventory.id} = ${id} THEN ${toolInventory.availableQuantity} - ${reduceBy}`
      );
      const updateIds = Array.from(updatesByToolId.keys());

      await db.execute(sql`
        UPDATE tool_inventory
        SET available_quantity = CASE ${sql.join(updateCases, sql` `)} END,
            updated_at = NOW()
        WHERE id IN (${sql.join(updateIds.map(id => sql`${id}`), sql`, `)})
      `);

      // Batch insert all tool assignments
      const toolAssignmentValues = inventoryUpdates.map(update => ({
        id: uuidv4(),
        toolId: update.id,
        employeeId,
        assignedBy: user.id,
        condition: 'NEW' as const,
        notes: `Assigned as part of bundle: ${bundleId}`
      }));

      await db.insert(toolAssignments).values(toolAssignmentValues);
    }

    // Update assignment status
    const allAssigned = assignmentItems.every(item => item.status === 'ASSIGNED');
    const someAssigned = assignmentItems.some(item => item.status === 'ASSIGNED');

    await db
      .update(bundleAssignments)
      .set({
        status: allAssigned ? 'FULFILLED' : someAssigned ? 'PARTIALLY_FULFILLED' : 'PENDING',
        updatedAt: new Date()
      })
      .where(eq(bundleAssignments.id, assignment.id));

    res.json({ 
      assignment, 
      items: assignmentItems,
      message: allAssigned 
        ? 'Bundle fully assigned' 
        : someAssigned 
          ? 'Bundle partially assigned - some items unavailable'
          : 'Bundle assignment pending - items unavailable'
    });
  } catch (error) {
    console.error('Error assigning bundle:', error);
    res.status(500).json({ error: 'Failed to assign bundle' });
  }
});

// Get bundle assignments
router.get('/bundles/assignments', requireAuth, async (req, res) => {
  try {
    const assignments = await db
      .select({
        assignment: bundleAssignments,
        bundle: welcomePackBundles,
        employee: users
      })
      .from(bundleAssignments)
      .leftJoin(welcomePackBundles, eq(bundleAssignments.bundleId, welcomePackBundles.id))
      .leftJoin(users, eq(bundleAssignments.employeeId, users.id))
      .orderBy(desc(bundleAssignments.assignedDate));

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching bundle assignments:', error);
    res.status(500).json({ error: 'Failed to fetch bundle assignments' });
  }
});

// ============================================================================
// ADMIN: Deduplicate Tools (cleanup massive duplicates)
// ============================================================================
router.post('/admin/deduplicate', checkRole(['ADMIN']), async (req, res) => {
  try {
    const { dryRun = true } = req.body;
    const user = req.user!;

    console.log(`[TOOL DEDUP] Starting deduplication (dryRun: ${dryRun}) by ${user.email}`);

    // Get all active tools
    const allTools = await db
      .select()
      .from(toolInventory)
      .where(eq(toolInventory.isActive, true))
      .orderBy(toolInventory.createdAt);

    // Group by name
    const toolsByName = new Map<string, typeof allTools>();
    for (const tool of allTools) {
      const existing = toolsByName.get(tool.name) || [];
      existing.push(tool);
      toolsByName.set(tool.name, existing);
    }

    // Find duplicates (keep oldest, delete rest)
    const toDelete: string[] = [];
    const kept: { name: string; id: string; count: number }[] = [];

    for (const [name, tools] of toolsByName) {
      if (tools.length > 1) {
        // Sort by createdAt ascending, keep first (oldest)
        tools.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const keepId = tools[0].id;
        const deleteIds = tools.slice(1).map(t => t.id);
        toDelete.push(...deleteIds);
        kept.push({ name, id: keepId, count: tools.length });
      }
    }

    const stats = {
      totalTools: allTools.length,
      uniqueNames: toolsByName.size,
      duplicatesToDelete: toDelete.length,
      willKeep: toolsByName.size,
      dryRun
    };

    console.log(`[TOOL DEDUP] Stats: ${JSON.stringify(stats)}`);

    if (!dryRun && toDelete.length > 0) {
      // Delete in batches of 1000 to avoid query size limits
      const batchSize = 1000;
      let deleted = 0;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        await db.delete(toolInventory).where(inArray(toolInventory.id, batch));
        deleted += batch.length;
        console.log(`[TOOL DEDUP] Deleted batch ${Math.floor(i/batchSize) + 1}: ${deleted}/${toDelete.length}`);
      }
      console.log(`[TOOL DEDUP] Completed: Deleted ${deleted} duplicate tools`);
    }

    res.json({
      success: true,
      message: dryRun
        ? `Dry run: Would delete ${toDelete.length} duplicates, keeping ${toolsByName.size} unique tools`
        : `Deleted ${toDelete.length} duplicates, kept ${toolsByName.size} unique tools`,
      stats,
      kept: kept.slice(0, 20), // Show first 20 for preview
      deletedBy: user.email
    });
  } catch (error) {
    console.error('[TOOL DEDUP] Error:', error);
    res.status(500).json({ error: 'Failed to deduplicate tools', details: (error as Error).message });
  }
});

export default router;