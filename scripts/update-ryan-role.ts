import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function updateRyan() {
  try {
    // First check current status
    const [ryan] = await db.select().from(users).where(eq(users.email, 'careers@theroofdocs.com'));

    if (!ryan) {
      console.log('User careers@theroofdocs.com not found');
      process.exit(1);
    }

    console.log('Current Ryan account:');
    console.log('  Email:', ryan.email);
    console.log('  Name:', ryan.firstName, ryan.lastName);
    console.log('  Role:', ryan.role);
    console.log('  Active:', ryan.isActive);

    // Update to HR_ADMIN role (ultimate access)
    await db.update(users)
      .set({ role: 'HR_ADMIN', updatedAt: new Date() })
      .where(eq(users.email, 'careers@theroofdocs.com'));

    console.log('\n✓ Updated Ryan to HR_ADMIN role (ultimate access)');

    // Verify
    const [updated] = await db.select().from(users).where(eq(users.email, 'careers@theroofdocs.com'));
    console.log('\nUpdated Role:', updated.role);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateRyan();
