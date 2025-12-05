#!/usr/bin/env tsx

/**
 * Script to fix critical issues found in testing
 * 1. Reset Ford's password
 * 2. Ensure test employee exists
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function fixCriticalIssues() {
  console.log('🔧 Fixing critical issues...\n');

  try {
    // 1. Reset Ford's password
    console.log('📌 Resetting Ford Barsi password...');
    const hashedPassword = await bcrypt.hash('Manager123!', 10);
    
    const fordUpdated = await db.update(users)
      .set({
        passwordHash: hashedPassword,
        mustChangePassword: false
      })
      .where(eq(users.email, 'ford.barsi@theroofdocs.com'))
      .returning();

    if (fordUpdated.length > 0) {
      console.log('✅ Ford Barsi password reset to: Manager123!');
    } else {
      console.log('⚠️ Ford Barsi account not found');
    }

    // 2. Ensure test employee exists
    console.log('\n📌 Checking test employee account...');
    const existingEmployee = await db.select()
      .from(users)
      .where(eq(users.email, 'test.employee@company.com'))
      .limit(1);

    if (existingEmployee.length === 0) {
      console.log('Creating test employee...');
      const employeePassword = await bcrypt.hash('Employee123!', 10);
      
      await db.insert(users).values({
        id: crypto.randomUUID(),
        email: 'test.employee@company.com',
        firstName: 'Test',
        lastName: 'Employee',
        role: 'EMPLOYEE',
        employmentType: 'W2',
        department: 'General',
        position: 'Employee',
        hireDate: new Date().toISOString().split('T')[0],
        passwordHash: employeePassword,
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Test employee created: test.employee@company.com / Employee123!');
    } else {
      // Reset password for existing employee
      const employeePassword = await bcrypt.hash('Employee123!', 10);
      await db.update(users)
        .set({
          passwordHash: employeePassword,
          mustChangePassword: false
        })
        .where(eq(users.email, 'test.employee@company.com'))
        .returning();
      
      console.log('✅ Test employee password reset: test.employee@company.com / Employee123!');
    }

    console.log('\n✅ All critical issues fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing issues:', error);
    process.exit(1);
  }
}

fixCriticalIssues();