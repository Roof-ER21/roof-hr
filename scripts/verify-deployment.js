#!/usr/bin/env node

/**
 * Deployment verification script
 * Checks that all tables and data are properly set up
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql as sqlTemplate } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function verifyDeployment() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    console.log('🔍 Verifying deployment...\n');

    // Check tables exist
    const tables = [
      'users',
      'sessions',
      'sales_reps',
      'bonus_config',
      'pto_requests',
      'candidates',
      'employee_reviews',
      'tasks',
      'documents',
      'rep_qr_codes',
      'qr_scan_events',
      'sales_metrics',
      'company_settings'
    ];

    console.log('📊 Checking database tables:');
    for (const table of tables) {
      try {
        const result = await db.execute(sqlTemplate`SELECT COUNT(*) FROM ${sqlTemplate.identifier(table)}`);
        const count = result.rows[0].count;
        console.log(`   ✅ ${table} - ${count} records`);
      } catch (error) {
        console.log(`   ❌ ${table} - Table not found`);
      }
    }

    // Check for admin users
    console.log('\n👤 Checking for admin users:');
    const adminResult = await db.execute(sqlTemplate`SELECT email, first_name, last_name FROM users WHERE role = 'ADMIN'`);
    if (adminResult.rows.length > 0) {
      console.log(`   ✅ Found ${adminResult.rows.length} admin user(s):`);
      adminResult.rows.forEach(admin => {
        console.log(`      - ${admin.email} (${admin.first_name} ${admin.last_name})`);
      });
    } else {
      console.log('   ⚠️  No admin users found. Run: node scripts/create-admin.js');
    }

    // Check bonus configuration
    console.log('\n💰 Checking bonus configuration:');
    const bonusResult = await db.execute(sqlTemplate`SELECT tier, signup_threshold, bonus_amount FROM bonus_config ORDER BY tier`);
    if (bonusResult.rows.length > 0) {
      console.log(`   ✅ Found ${bonusResult.rows.length} bonus tiers:`);
      bonusResult.rows.forEach(tier => {
        console.log(`      - Tier ${tier.tier}: ${tier.signup_threshold} signups = $${tier.bonus_amount}`);
      });
    } else {
      console.log('   ⚠️  No bonus tiers configured');
    }

    // Check active sessions
    console.log('\n🔐 Checking active sessions:');
    const sessionResult = await db.execute(sqlTemplate`SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()`);
    const activeSessions = sessionResult.rows[0].count;
    console.log(`   ✅ ${activeSessions} active session(s)`);

    console.log('\n✨ Deployment verification complete!');
    
    // Summary
    if (adminResult.rows.length === 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   Create an admin user with: node scripts/create-admin.js <email> <password> <firstName> <lastName>');
    }

  } catch (error) {
    console.error('❌ Error verifying deployment:', error.message);
    process.exit(1);
  }
}

// Run verification
verifyDeployment();