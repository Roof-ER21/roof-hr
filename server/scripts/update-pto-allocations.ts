/**
 * Script to update all employee PTO allocations to the new 5/5/2 standard
 * 5 Vacation Days + 5 Sick Days + 2 Personal Days = 12 Total Days
 *
 * Run with: npx tsx server/scripts/update-pto-allocations.ts
 */

import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { ptoPolicies, companyPtoPolicy, departmentPtoSettings, users } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';

const NEW_VACATION_DAYS = 5;
const NEW_SICK_DAYS = 5;
const NEW_PERSONAL_DAYS = 2;
const NEW_TOTAL_DAYS = NEW_VACATION_DAYS + NEW_SICK_DAYS + NEW_PERSONAL_DAYS; // 12

async function updatePTOAllocations() {
  console.log('='.repeat(60));
  console.log('PTO Allocation Update Script');
  console.log('New Standard: 5 Vacation + 5 Sick + 2 Personal = 12 Total');
  console.log('='.repeat(60));

  try {
    // 1. Update Company Policy
    console.log('\n[1/4] Updating company PTO policy...');
    const existingPolicy = await db.select().from(companyPtoPolicy).limit(1);

    if (existingPolicy.length > 0) {
      await db.update(companyPtoPolicy)
        .set({
          vacationDays: NEW_VACATION_DAYS,
          sickDays: NEW_SICK_DAYS,
          personalDays: NEW_PERSONAL_DAYS,
          totalDays: NEW_TOTAL_DAYS,
          updatedAt: new Date()
        })
        .where(eq(companyPtoPolicy.id, existingPolicy[0].id));
      console.log('  ✓ Company policy updated to 5/5/2');
    } else {
      // Create a new company policy
      await db.insert(companyPtoPolicy).values({
        id: uuidv4(),
        vacationDays: NEW_VACATION_DAYS,
        sickDays: NEW_SICK_DAYS,
        personalDays: NEW_PERSONAL_DAYS,
        totalDays: NEW_TOTAL_DAYS,
        lastUpdatedBy: 'system',
      });
      console.log('  ✓ Company policy created with 5/5/2');
    }

    // 2. Update Department Policies (if any)
    console.log('\n[2/4] Updating department PTO settings...');
    const deptSettings = await db.select().from(departmentPtoSettings);

    for (const dept of deptSettings) {
      await db.update(departmentPtoSettings)
        .set({
          vacationDays: NEW_VACATION_DAYS,
          sickDays: NEW_SICK_DAYS,
          personalDays: NEW_PERSONAL_DAYS,
          totalDays: NEW_TOTAL_DAYS,
          updatedAt: new Date()
        })
        .where(eq(departmentPtoSettings.id, dept.id));
      console.log(`  ✓ Updated department: ${dept.department}`);
    }
    console.log(`  Total departments updated: ${deptSettings.length}`);

    // 3. Update Individual Policies
    console.log('\n[3/4] Updating individual employee PTO policies...');
    const individualPolicies = await db.select().from(ptoPolicies);

    let updatedCount = 0;
    for (const policy of individualPolicies) {
      // Calculate new remaining days based on new allocation minus used
      const newRemaining = Math.max(0, NEW_TOTAL_DAYS - (policy.usedDays || 0));

      await db.update(ptoPolicies)
        .set({
          vacationDays: NEW_VACATION_DAYS,
          sickDays: NEW_SICK_DAYS,
          personalDays: NEW_PERSONAL_DAYS,
          baseDays: NEW_TOTAL_DAYS,
          totalDays: NEW_TOTAL_DAYS,
          remainingDays: newRemaining,
          notes: `Updated to 5/5/2 standard on ${new Date().toISOString().split('T')[0]}. Previous allocation preserved used days.`,
          updatedAt: new Date()
        })
        .where(eq(ptoPolicies.id, policy.id));
      updatedCount++;
    }
    console.log(`  ✓ Updated ${updatedCount} individual policies`);

    // 4. Create policies for employees without one
    console.log('\n[4/4] Creating policies for employees without one...');

    // Get all employees who don't have a policy yet
    const employeesWithoutPolicy = await db.execute(sql`
      SELECT u.id, u."firstName", u."lastName", u.department, u."employmentType"
      FROM users u
      LEFT JOIN pto_policies p ON u.id = p.employee_id
      WHERE p.id IS NULL
      AND u.role NOT IN ('CONTRACTOR', 'SALES_REP')
      AND u."employmentType" NOT IN ('1099', 'CONTRACTOR')
    `);

    let createdCount = 0;
    for (const emp of employeesWithoutPolicy.rows as any[]) {
      await db.insert(ptoPolicies).values({
        id: uuidv4(),
        employeeId: emp.id,
        policyLevel: 'COMPANY',
        vacationDays: NEW_VACATION_DAYS,
        sickDays: NEW_SICK_DAYS,
        personalDays: NEW_PERSONAL_DAYS,
        baseDays: NEW_TOTAL_DAYS,
        additionalDays: 0,
        totalDays: NEW_TOTAL_DAYS,
        usedDays: 0,
        remainingDays: NEW_TOTAL_DAYS,
        notes: `Created with 5/5/2 standard on ${new Date().toISOString().split('T')[0]}`,
      });
      console.log(`  ✓ Created policy for: ${emp.firstName} ${emp.lastName}`);
      createdCount++;
    }
    console.log(`  Total new policies created: ${createdCount}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('UPDATE COMPLETE');
    console.log('='.repeat(60));
    console.log(`Company policy: Updated`);
    console.log(`Department policies: ${deptSettings.length} updated`);
    console.log(`Individual policies: ${updatedCount} updated, ${createdCount} created`);
    console.log('\nNew Standard PTO Allocation:');
    console.log(`  Vacation: ${NEW_VACATION_DAYS} days`);
    console.log(`  Sick: ${NEW_SICK_DAYS} days`);
    console.log(`  Personal: ${NEW_PERSONAL_DAYS} days`);
    console.log(`  Total: ${NEW_TOTAL_DAYS} days`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
updatePTOAllocations();
