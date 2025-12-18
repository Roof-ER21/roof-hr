/**
 * Seed Role Equipment Defaults
 *
 * This script populates the role_equipment_defaults table with default equipment
 * items for each employee role. This data is used when creating equipment agreements
 * for new hires - HR can then customize the list before sending.
 *
 * Run: npx tsx server/scripts/seed-equipment-defaults.ts
 */

import { db } from '../db';
import { roleEquipmentDefaults } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface EquipmentItem {
  name: string;
  quantity: number;
}

interface RoleEquipmentConfig {
  role: string;
  items: EquipmentItem[];
}

// Default equipment configurations per role
const ROLE_EQUIPMENT_CONFIGS: RoleEquipmentConfig[] = [
  {
    role: 'SALES_REP',
    items: [
      { name: 'iPad', quantity: 1 },
      { name: 'iPad Keyboard', quantity: 1 },
      { name: 'Ladder', quantity: 1 },
      { name: 'Flashlight Set (w/ chargers)', quantity: 1 },
      { name: 'Gray Polo', quantity: 2 },
      { name: 'Black Polo', quantity: 2 },
      { name: 'Gray Quarter Zip', quantity: 1 },
      { name: 'Black Quarter Zip', quantity: 1 },
    ]
  },
  {
    role: 'FIELD_TECH',
    items: [
      { name: 'iPad', quantity: 1 },
      { name: 'iPad Keyboard', quantity: 1 },
      { name: 'Ladder', quantity: 1 },
      { name: 'Flashlight Set (w/ chargers)', quantity: 1 },
      { name: 'Tool Kit', quantity: 1 },
      { name: 'Gray Polo', quantity: 2 },
      { name: 'Black Polo', quantity: 2 },
      { name: 'Gray Quarter Zip', quantity: 1 },
    ]
  },
  {
    role: 'EMPLOYEE',
    items: [
      { name: 'Laptop/iPad', quantity: 1 },
      { name: 'Keyboard', quantity: 1 },
      { name: 'Gray Polo', quantity: 1 },
      { name: 'Black Polo', quantity: 1 },
    ]
  },
  {
    role: 'ADMIN',
    items: [
      { name: 'Laptop', quantity: 1 },
      { name: 'Monitor', quantity: 1 },
      { name: 'Keyboard & Mouse', quantity: 1 },
      { name: 'Company Polo', quantity: 2 },
    ]
  },
  {
    role: 'MANAGER',
    items: [
      { name: 'Laptop', quantity: 1 },
      { name: 'Monitor', quantity: 1 },
      { name: 'Keyboard & Mouse', quantity: 1 },
      { name: 'iPad', quantity: 1 },
      { name: 'Company Polo', quantity: 2 },
      { name: 'Company Jacket', quantity: 1 },
    ]
  },
  {
    role: 'PROJECT_MANAGER',
    items: [
      { name: 'Laptop', quantity: 1 },
      { name: 'iPad', quantity: 1 },
      { name: 'iPad Keyboard', quantity: 1 },
      { name: 'Company Polo', quantity: 2 },
      { name: 'Company Quarter Zip', quantity: 1 },
    ]
  },
  {
    role: 'RECRUITER',
    items: [
      { name: 'Laptop', quantity: 1 },
      { name: 'Headset', quantity: 1 },
      { name: 'Company Polo', quantity: 1 },
    ]
  },
  {
    role: 'HR',
    items: [
      { name: 'Laptop', quantity: 1 },
      { name: 'Monitor', quantity: 1 },
      { name: 'Keyboard & Mouse', quantity: 1 },
      { name: 'Company Polo', quantity: 2 },
    ]
  },
];

async function seedEquipmentDefaults() {
  console.log('=== Seeding Role Equipment Defaults ===\n');

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[]
  };

  for (const config of ROLE_EQUIPMENT_CONFIGS) {
    try {
      // Check if role already exists
      const [existing] = await db
        .select()
        .from(roleEquipmentDefaults)
        .where(eq(roleEquipmentDefaults.role, config.role));

      if (existing) {
        // Update existing record
        await db
          .update(roleEquipmentDefaults)
          .set({
            items: JSON.stringify(config.items),
            updatedAt: new Date(),
          })
          .where(eq(roleEquipmentDefaults.role, config.role));

        console.log(`[UPDATED] ${config.role} - ${config.items.length} items`);
        stats.updated++;
      } else {
        // Create new record
        await db.insert(roleEquipmentDefaults).values({
          id: uuidv4(),
          role: config.role,
          items: JSON.stringify(config.items),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`[CREATED] ${config.role} - ${config.items.length} items`);
        stats.created++;
      }

      // Log items for this role
      console.log(`         Items: ${config.items.map(i => `${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ')}`);
      console.log('');
    } catch (error: any) {
      console.error(`[ERROR] ${config.role}: ${error.message}`);
      stats.errors.push(`${config.role}: ${error.message}`);
    }
  }

  console.log('\n=== Seeding Complete ===');
  console.log(`Created: ${stats.created}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  - ${e}`));
  }

  // Display final summary
  console.log('\n=== Role Equipment Defaults Summary ===');
  const allDefaults = await db.select().from(roleEquipmentDefaults);
  for (const def of allDefaults) {
    const items = JSON.parse(def.items) as EquipmentItem[];
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    console.log(`${def.role.padEnd(20)} ${items.length} types, ${totalItems} total items`);
  }

  process.exit(0);
}

seedEquipmentDefaults().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
