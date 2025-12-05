#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function pushDatabase() {
  try {
    console.log('Pushing database schema...');
    
    // For the version column question, we want to create it as new
    const { stdout, stderr } = await execAsync('yes 1 | npm run db:push', {
      shell: true
    });
    
    if (stdout) {
      console.log('Output:', stdout);
    }
    
    if (stderr) {
      console.error('Errors:', stderr);
    }
    
    console.log('Database push completed!');
  } catch (error) {
    console.error('Error pushing database:', error);
    process.exit(1);
  }
}

pushDatabase();