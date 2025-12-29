/**
 * Update PTO Policy Values in Database
 * Changes company policy from 5/5/2=12 to 12/3/2=17
 *
 * Run with: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/update-pto-policy.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { companyPtoPolicy, ptoPolicies, departmentPtoSettings } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { PTO_POLICY } from '../../shared/constants/pto-policy.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function updatePtoPolicy() {
  console.log('🔄 Updating PTO Policy Values...\n');
  console.log('Target Policy:');
  console.log(`  Vacation Days: ${PTO_POLICY.DEFAULT_VACATION_DAYS}`);
  console.log(`  Sick Days: ${PTO_POLICY.DEFAULT_SICK_DAYS}`);
  console.log(`  Personal Days: ${PTO_POLICY.DEFAULT_PERSONAL_DAYS}`);
  console.log(`  Total Days: ${PTO_POLICY.DEFAULT_TOTAL_DAYS}`);
  console.log('\n');

  try {
    // Step 1: Update company_pto_policy table
    console.log('📝 Step 1: Updating company_pto_policy table...');
    const companyPolicies = await db.select().from(companyPtoPolicy);

    if (companyPolicies.length === 0) {
      console.log('  ⚠️  No company policy found. Creating new policy...');

      await db.insert(companyPtoPolicy).values({
        id: 'default-company-policy',
        vacationDays: PTO_POLICY.DEFAULT_VACATION_DAYS,
        sickDays: PTO_POLICY.DEFAULT_SICK_DAYS,
        personalDays: PTO_POLICY.DEFAULT_PERSONAL_DAYS,
        totalDays: PTO_POLICY.DEFAULT_TOTAL_DAYS,
        lastUpdatedBy: 'system-migration',
        policyNotes: 'Updated to 17 total days (12 vacation, 3 sick, 2 personal)',
      });

      console.log('  ✅ Company policy created successfully!');
    } else {
      // Update all existing company policies
      for (const policy of companyPolicies) {
        console.log(`  Updating policy ID: ${policy.id}`);

        await db
          .update(companyPtoPolicy)
          .set({
            vacationDays: PTO_POLICY.DEFAULT_VACATION_DAYS,
            sickDays: PTO_POLICY.DEFAULT_SICK_DAYS,
            personalDays: PTO_POLICY.DEFAULT_PERSONAL_DAYS,
            totalDays: PTO_POLICY.DEFAULT_TOTAL_DAYS,
            lastUpdatedBy: 'system-migration',
            policyNotes: 'Updated to 17 total days (12 vacation, 3 sick, 2 personal)',
            updatedAt: new Date(),
          })
          .where(eq(companyPtoPolicy.id, policy.id));

        console.log(`  ✅ Updated policy ${policy.id}`);
      }
    }

    // Step 2: Update department_pto_settings table
    console.log('\n📝 Step 2: Updating department_pto_settings table...');
    const deptSettings = await db.select().from(departmentPtoSettings);

    if (deptSettings.length === 0) {
      console.log('  ℹ️  No department settings found. Skipping...');
    } else {
      for (const setting of deptSettings) {
        // Skip Sales department (they get 0 PTO)
        if (setting.department.toLowerCase().includes('sales')) {
          console.log(`  ⏭️  Skipping ${setting.department} (Sales gets 0 PTO)`);
          continue;
        }

        // Only update if inheriting from company
        if (setting.inheritFromCompany) {
          console.log(`  Updating department: ${setting.department}`);

          await db
            .update(departmentPtoSettings)
            .set({
              vacationDays: PTO_POLICY.DEFAULT_VACATION_DAYS,
              sickDays: PTO_POLICY.DEFAULT_SICK_DAYS,
              personalDays: PTO_POLICY.DEFAULT_PERSONAL_DAYS,
              totalDays: PTO_POLICY.DEFAULT_TOTAL_DAYS,
              updatedAt: new Date(),
            })
            .where(eq(departmentPtoSettings.id, setting.id));

          console.log(`  ✅ Updated ${setting.department}`);
        } else {
          console.log(`  ⏭️  Skipping ${setting.department} (custom policy)`);
        }
      }
    }

    // Step 3: Update pto_policies table (individual employee policies)
    console.log('\n📝 Step 3: Updating pto_policies table (individual employees)...');
    const individualPolicies = await db.select().from(ptoPolicies);

    if (individualPolicies.length === 0) {
      console.log('  ℹ️  No individual policies found. Skipping...');
    } else {
      for (const policy of individualPolicies) {
        // Check if this is a sales rep (0 total days)
        const isSalesRep = policy.totalDays === 0;

        if (isSalesRep) {
          console.log(`  ⏭️  Skipping employee ${policy.employeeId} (Sales rep - 0 PTO)`);
          continue;
        }

        // Check if this is a company-level policy
        if (policy.policyLevel === 'COMPANY') {
          console.log(`  Updating employee: ${policy.employeeId}`);

          const newTotalDays = PTO_POLICY.DEFAULT_TOTAL_DAYS + policy.additionalDays;
          const newRemainingDays = newTotalDays - policy.usedDays;

          await db
            .update(ptoPolicies)
            .set({
              vacationDays: PTO_POLICY.DEFAULT_VACATION_DAYS,
              sickDays: PTO_POLICY.DEFAULT_SICK_DAYS,
              personalDays: PTO_POLICY.DEFAULT_PERSONAL_DAYS,
              baseDays: PTO_POLICY.DEFAULT_TOTAL_DAYS,
              totalDays: newTotalDays,
              remainingDays: newRemainingDays,
              updatedAt: new Date(),
            })
            .where(eq(ptoPolicies.id, policy.id));

          console.log(`  ✅ Updated employee ${policy.employeeId}`);
          console.log(`     New total: ${newTotalDays}, Remaining: ${newRemainingDays}`);
        } else {
          console.log(`  ⏭️  Skipping employee ${policy.employeeId} (${policy.policyLevel} level - custom policy)`);
        }
      }
    }

    console.log('\n\n✅ PTO Policy Update Complete!\n');
    console.log('Summary:');
    console.log(`  ✅ Company policy updated to ${PTO_POLICY.DEFAULT_TOTAL_DAYS} days (${PTO_POLICY.DEFAULT_VACATION_DAYS}/${PTO_POLICY.DEFAULT_SICK_DAYS}/${PTO_POLICY.DEFAULT_PERSONAL_DAYS})`);
    console.log(`  ✅ Department settings updated (where applicable)`);
    console.log(`  ✅ Individual employee policies updated (company-level only)`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Error updating PTO policy:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updatePtoPolicy();
