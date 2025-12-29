/**
 * Check PTO Policy Values in Database
 * Run with: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/check-pto-policy.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { companyPtoPolicy, ptoPolicies, departmentPtoSettings } from '../../shared/schema.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function checkPtoPolicy() {
  console.log('🔍 Checking PTO Policy Values...\n');

  try {
    // Check company_pto_policy table
    console.log('📊 COMPANY PTO POLICY (company_pto_policy table):');
    console.log('=' .repeat(60));
    const companyPolicies = await db.select().from(companyPtoPolicy);

    if (companyPolicies.length === 0) {
      console.log('❌ No company policy found!');
    } else {
      companyPolicies.forEach((policy, index) => {
        console.log(`\nPolicy #${index + 1}:`);
        console.log(`  ID: ${policy.id}`);
        console.log(`  Vacation Days: ${policy.vacationDays}`);
        console.log(`  Sick Days: ${policy.sickDays}`);
        console.log(`  Personal Days: ${policy.personalDays}`);
        console.log(`  Total Days: ${policy.totalDays}`);
        console.log(`  Last Updated By: ${policy.lastUpdatedBy}`);
        console.log(`  Updated At: ${policy.updatedAt}`);

        const total = policy.vacationDays + policy.sickDays + policy.personalDays;
        const expected = 12 + 3 + 2; // 17

        if (total !== expected) {
          console.log(`  ⚠️  MISMATCH: Calculated total (${total}) != Expected total (${expected})`);
        } else {
          console.log(`  ✅ Total matches expected: ${total} = ${expected}`);
        }
      });
    }

    // Check pto_policies table (individual employee policies)
    console.log('\n\n📊 INDIVIDUAL EMPLOYEE POLICIES (pto_policies table):');
    console.log('=' .repeat(60));
    const individualPolicies = await db.select().from(ptoPolicies);

    if (individualPolicies.length === 0) {
      console.log('❌ No individual policies found!');
    } else {
      console.log(`Found ${individualPolicies.length} employee policies:\n`);
      individualPolicies.forEach((policy, index) => {
        console.log(`\nEmployee Policy #${index + 1}:`);
        console.log(`  Employee ID: ${policy.employeeId}`);
        console.log(`  Policy Level: ${policy.policyLevel}`);
        console.log(`  Vacation Days: ${policy.vacationDays}`);
        console.log(`  Sick Days: ${policy.sickDays}`);
        console.log(`  Personal Days: ${policy.personalDays}`);
        console.log(`  Base Days: ${policy.baseDays}`);
        console.log(`  Additional Days: ${policy.additionalDays}`);
        console.log(`  Total Days: ${policy.totalDays}`);
        console.log(`  Used Days: ${policy.usedDays}`);
        console.log(`  Remaining Days: ${policy.remainingDays}`);

        const total = policy.vacationDays + policy.sickDays + policy.personalDays;
        const expected = 12 + 3 + 2; // 17

        if (total !== expected && total !== 0) { // 0 is valid for sales reps
          console.log(`  ⚠️  MISMATCH: Calculated total (${total}) != Expected total (${expected})`);
        }
      });
    }

    // Check department_pto_settings table
    console.log('\n\n📊 DEPARTMENT PTO SETTINGS (department_pto_settings table):');
    console.log('=' .repeat(60));
    const deptSettings = await db.select().from(departmentPtoSettings);

    if (deptSettings.length === 0) {
      console.log('❌ No department settings found!');
    } else {
      deptSettings.forEach((setting, index) => {
        console.log(`\nDepartment #${index + 1}:`);
        console.log(`  Department: ${setting.department}`);
        console.log(`  Vacation Days: ${setting.vacationDays}`);
        console.log(`  Sick Days: ${setting.sickDays}`);
        console.log(`  Personal Days: ${setting.personalDays}`);
        console.log(`  Total Days: ${setting.totalDays}`);
        console.log(`  Inherit From Company: ${setting.inheritFromCompany}`);
        console.log(`  Created By: ${setting.createdBy}`);

        const total = setting.vacationDays + setting.sickDays + setting.personalDays;
        const expected = 12 + 3 + 2; // 17

        if (total !== expected && total !== 0) {
          console.log(`  ⚠️  MISMATCH: Calculated total (${total}) != Expected total (${expected})`);
        }
      });
    }

    console.log('\n\n✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error checking PTO policy:', error);
  } finally {
    await pool.end();
  }
}

checkPtoPolicy();
