import { execSync } from 'child_process';

// Force push database schema with automatic yes responses
console.log('Force pushing database schema...');

try {
  // Create all required columns programmatically
  const stdin = Buffer.from('1\n'.repeat(20)); // Select "create column" for all prompts
  
  execSync('npx drizzle-kit push', {
    input: stdin,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  
  console.log('Database schema pushed successfully!');
} catch (error) {
  console.error('Error pushing schema:', error.message);
  process.exit(1);
}