import { db } from '../server/db.js';
import { toolInventory } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Inventory Data from January 19, 2026 PDF
const inventoryItems = [
  // WOMEN'S SHIRTS - SHORT SLEEVE
  { name: "Women's SS White Shirt", category: 'CLOTHING', subcategory: 'SHIRT', description: "Women's short sleeve white shirt", sizes: { XS: 2, S: 1 }, location: 'Clothing Storage' },
  { name: "Women's SS Black Shirt", category: 'CLOTHING', subcategory: 'SHIRT', description: "Women's short sleeve black shirt", sizes: { S: 4 }, location: 'Clothing Storage' },

  // WOMEN'S SHIRTS - LONG SLEEVE
  { name: "Women's LS Black Shirt", category: 'CLOTHING', subcategory: 'SHIRT', description: "Women's long sleeve black shirt", sizes: { S: 4, M: 3 }, location: 'Clothing Storage' },

  // ROOF-ER SHIRTS - LONG SLEEVE
  { name: 'Roof-ER LS Grey Shirt', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Roof-ER long sleeve grey shirt', sizes: { M: 19, L: 29, XL: 22, XXL: 2 }, location: 'Clothing Storage' },
  { name: 'Roof-ER LS Black Shirt', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Roof-ER long sleeve black shirt', sizes: { M: 19, L: 29, XL: 19, XXL: 6 }, location: 'Clothing Storage' },
  { name: 'Roof-ER LS Red Shirt', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Roof-ER long sleeve red shirt', sizes: { M: 9, L: 2, XL: 4 }, location: 'Clothing Storage' },

  // ROOF-ER SHIRTS - SHORT SLEEVE
  { name: 'Roof-ER SS Grey Shirt', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Roof-ER short sleeve grey shirt', sizes: { S: 10, M: 9, L: 6, XL: 25, XXL: 9 }, location: 'Clothing Storage' },
  { name: 'Roof-ER SS Black Shirt', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Roof-ER short sleeve black shirt', sizes: { S: 10, M: 1, L: 0, XL: 23, XXL: 10 }, location: 'Clothing Storage' },

  // ROOF-ER JACKETS
  { name: 'Roof-ER Jacket w/ Insert Black', category: 'CLOTHING', subcategory: 'OUTERWEAR', description: 'Roof-ER jacket with insert - black', sizes: { S: 6, M: 5, L: 6, XL: 4, XXL: 4, '3X': 2 }, location: 'Clothing Storage' },

  // ACCESSORIES
  { name: 'Roof-ER Caps', category: 'CLOTHING', subcategory: 'ACCESSORIES', description: 'Roof-ER branded caps', quantity: 28, location: 'Clothing Storage' },
  { name: 'Roof-ER Beanies', category: 'CLOTHING', subcategory: 'ACCESSORIES', description: 'Roof-ER branded beanies', quantity: 13, location: 'Clothing Storage' },

  // GAF SHIRTS
  { name: 'GAF LS Cotton Grey Shirt', category: 'CLOTHING', subcategory: 'SHIRT', description: 'GAF long sleeve cotton grey shirt', sizes: { S: 35, M: 95, L: 189, XL: 79 }, location: 'Clothing Storage' },

  // LANYARDS
  { name: 'Lanyards', category: 'OTHER', description: 'Company branded lanyards', quantity: 50, location: 'Office Supplies' },

  // PLASTIC FOLDERS
  { name: 'Plastic Folders', category: 'OTHER', description: 'Plastic document folders', quantity: 100, location: 'Office Supplies' },

  // YARD SIGNS
  { name: 'Yard Signs', category: 'OTHER', description: 'Company yard signs for job sites', quantity: 25, location: 'Marketing Storage' },

  // LADDERS
  { name: 'Little Giant Ladder (Unboxed)', category: 'LADDER', description: 'Little Giant multi-position ladder - unboxed', quantity: 4, location: 'Equipment Storage' },
  { name: 'Little Giant Ladder (Boxed)', category: 'LADDER', description: 'Little Giant multi-position ladder - new in box', quantity: 7, location: 'Equipment Storage' },
  { name: 'Werner Ladder', category: 'LADDER', description: 'Werner extension ladder', quantity: 1, location: 'Equipment Storage' },
  { name: 'Telescope Ladder', category: 'LADDER', description: 'Telescoping ladder', quantity: 3, location: 'Equipment Storage' },

  // OFFICE SUPPLIES
  { name: 'Black Pens', category: 'OTHER', description: 'Black writing pens', quantity: 50, location: 'Office Supplies' },
  { name: 'Silver Markers', category: 'OTHER', description: 'Silver permanent markers', quantity: 30, location: 'Office Supplies' },
  { name: 'White Paint Pens', category: 'OTHER', description: 'White acrylic paint pens', quantity: 10, location: 'Office Supplies' },
  { name: 'Black Labels (Rolls)', category: 'OTHER', description: 'Black label rolls', quantity: 5, location: 'Office Supplies' },

  // INSURANCE TEAM SUPPLIES
  { name: 'Insurance Folders', category: 'OTHER', description: 'Insurance document folders', quantity: 75, location: 'Insurance Team Storage' },
  { name: 'Claim Forms Pack', category: 'OTHER', description: 'Insurance claim forms pack', quantity: 20, location: 'Insurance Team Storage' },

  // EQUIPMENT
  { name: 'iPad (New)', category: 'IPAD', description: 'New iPad for field use', quantity: 8, location: 'Equipment Storage' },
  { name: 'iPad (Returned)', category: 'IPAD', description: 'Returned iPad with keyboard', quantity: 1, location: 'Equipment Storage' },
  { name: 'Keyboard Case', category: 'IPAD', description: 'iPad keyboard case', quantity: 7, location: 'Equipment Storage' },
  { name: 'Flashlight Set (New)', category: 'OTHER', description: 'New flashlight set', quantity: 9, location: 'Equipment Storage' },
  { name: 'Flashlight Set (Open Box)', category: 'OTHER', description: 'Open box flashlight set', quantity: 1, location: 'Equipment Storage' },
  { name: 'Screen Protector 2-Pack', category: 'OTHER', description: 'Glass screen protector 2-pack', quantity: 12, location: 'Equipment Storage' },
  { name: 'Charging Cubes', category: 'OTHER', description: 'USB charging cubes', quantity: 6, location: 'Equipment Storage' },
];

async function updateInventory() {
  console.log('='.repeat(60));
  console.log('INVENTORY UPDATE - January 19, 2026');
  console.log('='.repeat(60));
  console.log('Starting inventory update...\n');

  try {
    // Mark all existing items as inactive first
    console.log('Step 1: Marking existing inventory as inactive...');
    await db.update(toolInventory).set({
      isActive: false,
      updatedAt: new Date()
    });
    console.log('✓ Existing inventory marked as inactive\n');

    let totalItemsCreated = 0;
    let totalQuantity = 0;

    // Process each inventory item
    console.log('Step 2: Adding new inventory items...\n');

    for (const item of inventoryItems) {
      if (item.sizes) {
        // For clothing items with sizes, create separate entries for each size
        for (const [size, qty] of Object.entries(item.sizes)) {
          if (qty > 0) {
            const toolData = {
              id: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}-${size.toLowerCase()}`,
              name: `${item.name} (Size ${size})`,
              category: item.category === 'CLOTHING' ? 'POLO' : item.category,
              description: `${item.description} - Size ${size}`,
              serialNumber: `INV-${item.category}-${size}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              model: item.name,
              quantity: qty,
              availableQuantity: qty,
              condition: 'NEW',
              size: size as any,
              purchaseDate: new Date(),
              purchasePrice: 0,
              location: item.location,
              notes: `Updated from inventory list on January 19, 2026`,
              isActive: true,
              createdBy: 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', // Ahmed Admin ID
              createdAt: new Date(),
              updatedAt: new Date()
            };

            await db.insert(toolInventory).values(toolData);
            console.log(`  ✓ Added: ${toolData.name} - Qty: ${qty}`);
            totalItemsCreated++;
            totalQuantity += qty;
          }
        }
      } else {
        // For non-clothing items, create a single entry
        const qty = item.quantity || 1;
        const toolData = {
          id: item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
          name: item.name,
          category: item.category,
          description: item.description,
          serialNumber: `INV-${item.category}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          model: item.name,
          quantity: qty,
          availableQuantity: qty,
          condition: item.name.includes('Open Box') || item.name.includes('Returned') || item.name.includes('Unboxed') ? 'GOOD' : 'NEW',
          purchaseDate: new Date(),
          purchasePrice: 0,
          location: item.location,
          notes: `Updated from inventory list on January 19, 2026`,
          isActive: true,
          createdBy: 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', // Ahmed Admin ID
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await db.insert(toolInventory).values(toolData);
        console.log(`  ✓ Added: ${toolData.name} - Qty: ${qty}`);
        totalItemsCreated++;
        totalQuantity += qty;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('INVENTORY UPDATE COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total items created: ${totalItemsCreated}`);
    console.log(`Total quantity: ${totalQuantity}`);

    // Get summary by category
    const allTools = await db.select().from(toolInventory).where(eq(toolInventory.isActive, true));

    console.log(`\nActive items in database: ${allTools.length}`);

    // Count by category
    const categoryCounts: Record<string, { count: number; quantity: number }> = {};
    for (const tool of allTools) {
      if (!categoryCounts[tool.category]) {
        categoryCounts[tool.category] = { count: 0, quantity: 0 };
      }
      categoryCounts[tool.category].count++;
      categoryCounts[tool.category].quantity += tool.quantity;
    }

    console.log('\nBreakdown by category:');
    for (const [category, data] of Object.entries(categoryCounts).sort()) {
      console.log(`  ${category}: ${data.count} items (${data.quantity} total qty)`);
    }

    console.log('\n✓ Inventory update completed successfully!');

  } catch (error) {
    console.error('\n✗ Error updating inventory:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

updateInventory();
