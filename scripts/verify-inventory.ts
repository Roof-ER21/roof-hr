import { db } from '../server/db.js';
import { toolInventory } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function verify() {
  const items = await db.select().from(toolInventory).where(eq(toolInventory.isActive, true));

  console.log('='.repeat(60));
  console.log('INVENTORY VERIFICATION - January 19, 2026');
  console.log('='.repeat(60));
  console.log(`\nActive Items: ${items.length}`);
  console.log(`Total Quantity: ${items.reduce((sum, i) => sum + i.quantity, 0)}`);
  console.log('');

  // Group by category
  const byCategory: Record<string, any[]> = {};
  for (const item of items) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  for (const [cat, catItems] of Object.entries(byCategory).sort()) {
    const catQty = catItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
    console.log(`\n${cat} (${catItems.length} items, ${catQty} total qty):`);
    for (const item of catItems.sort((a: any, b: any) => a.name.localeCompare(b.name))) {
      console.log(`  - ${item.name}: ${item.quantity} (avail: ${item.availableQuantity})`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(60));

  process.exit(0);
}

verify();
