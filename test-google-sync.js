#!/usr/bin/env node

/**
 * Test script for Google Services Bidirectional Sync
 * Tests the following functionality:
 * 1. Export tools inventory to Google Sheets
 * 2. Import tools inventory from Google Sheets
 * 3. Sync documents from Google Drive
 * 4. Verify bidirectional sync is working
 */

import fetch from 'node-fetch';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000';

// Helper function to make authenticated requests
async function makeRequest(endpoint, method = 'GET', body = null) {
  const cookies = fs.existsSync('cookies.txt') ? fs.readFileSync('cookies.txt', 'utf8').trim() : '';
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  return { status: response.status, data };
}

// Test Google Services Connection
async function testGoogleConnection() {
  console.log('\n🔄 Testing Google Services Connection...');
  
  const { status, data } = await makeRequest('/api/google/test-connection');
  
  if (status === 200 && data.success) {
    console.log('✅ Google Services Connected:');
    console.log(`  - Gmail: ${data.status.gmail.connected ? '✓' : '✗'}`);
    console.log(`  - Calendar: ${data.status.calendar.connected ? '✓' : '✗'}`);
    console.log(`  - Drive: ${data.status.drive.connected ? '✓' : '✗'}`);
    console.log(`  - Sheets: ${data.status.sheets.connected ? '✓' : '✗'}`);
    console.log(`  - Docs: ${data.status.docs.connected ? '✓' : '✗'}`);
    return true;
  } else {
    console.log('❌ Google Services Not Connected');
    console.log('   Please complete OAuth setup at /google-oauth-setup');
    return false;
  }
}

// Test Tools Inventory Export to Google Sheets
async function testToolsExport() {
  console.log('\n📤 Testing Tools Export to Google Sheets...');
  
  // First, get current tools inventory
  const { status: invStatus, data: inventory } = await makeRequest('/api/tools/inventory');
  
  if (invStatus === 200) {
    console.log(`  Found ${inventory.length} tools in inventory`);
  }
  
  // Export to Google Sheets
  const { status, data } = await makeRequest('/api/tools/sync-sheets', 'POST');
  
  if (status === 200) {
    console.log('✅ Tools exported to Google Sheets successfully');
    console.log(`  Message: ${data.message}`);
    return true;
  } else {
    console.log('❌ Failed to export tools to Google Sheets');
    console.log(`  Error: ${data.error || 'Unknown error'}`);
    return false;
  }
}

// Test Tools Inventory Import from Google Sheets
async function testToolsImport(spreadsheetId) {
  console.log('\n📥 Testing Tools Import from Google Sheets...');
  
  if (!spreadsheetId) {
    console.log('  ⚠️  No spreadsheet ID provided, skipping import test');
    return false;
  }
  
  const { status, data } = await makeRequest('/api/tools/import-sheets', 'POST', { spreadsheetId });
  
  if (status === 200) {
    console.log('✅ Tools imported from Google Sheets successfully');
    console.log(`  Created: ${data.created} new tools`);
    console.log(`  Updated: ${data.updated} existing tools`);
    console.log(`  Total: ${data.total} tools processed`);
    return true;
  } else {
    console.log('❌ Failed to import tools from Google Sheets');
    console.log(`  Error: ${data.error || 'Unknown error'}`);
    return false;
  }
}

// Test Document Sync from Google Drive
async function testDocumentSync() {
  console.log('\n📁 Testing Document Sync from Google Drive...');
  
  const { status, data } = await makeRequest('/api/documents/sync-from-drive', 'POST');
  
  if (status === 200) {
    console.log('✅ Documents synced from Google Drive successfully');
    console.log(`  Synced: ${data.syncedCount} documents`);
    console.log(`  Message: ${data.message}`);
    return true;
  } else {
    console.log('❌ Failed to sync documents from Google Drive');
    console.log(`  Error: ${data.error || 'Unknown error'}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('========================================');
  console.log('Google Services Bidirectional Sync Test');
  console.log('========================================');
  
  try {
    // Test Google connection first
    const isConnected = await testGoogleConnection();
    
    if (!isConnected) {
      console.log('\n⚠️  Google Services not connected. Please complete OAuth setup first.');
      return;
    }
    
    // Test Tools Export
    const exportSuccess = await testToolsExport();
    
    // Test Tools Import (if you have a spreadsheet ID)
    // Replace with actual spreadsheet ID if available
    const spreadsheetId = process.env.TEST_SPREADSHEET_ID || null;
    if (spreadsheetId) {
      await testToolsImport(spreadsheetId);
    }
    
    // Test Document Sync
    const docSyncSuccess = await testDocumentSync();
    
    // Summary
    console.log('\n========================================');
    console.log('Test Summary:');
    console.log('========================================');
    console.log(`Google Services Connected: ✅`);
    console.log(`Tools Export to Sheets: ${exportSuccess ? '✅' : '❌'}`);
    console.log(`Document Sync from Drive: ${docSyncSuccess ? '✅' : '❌'}`);
    
    if (exportSuccess && docSyncSuccess) {
      console.log('\n🎉 All sync tests passed! Bidirectional sync is working.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the errors above.');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
  }
}

// Run the tests
runTests();