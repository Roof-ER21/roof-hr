import { setupDemoData } from './server/demo-data.js';

console.log('Running setupDemoData to initialize tool inventory...');
await setupDemoData();
console.log('Done!');
process.exit(0);
