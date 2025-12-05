#!/usr/bin/env tsx
/**
 * Pre-Production Validation Script
 * Run this before deploying to production to ensure data integrity
 */

import { db } from '../server/db';
import { 
  employees, 
  candidates, 
  documents, 
  performanceReviews,
  notifications,
  users
} from '../shared/schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const CHECKS = {
  passed: 0,
  failed: 0,
  warnings: 0
};

const log = {
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  info: (msg: string) => console.log(`ℹ️  ${msg}`)
};

async function checkDatabaseConnection() {
  try {
    await db.execute(sql`SELECT 1`);
    log.success('Database connection successful');
    CHECKS.passed++;
    return true;
  } catch (error) {
    log.error(`Database connection failed: ${error}`);
    CHECKS.failed++;
    return false;
  }
}

async function checkRequiredTables() {
  const requiredTables = [
    'users', 
    'employees', 
    'candidates', 
    'documents', 
    'performance_reviews',
    'notifications',
    'interviews',
    'recruitment_bot_configs'
  ];

  for (const table of requiredTables) {
    try {
      await db.execute(sql`SELECT COUNT(*) FROM ${sql.identifier(table)}`);
      log.success(`Table '${table}' exists`);
      CHECKS.passed++;
    } catch (error) {
      log.error(`Table '${table}' is missing`);
      CHECKS.failed++;
    }
  }
}

async function checkDataIntegrity() {
  // Check for orphaned employees (employees without users)
  const orphanedEmployees = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM employees e 
    LEFT JOIN users u ON e.user_id = u.id 
    WHERE u.id IS NULL
  `);
  
  const orphanCount = Number(orphanedEmployees.rows[0]?.count || 0);
  if (orphanCount > 0) {
    log.warning(`Found ${orphanCount} orphaned employee records`);
    CHECKS.warnings++;
  } else {
    log.success('No orphaned employee records found');
    CHECKS.passed++;
  }

  // Check for documents without employees
  const orphanedDocs = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM documents d 
    LEFT JOIN employees e ON d.employee_id = e.id 
    WHERE e.id IS NULL
  `);
  
  const orphanDocCount = Number(orphanedDocs.rows[0]?.count || 0);
  if (orphanDocCount > 0) {
    log.warning(`Found ${orphanDocCount} orphaned document records`);
    CHECKS.warnings++;
  } else {
    log.success('No orphaned document records found');
    CHECKS.passed++;
  }
}

async function checkEnvironmentVariables() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET'
  ];

  const recommended = [
    'OPENAI_API_KEY',
    'SENDGRID_API_KEY',
    'SENTRY_DSN'
  ];

  for (const envVar of required) {
    if (process.env[envVar]) {
      log.success(`Required environment variable '${envVar}' is set`);
      CHECKS.passed++;
    } else {
      log.error(`Required environment variable '${envVar}' is missing`);
      CHECKS.failed++;
    }
  }

  for (const envVar of recommended) {
    if (process.env[envVar]) {
      log.success(`Recommended environment variable '${envVar}' is set`);
      CHECKS.passed++;
    } else {
      log.warning(`Recommended environment variable '${envVar}' is not set`);
      CHECKS.warnings++;
    }
  }
}

async function checkAdminUser() {
  try {
    const adminUsers = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role = 'ADMIN'
    `);
    
    const adminCount = Number(adminUsers.rows[0]?.count || 0);
    if (adminCount === 0) {
      log.error('No admin users found - system will be inaccessible');
      CHECKS.failed++;
    } else {
      log.success(`Found ${adminCount} admin user(s)`);
      CHECKS.passed++;
    }
  } catch (error) {
    log.error(`Failed to check admin users: ${error}`);
    CHECKS.failed++;
  }
}

async function checkFilePermissions() {
  const criticalFiles = [
    '.env',
    'agent-states.json'
  ];

  for (const file of criticalFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        
        if (mode === '600' || mode === '640') {
          log.success(`File '${file}' has secure permissions (${mode})`);
          CHECKS.passed++;
        } else {
          log.warning(`File '${file}' has permissions ${mode} - consider restricting to 600`);
          CHECKS.warnings++;
        }
      } catch (error) {
        log.warning(`Could not check permissions for '${file}'`);
        CHECKS.warnings++;
      }
    }
  }
}

async function checkSystemMetrics() {
  try {
    // Check total records in critical tables
    const tables = ['employees', 'candidates', 'documents', 'performance_reviews'];
    
    for (const table of tables) {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.identifier(table)}`);
      const count = Number(result.rows[0]?.count || 0);
      log.info(`Table '${table}' contains ${count} records`);
    }
    
    CHECKS.passed++;
  } catch (error) {
    log.error(`Failed to check system metrics: ${error}`);
    CHECKS.failed++;
  }
}

async function generateReport() {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    checks: CHECKS,
    readyForProduction: CHECKS.failed === 0,
    requiresAttention: CHECKS.warnings > 0
  };

  const reportPath = path.join(process.cwd(), 'pre-production-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('PRE-PRODUCTION CHECK SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${CHECKS.passed}`);
  console.log(`❌ Failed: ${CHECKS.failed}`);
  console.log(`⚠️  Warnings: ${CHECKS.warnings}`);
  console.log('='.repeat(50));
  
  if (CHECKS.failed === 0) {
    console.log('🎉 SYSTEM IS READY FOR PRODUCTION! 🎉');
  } else {
    console.log('⛔ CRITICAL ISSUES FOUND - DO NOT DEPLOY TO PRODUCTION');
    console.log('Please fix all failed checks before deployment.');
  }
  
  if (CHECKS.warnings > 0) {
    console.log('\n⚠️  Some warnings were found. Review and address them if needed.');
  }
  
  console.log(`\n📄 Full report saved to: ${reportPath}`);
}

async function main() {
  console.log('🔍 Starting Pre-Production Validation...\n');
  
  // Run all checks
  const dbConnected = await checkDatabaseConnection();
  
  if (dbConnected) {
    await checkRequiredTables();
    await checkDataIntegrity();
    await checkAdminUser();
    await checkSystemMetrics();
  }
  
  await checkEnvironmentVariables();
  await checkFilePermissions();
  
  // Generate final report
  await generateReport();
  
  // Exit with appropriate code
  process.exit(CHECKS.failed > 0 ? 1 : 0);
}

// Run the validation
main().catch(error => {
  console.error('Fatal error during validation:', error);
  process.exit(1);
});