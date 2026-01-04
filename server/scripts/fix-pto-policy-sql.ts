/**
 * Fix PTO Policy with Direct SQL
 * Changes: 10/5/2 → 12/3/2 (both = 17 total)
 *
 * Run with: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/fix-pto-policy-sql.ts
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixPtoPolicy() {
  console.log('🔧 Fixing PTO Policy with SQL Updates...\n');
  console.log('Target: 10 vacation, 5 sick, 2 personal = 17 total\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Fix company_pto_policy table
    console.log('📝 Step 1: Fixing company_pto_policy table...');
    const updateCompanyResult = await client.query(`
      UPDATE company_pto_policy
      SET
        vacation_days = 10,
        sick_days = 5,
        personal_days = 2,
        total_days = 17,
        last_updated_by = 'system-fix',
        policy_notes = 'Updated to correct allocation: 10 vacation, 5 sick, 2 personal = 17 total',
        updated_at = NOW()
      WHERE TRUE
      RETURNING id, vacation_days, sick_days, personal_days, total_days;
    `);

    console.log(`  ✅ Updated ${updateCompanyResult.rowCount} company policy record(s)`);
    updateCompanyResult.rows.forEach(row => {
      console.log(`     ID: ${row.id} → ${row.vacation_days}/${row.sick_days}/${row.personal_days} = ${row.total_days}`);
    });

    // Step 2: Fix department_pto_settings table (where inherit_from_company = true)
    console.log('\n📝 Step 2: Fixing department_pto_settings table...');
    const updateDeptResult = await client.query(`
      UPDATE department_pto_settings
      SET
        vacation_days = 10,
        sick_days = 5,
        personal_days = 2,
        total_days = 17,
        updated_at = NOW()
      WHERE
        inherit_from_company = true
        AND department NOT ILIKE '%sales%'
      RETURNING department, vacation_days, sick_days, personal_days, total_days;
    `);

    console.log(`  ✅ Updated ${updateDeptResult.rowCount} department setting(s)`);
    updateDeptResult.rows.forEach(row => {
      console.log(`     ${row.department} → ${row.vacation_days}/${row.sick_days}/${row.personal_days} = ${row.total_days}`);
    });

    // Step 3: Fix pto_policies table (COMPANY level only, excluding sales reps)
    console.log('\n📝 Step 3: Fixing individual employee policies (COMPANY level)...');

    // First, let's see how many will be affected
    const countResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pto_policies
      WHERE
        policy_level = 'COMPANY'
        AND total_days != 0
    `);

    console.log(`  Found ${countResult.rows[0].count} COMPANY-level policies (excluding sales reps)`);

    const updateEmployeeResult = await client.query(`
      UPDATE pto_policies
      SET
        vacation_days = 10,
        sick_days = 5,
        personal_days = 2,
        base_days = 17,
        total_days = 17 + additional_days,
        remaining_days = (17 + additional_days) - used_days,
        updated_at = NOW()
      WHERE
        policy_level = 'COMPANY'
        AND total_days != 0
      RETURNING
        employee_id,
        vacation_days,
        sick_days,
        personal_days,
        base_days,
        additional_days,
        total_days,
        used_days,
        remaining_days;
    `);

    console.log(`  ✅ Updated ${updateEmployeeResult.rowCount} employee policy record(s)`);

    // Show first 5 examples
    console.log('\n  Sample of updated records:');
    updateEmployeeResult.rows.slice(0, 5).forEach((row, index) => {
      console.log(`     ${index + 1}. Employee ${row.employee_id.substring(0, 8)}...`);
      console.log(`        ${row.vacation_days}/${row.sick_days}/${row.personal_days} = ${row.total_days} total`);
      console.log(`        Base: ${row.base_days}, Additional: ${row.additional_days}, Used: ${row.used_days}, Remaining: ${row.remaining_days}`);
    });

    // Commit the transaction
    await client.query('COMMIT');

    console.log('\n\n✅ PTO Policy Fix Complete!\n');
    console.log('Summary:');
    console.log(`  ✅ Company policy: 10/5/2 = 17 total`);
    console.log(`  ✅ Departments updated: ${updateDeptResult.rowCount}`);
    console.log(`  ✅ Employees updated: ${updateEmployeeResult.rowCount}`);
    console.log('\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing PTO policy:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixPtoPolicy();
