import { db } from '../server/db.js';
import { toolInventory } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Parse the inventory data
const inventoryItems = [
  // CLOTHING - SHIRTS
  { name: 'Short-sleeved Black Cotton Shirt', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Black cotton short-sleeved shirt', sizes: { M: 5 }, location: 'Clothing Storage' },
  { name: 'Grey Polo', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Grey polo shirt', sizes: { M: 22, L: 16, XL: 22, XXL: 23, '3X': 15 }, location: 'Clothing Storage' },
  { name: 'Black Polo', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Black polo shirt', sizes: { M: 21, L: 14, XL: 19, XXL: 21, '3X': 15 }, location: 'Clothing Storage' },
  { name: 'Grey Light Quarter Zip', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Grey light quarter zip pullover', sizes: { S: 1, M: 1, L: 0, XL: 5, XXL: 7, '3X': 1, 'USED XXL': 1 }, location: 'Clothing Storage' },
  { name: 'Black Light Quarter Zip', category: 'CLOTHING', subcategory: 'SHIRT', description: 'Black light quarter zip pullover', sizes: { S: 0, M: 0, L: 0, XL: 1, XXL: 10, '3X': 0, 'USED XXL': 1 }, location: 'Clothing Storage' },
  
  // CLOTHING - OUTERWEAR
  { name: 'Black Under Armor/Port Authority Zip Up (Shell and Lining)', category: 'CLOTHING', subcategory: 'OUTERWEAR', description: 'Black zip up jacket with shell and lining', sizes: { M: 0, L: 3, XL: 0, XXL: 0, '3X': 1 }, location: 'Top Shelf' },
  { name: 'Black Under Armor/Port Authority Zip Up (Shell only)', category: 'CLOTHING', subcategory: 'OUTERWEAR', description: 'Black zip up jacket shell only', sizes: { L: 2, XL: 1, XXL: 1, '3X': 1 }, location: 'Top Shelf' },
  { name: 'Red Under Armor/Port Authority Zip Up (Shell and Lining)', category: 'CLOTHING', subcategory: 'OUTERWEAR', description: 'Red zip up jacket with shell and lining', sizes: { L: 3, XL: 1, XXL: 2 }, location: 'Top Shelf' },
  
  // ACCESSORIES
  { name: 'Beanies', category: 'CLOTHING', subcategory: 'ACCESSORIES', description: 'Winter beanies', quantity: 9, location: 'Clothing Storage' },
  { name: 'Baseball Caps', category: 'CLOTHING', subcategory: 'ACCESSORIES', description: 'Baseball caps', quantity: 2, location: 'Clothing Storage' },
  
  // EQUIPMENT
  { name: 'iPad only (New)', category: 'IPAD', description: 'New iPad without accessories', quantity: 8, location: 'Middle Black Cabinet' },
  { name: 'Returned iPad (w/ Keyboard)', category: 'IPAD', description: 'Returned iPad with keyboard', quantity: 1, location: 'Middle Black Cabinet' },
  { name: 'Flashlight Set', category: 'OTHER', description: 'New flashlight set', quantity: 9, location: 'Middle Black Cabinet' },
  { name: 'Flashlight Set (Open Box)', category: 'OTHER', description: 'Open box flashlight set', quantity: 1, location: 'Middle Black Cabinet' },
  { name: 'Flashlight Old', category: 'OTHER', description: 'Old model flashlight', quantity: 1, location: 'Middle Black Cabinet' },
  { name: 'Glass Screen Protector (2 pack)', category: 'OTHER', description: '2-pack glass screen protectors', quantity: 12, location: 'Middle Black Cabinet' },
  { name: 'Glass Screen Protector (Single)', category: 'OTHER', description: 'Single glass screen protector', quantity: 1, location: 'Middle Black Cabinet' },
  { name: 'Keyboard Case (w/o iPad)', category: 'IPAD', description: 'Keyboard case without iPad', quantity: 7, location: 'Middle Black Cabinet' },
  { name: 'Charging Cubes', category: 'OTHER', description: 'USB charging cubes', quantity: 6, location: 'Middle Black Cabinet' },
  { name: 'Ladder', category: 'LADDER', description: 'Work ladder', quantity: 1, location: 'Utility Closet' },
  
  // OFFICE SUPPLIES
  { name: 'Black Labels (Rolls)', category: 'OTHER', description: 'Black label rolls', quantity: 3, location: 'Middle Black Cabinet' },
  { name: 'Silver Markers', category: 'OTHER', description: 'Silver permanent markers', quantity: 32, location: 'Middle Black Cabinet' },
  { name: 'White Acrylic Paint Pens', category: 'OTHER', description: 'White acrylic paint pens', quantity: 5, location: 'Middle Black Cabinet' },
  { name: 'Black Pens', category: 'OTHER', description: 'Black writing pens', quantity: 24, location: 'First Black Cabinet' }
];

async function updateInventory() {
  console.log('Starting inventory update...');
  
  try {
    // Mark all existing items as inactive first
    console.log('Marking existing inventory as inactive...');
    await db.update(toolInventory).set({ isActive: false, updatedAt: new Date().toISOString() });
    
    // Process each inventory item
    for (const item of inventoryItems) {
      if (item.sizes) {
        // For clothing items with sizes, create separate entries for each size
        for (const [size, qty] of Object.entries(item.sizes)) {
          if (qty > 0) {
            const toolData = {
              id: `${item.name.toLowerCase().replace(/\s+/g, '-')}-${size.toLowerCase().replace(/\s+/g, '-')}`,
              name: `${item.name} (Size ${size})`,
              category: item.category === 'CLOTHING' ? 'POLO' : item.category,
              description: `${item.description} - Size ${size}`,
              serialNumber: `${item.category}-${size}-${Date.now()}`,
              model: item.name,
              quantity: qty,
              availableQuantity: qty,
              condition: size.includes('USED') ? 'FAIR' : 'NEW',
              purchaseDate: new Date().toISOString(),
              purchasePrice: 0,
              location: item.location,
              notes: `Updated from inventory list on ${new Date().toLocaleDateString()}`,
              isActive: true,
              createdBy: 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', // Ahmed Admin ID
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            await db.insert(toolInventory).values(toolData);
            console.log(`Added: ${toolData.name} - Qty: ${qty}`);
          }
        }
      } else {
        // For non-clothing items, create a single entry
        const toolData = {
          id: item.name.toLowerCase().replace(/\s+/g, '-'),
          name: item.name,
          category: item.category,
          description: item.description,
          serialNumber: `${item.category}-${Date.now()}`,
          model: item.name,
          quantity: item.quantity || 1,
          availableQuantity: item.quantity || 1,
          condition: 'NEW',
          purchaseDate: new Date().toISOString(),
          purchasePrice: 0,
          location: item.location,
          notes: `Updated from inventory list on ${new Date().toLocaleDateString()}`,
          isActive: true,
          createdBy: 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', // Ahmed Admin ID
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await db.insert(toolInventory).values(toolData);
        console.log(`Added: ${toolData.name} - Qty: ${toolData.quantity}`);
      }
    }
    
    console.log('Inventory update completed successfully!');
    
    // Get summary
    const allTools = await db.select().from(toolInventory);
    console.log(`\nTotal items in inventory: ${allTools.length}`);
    
    // Count by category
    const categoryCounts: Record<string, number> = {};
    for (const tool of allTools) {
      categoryCounts[tool.category] = (categoryCounts[tool.category] || 0) + 1;
    }
    
    console.log('\nItems by category:');
    for (const [category, count] of Object.entries(categoryCounts)) {
      console.log(`  ${category}: ${count} items`);
    }
    
  } catch (error) {
    console.error('Error updating inventory:', error);
  } finally {
    process.exit(0);
  }
}

updateInventory();