/**
 * Create Individual PTO Policies for 1099 Employees
 *
 * This script creates individual PTO policies for Sales Reps and Field Techs
 * (who are 1099 contractors) so they can access the PTO system.
 *
 * Run: npx tsx server/scripts/create-pto-policies.ts
 */

import { db } from '../db';
import { users, ptoPolicies, companyPtoPolicy } from '../../shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function createPtoPolicies() {
  console.log('=== Creating Individual PTO Policies for 1099 Employees ===\n');

  // Get company-wide PTO policy for default values
  const [companyPolicy] = await db.select().from(companyPtoPolicy);

  const defaultVacationDays = companyPolicy?.vacationDays ?? 10;
  const defaultSickDays = companyPolicy?.sickDays ?? 5;
  const defaultPersonalDays = companyPolicy?.personalDays ?? 3;
  const defaultTotalDays = defaultVacationDays + defaultSickDays + defaultPersonalDays;

  console.log(`Company Policy: ${defaultVacationDays} vacation, ${defaultSickDays} sick, ${defaultPersonalDays} personal = ${defaultTotalDays} total\n`);

  // Get all 1099 employees (Sales Reps and Field Techs)
  const contractors = await db.select().from(users).where(
    eq(users.employmentType, '1099')
  );

  console.log(`Found ${contractors.length} 1099 employees\n`);

  const stats = {
    created: 0,
    skipped: 0,
    errors: [] as string[]
  };

  for (const employee of contractors) {
    try {
      // Check if individual policy already exists
      const [existingPolicy] = await db.select().from(ptoPolicies).where(
        eq(ptoPolicies.employeeId, employee.id)
      );

      if (existingPolicy) {
        console.log(`[SKIPPED] ${employee.firstName} ${employee.lastName} - Policy already exists`);
        stats.skipped++;
        continue;
      }

      // Create individual PTO policy
      const policyId = uuidv4();
      await db.insert(ptoPolicies).values({
        id: policyId,
        employeeId: employee.id,
        policyLevel: 'INDIVIDUAL',
        vacationDays: defaultVacationDays,
        sickDays: defaultSickDays,
        personalDays: defaultPersonalDays,
        baseDays: defaultTotalDays,
        additionalDays: 0,
        totalDays: defaultTotalDays,
        usedDays: 0,
        remainingDays: defaultTotalDays,
        customizedBy: 'system-import',
        customizationDate: new Date(),
        notes: 'Auto-created for 1099 employee PTO access'
      });

      console.log(`[CREATED] ${employee.firstName} ${employee.lastName} (${employee.email}) - ${defaultTotalDays} days`);
      stats.created++;
    } catch (error: any) {
      console.error(`[ERROR] ${employee.firstName} ${employee.lastName}: ${error.message}`);
      stats.errors.push(`${employee.firstName} ${employee.lastName}: ${error.message}`);
    }
  }

  console.log('\n=== PTO Policy Creation Complete ===');
  console.log(`Created: ${stats.created}`);
  console.log(`Skipped (already exists): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  - ${e}`));
  }

  // Summary by role
  const salesReps = contractors.filter(c => c.role === 'SALES_REP');
  const fieldTechs = contractors.filter(c => c.role === 'FIELD_TECH');

  console.log('\n=== Summary by Role ===');
  console.log(`Sales Reps: ${salesReps.length}`);
  console.log(`Field Techs: ${fieldTechs.length}`);

  process.exit(0);
}

createPtoPolicies().catch(console.error);
