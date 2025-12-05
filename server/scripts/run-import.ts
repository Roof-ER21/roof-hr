// Run TheRoofDocs employee import
// Usage: npx tsx server/scripts/run-import.ts

import 'dotenv/config';
import { theRoofDocsEmployees, mapRoleToSystem } from './theroofdocs-employees';
import { db } from '../db';
import { users, ptoPolicies } from '../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

async function runImport() {
  console.log('Starting TheRoofDocs employee import...');
  console.log(`Total employees to import: ${theRoofDocsEmployees.length}`);

  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    created: [] as string[],
    skippedEmails: [] as string[],
    errors: [] as string[]
  };

  for (const emp of theRoofDocsEmployees) {
    try {
      // Check for existing user
      const [existing] = await db.select().from(users).where(eq(users.email, emp.email.toLowerCase()));

      if (existing) {
        results.skipped++;
        results.skippedEmails.push(emp.email);
        console.log(`Skipped (exists): ${emp.email}`);
        continue;
      }

      // Generate password
      let tempPassword = 'Susan2025';
      if (emp.email.toLowerCase() === 'ahmed.mahmoud@theroofdocs.com') {
        tempPassword = 'Roofer21!';
      }
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Map role
      const systemRole = mapRoleToSystem(emp.position);

      // Create user
      const userId = uuidv4();
      await db.insert(users).values({
        id: userId,
        email: emp.email.toLowerCase(),
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: systemRole as any,
        employmentType: 'W2' as any,
        department: emp.department,
        position: emp.position,
        hireDate: new Date().toISOString().split('T')[0],
        isActive: true,
        phone: emp.phone,
        passwordHash: hashedPassword,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create PTO policy
      try {
        await db.insert(ptoPolicies).values({
          id: uuidv4(),
          employeeId: userId,
          policyLevel: 'COMPANY' as any,
          vacationDays: 10,
          sickDays: 5,
          personalDays: 3,
          baseDays: 18,
          additionalDays: 0,
          totalDays: 18,
          usedDays: 0,
          remainingDays: 18,
          notes: 'Initial PTO allocation',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } catch (ptoErr: any) {
        console.error(`  PTO policy failed: ${ptoErr.message}`);
      }

      results.success++;
      results.created.push(`${emp.firstName} ${emp.lastName} (${emp.email}) - ${emp.position}`);
      console.log(`Created: ${emp.firstName} ${emp.lastName} - ${systemRole}`);

    } catch (error: any) {
      results.failed++;
      results.errors.push(`${emp.email}: ${error.message}`);
      console.error(`Failed: ${emp.email} - ${error.message}`);
    }
  }

  console.log('\n========== IMPORT COMPLETE ==========');
  console.log(`Success: ${results.success}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (results.skippedEmails.length > 0) {
    console.log('\nSkipped (already exist):');
    results.skippedEmails.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
