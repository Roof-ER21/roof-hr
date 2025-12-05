import bcrypt from 'bcrypt';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function updateAhmedPassword() {
  try {
    const hashedPassword = await bcrypt.hash('Roofer21!', 10);
    
    const result = await db
      .update(users)
      .set({ 
        passwordHash: hashedPassword,
        mustChangePassword: false
      })
      .where(eq(users.email, 'ahmed.mahmoud@theroofdocs.com'))
      .returning();
    
    if (result.length > 0) {
      console.log('✅ Successfully updated Ahmed\'s password to Roofer21!');
      console.log('Email: ahmed.mahmoud@theroofdocs.com');
      console.log('Password: Roofer21!');
    } else {
      console.log('❌ Ahmed user not found');
    }
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    process.exit(0);
  }
}

updateAhmedPassword();