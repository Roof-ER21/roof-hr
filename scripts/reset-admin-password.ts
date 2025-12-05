import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function resetAdminPassword() {
  try {
    const adminEmail = 'cadell.barnes@theroofdocs.com';
    const newPassword = 'Admin123!';
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await db
      .update(users)
      .set({ 
        passwordHash: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.email, adminEmail))
      .returning();
    
    if (result.length > 0) {
      console.log(`✅ Password reset successfully for ${adminEmail}`);
      console.log(`   New password: ${newPassword}`);
    } else {
      console.log(`❌ User not found: ${adminEmail}`);
    }
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    process.exit();
  }
}

resetAdminPassword();