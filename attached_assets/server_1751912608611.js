#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Main HR App for Replit...\n');

// Ensure database exists
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Function to run command and return promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`📦 Running: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function setupAndStart() {
  try {
    // Install dependencies
    console.log('📦 Installing dependencies...');
    await runCommand('npm', ['install']);

    // Generate Prisma client
    console.log('🗃️ Setting up database...');
    await runCommand('npx', ['prisma', 'generate']);
    
    // Push database schema
    await runCommand('npx', ['prisma', 'db', 'push']);

    // Build the application
    console.log('🔨 Building application...');
    await runCommand('npm', ['run', 'build']);

    // Start the production server
    console.log('🌟 Starting production server...');
    const server = spawn('npm', ['start'], {
      stdio: 'inherit',
      shell: false
    });

    // Handle server process
    server.on('close', (code) => {
      console.log(`Server exited with code ${code}`);
      process.exit(code);
    });

    // Handle shutdown signals
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      server.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down server...');
      server.kill('SIGTERM');
    });

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupAndStart();