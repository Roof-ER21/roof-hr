import { storage } from '../storage';

async function listUsers() {
  try {
    const allUsers = await storage.getAllUsers();
    console.log(`Total users in database: ${allUsers.length}\n`);

    // Look for anyone with "Ryan" or "Ferguson" or "careers"
    const matches = allUsers.filter(u =>
      u.firstName?.toLowerCase().includes('ryan') ||
      u.lastName?.toLowerCase().includes('ferguson') ||
      u.email?.toLowerCase().includes('careers') ||
      u.email?.toLowerCase().includes('ryan')
    );

    if (matches.length > 0) {
      console.log('Found potential matches:');
      matches.forEach(u => {
        console.log(`  - ${u.firstName} ${u.lastName} (${u.email}) - ID: ${u.id}`);
      });
    } else {
      console.log('No users found matching Ryan Ferguson or careers@theroofdocs.com');
    }

    console.log('\nAll users with @theroofdocs.com email:');
    const roofUsers = allUsers.filter(u => u.email?.includes('@theroofdocs.com'));
    roofUsers.forEach(u => {
      console.log(`  - ${u.firstName} ${u.lastName} (${u.email}) - ID: ${u.id}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

listUsers();
