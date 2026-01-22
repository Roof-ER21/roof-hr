import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq, inArray } from 'drizzle-orm';

async function checkUsers() {
  try {
    const emails = [
      'careers@theroofdocs.com',      // Ryan
      'help@theroofdocs.com',          // Help
      'ahmed.mahmoud@theroofdocs.com', // Ahmed
      'ford.barsi@theroofdocs.com',    // Ford
      'reese.samala@theroofdocs.com',  // Reese
      'oliver.brown@theroofdocs.com'   // Oliver
    ];

    const foundUsers = await db.select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isActive: users.isActive
    }).from(users).where(inArray(users.email, emails));

    console.log('='.repeat(60));
    console.log('USER ACCESS REPORT - Tools & Equipment');
    console.log('='.repeat(60));
    console.log('');

    for (const email of emails) {
      const user = foundUsers.find(u => u.email === email);
      if (user) {
        const hasAccess = ['HR_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'TRUE_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER'].includes(user.role);
        console.log(`${user.firstName} ${user.lastName}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Active: ${user.isActive}`);
        console.log(`  Tools Access: ${hasAccess ? '✅ FULL' : '❌ LIMITED'}`);
        console.log('');
      } else {
        console.log(`${email}: NOT FOUND`);
        console.log('');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();
