import { db } from '../server/db';
import { employees, users } from '../shared/schema';
import { eq, like } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../server/email-service';

async function createUserAccounts() {
  console.log('Checking employees with @theroofdocs.com emails...\n');
  
  // Get all employees with @theroofdocs.com emails
  const roofEmployees = await db.select().from(employees)
    .where(like(employees.email, '%@theroofdocs.com'));
  
  console.log(`Found ${roofEmployees.length} employees with @theroofdocs.com emails\n`);
  
  // Get existing users
  const existingUsers = await db.select().from(users);
  const existingEmails = new Set(existingUsers.map(u => u.email?.toLowerCase()));
  
  // Determine roles
  const adminEmails = new Set([
    'ahmed.mahmoud@theroofdocs.com',
    'oliver.brown@theroofdocs.com', 
    'reese.samala@theroofdocs.com',
    'ford.barsi@theroofdocs.com'
  ]);
  
  const managerEmails = new Set([
    'careers@theroofdocs.com' // Ryan Ferguson
  ]);
  
  const emailService = new EmailService();
  const newAccounts: Array<{email: string, name: string, password: string, role: string}> = [];
  
  // Create accounts for those who don't have one
  for (const emp of roofEmployees) {
    if (!emp.email) continue;
    
    const emailLower = emp.email.toLowerCase();
    const fullName = `${emp.firstName} ${emp.lastName}`;
    
    if (!existingEmails.has(emailLower)) {
      console.log(`Creating account for: ${fullName} (${emp.email})`);
      
      const tempPassword = `Welcome@${Math.random().toString(36).substr(2, 8)}`;
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      const role = adminEmails.has(emailLower) ? 'admin' : 
                   managerEmails.has(emailLower) ? 'manager' : 'employee';
      
      await db.insert(users).values({
        id: uuidv4(),
        email: emp.email,
        password: hashedPassword,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: role,
        employeeId: emp.id
      });
      
      console.log(`  ✓ Created with role: ${role}`);
      
      newAccounts.push({
        email: emp.email,
        name: fullName,
        password: tempPassword,
        role: role
      });
      
    } else {
      // Update role if needed
      const existingUser = existingUsers.find(u => u.email?.toLowerCase() === emailLower);
      if (existingUser) {
        const expectedRole = adminEmails.has(emailLower) ? 'admin' : 
                           managerEmails.has(emailLower) ? 'manager' : 'employee';
        
        if (existingUser.role !== expectedRole) {
          console.log(`Updating role for ${emp.email} from ${existingUser.role} to ${expectedRole}`);
          await db.update(users)
            .set({ role: expectedRole })
            .where(eq(users.id, existingUser.id));
          console.log(`  ✓ Role updated`);
        }
      }
    }
  }
  
  console.log('\n═══════════════════════════════════════════');
  console.log('Account creation complete!');
  console.log('═══════════════════════════════════════════\n');
  
  // Send welcome emails for new accounts
  if (newAccounts.length > 0) {
    console.log('Sending welcome emails for new accounts...\n');
    for (const account of newAccounts) {
      try {
        await emailService.sendWelcomeEmail(
          account.email,
          account.name,
          account.password
        );
        console.log(`  ✓ Welcome email sent to ${account.email}`);
      } catch (error) {
        console.error(`  ✗ Failed to send email to ${account.email}:`, error);
      }
    }
  }
  
  // List all accounts with their roles
  const allUsers = await db.select().from(users);
  console.log('\n═══════════════════════════════════════════');
  console.log('All User Accounts Summary');
  console.log('═══════════════════════════════════════════\n');
  
  const adminUsers = allUsers.filter(u => u.role === 'admin');
  const managerUsers = allUsers.filter(u => u.role === 'manager');
  const employeeUsers = allUsers.filter(u => u.role === 'employee');
  
  console.log('ADMINISTRATORS:');
  for (const user of adminUsers) {
    console.log(`  • ${user.email} - ${user.firstName} ${user.lastName}`);
  }
  
  console.log('\nMANAGERS:');
  for (const user of managerUsers) {
    console.log(`  • ${user.email} - ${user.firstName} ${user.lastName}`);
  }
  
  console.log('\nEMPLOYEES:');
  for (const user of employeeUsers) {
    console.log(`  • ${user.email} - ${user.firstName} ${user.lastName}`);
  }
  
  console.log('\n═══════════════════════════════════════════');
  console.log(`Total: ${allUsers.length} accounts`);
  console.log(`${adminUsers.length} Admins | ${managerUsers.length} Managers | ${employeeUsers.length} Employees`);
  console.log('═══════════════════════════════════════════');
  
  // Show new accounts with temporary passwords
  if (newAccounts.length > 0) {
    console.log('\n⚠️  NEW ACCOUNTS CREATED:');
    console.log('The following accounts were created with temporary passwords:');
    console.log('Users will be prompted to change their password on first login.\n');
    for (const account of newAccounts) {
      console.log(`${account.name} (${account.role})`);
      console.log(`  Email: ${account.email}`);
      console.log(`  Temp Password: ${account.password}`);
      console.log('');
    }
  }
}

createUserAccounts().catch(console.error);