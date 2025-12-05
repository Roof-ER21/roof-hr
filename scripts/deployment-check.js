#!/usr/bin/env node

/**
 * Deployment checklist script
 * Run this before deploying to production to verify everything is set up correctly
 */

console.log('🚀 Running deployment checklist...\n');

let hasErrors = false;

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion < 20) {
  console.error('❌ Node.js version 20.x or higher is required');
  console.error(`   Current version: ${nodeVersion}`);
  hasErrors = true;
} else {
  console.log(`✅ Node.js version: ${nodeVersion}`);
}

// Check environment variables
const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET', 'NODE_ENV'];
const envVars = {};

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    envVars[varName] = '✅ Set';
    if (varName === 'DATABASE_URL' && !process.env[varName].includes('sslmode=require')) {
      console.warn(`⚠️  ${varName} should include sslmode=require for production`);
    }
    if (varName === 'SESSION_SECRET' && process.env[varName].length < 32) {
      console.error(`❌ ${varName} should be at least 32 characters long`);
      hasErrors = true;
    }
  } else {
    envVars[varName] = '❌ Missing';
    hasErrors = true;
  }
});

console.log('\nEnvironment Variables:');
Object.entries(envVars).forEach(([key, value]) => {
  console.log(`  ${value} ${key}`);
});

// Check if production build exists
const fs = require('fs');
const path = require('path');

console.log('\nBuild Status:');
const distPath = path.join(__dirname, '..', 'dist');
const distIndexPath = path.join(distPath, 'index.js');
const distPublicPath = path.join(distPath, 'public');

if (fs.existsSync(distIndexPath)) {
  console.log('✅ Server build found (dist/index.js)');
} else {
  console.error('❌ Server build not found - run "npm run build"');
  hasErrors = true;
}

if (fs.existsSync(distPublicPath)) {
  console.log('✅ Client build found (dist/public/)');
} else {
  console.error('❌ Client build not found - run "npm run build"');
  hasErrors = true;
}

// Check package.json for security vulnerabilities
console.log('\nDependency Check:');
try {
  const { execSync } = require('child_process');
  execSync('npm audit --production', { stdio: 'pipe' });
  console.log('✅ No known vulnerabilities in production dependencies');
} catch (error) {
  console.warn('⚠️  Run "npm audit" to check for vulnerabilities');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('\n❌ Deployment checklist failed!');
  console.error('   Please fix the issues above before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed! Ready for deployment.');
  console.log('\nNext steps:');
  console.log('1. Run "npm run build" to create production build');
  console.log('2. Deploy to your hosting platform');
  console.log('3. Run database migrations with "npm run db:push"');
  console.log('4. Verify the application is running correctly');
}