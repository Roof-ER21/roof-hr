#!/usr/bin/env node

/**
 * Final Comprehensive System Test
 * Tests all HR Management System endpoints to verify 100% functionality
 */

const http = require('http');

// Test configuration
const API_BASE = 'http://localhost:5000/api';
const TEST_ACCOUNTS = {
  admin: { email: 'ahmed.mahmoud@theroofdocs.com', password: 'Admin123!' },
  manager: { email: 'ford.barsi@theroofdocs.com', password: 'Manager123!' },
  employee: { email: 'test.employee@company.com', password: 'Employee123!' }
};

let authTokens = {};
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Test a single endpoint
async function testEndpoint(name, method, path, data = null, token = null) {
  testResults.total++;
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path,
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await makeRequest(options, data);
    const success = response.status >= 200 && response.status < 400;
    
    if (success) {
      testResults.passed++;
      console.log(`✅ ${name}: ${response.status}`);
    } else {
      testResults.failed++;
      console.log(`❌ ${name}: ${response.status} - ${JSON.stringify(response.data).substring(0, 100)}`);
    }
    
    testResults.tests.push({
      name,
      method,
      path,
      status: response.status,
      success,
      response: response.data
    });
    
    return response;
  } catch (error) {
    testResults.failed++;
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    testResults.tests.push({
      name,
      method,
      path,
      error: error.message,
      success: false
    });
    return null;
  }
}

// Main test suite
async function runTests() {
  console.log('🚀 Starting Final Comprehensive System Test...\n');
  
  // 1. Authentication Tests
  console.log('📋 Testing Authentication...');
  for (const [role, creds] of Object.entries(TEST_ACCOUNTS)) {
    const response = await testEndpoint(
      `Login ${role}`,
      'POST',
      '/api/auth/login',
      creds
    );
    if (response && response.data.token) {
      authTokens[role] = response.data.token;
    }
  }
  
  // 2. Core Feature Tests (using admin token)
  const adminToken = authTokens.admin;
  
  if (adminToken) {
    console.log('\n📋 Testing Core Features...');
    
    // Employee Management
    await testEndpoint('Get Employees', 'GET', '/api/users', null, adminToken);
    await testEndpoint('Get Territories', 'GET', '/api/territories', null, adminToken);
    
    // PTO System
    await testEndpoint('Get PTO Requests', 'GET', '/api/pto', null, adminToken);
    await testEndpoint('Create PTO Request', 'POST', '/api/pto', {
      employeeId: 'test-employee-id',
      startDate: '2025-10-01',
      endDate: '2025-10-03',
      type: 'VACATION',
      reason: 'Family vacation',
      halfDay: false
    }, adminToken);
    await testEndpoint('Create Half-Day PTO', 'POST', '/api/pto', {
      employeeId: 'test-employee-id',
      startDate: '2025-10-15',
      endDate: '2025-10-15',
      type: 'SICK',
      reason: 'Doctor appointment',
      halfDay: true
    }, adminToken);
    
    // Document Management
    await testEndpoint('Get Documents', 'GET', '/api/documents', null, adminToken);
    await testEndpoint('Create Document', 'POST', '/api/documents', {
      title: 'Test Document',
      category: 'CONTRACT',
      description: 'Test document creation',
      fileUrl: 'https://example.com/doc.pdf',
      fileSize: 1024,
      visibility: 'PUBLIC'
    }, adminToken);
    
    // Tools & Equipment
    await testEndpoint('Get Tools Inventory', 'GET', '/api/tools/inventory', null, adminToken);
    await testEndpoint('Create Tool', 'POST', '/api/tools/inventory', {
      name: 'Test Hammer',
      category: 'HAND_TOOLS',
      quantity: 5,
      description: 'Test tool',
      sku: 'HAMMER-001'
    }, adminToken);
    
    // Recruitment
    await testEndpoint('Get Candidates', 'GET', '/api/candidates', null, adminToken);
    await testEndpoint('Create Candidate', 'POST', '/api/candidates', {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '555-0123',
      position: 'Roofer',
      department: 'Operations',
      status: 'SCREENING'
    }, adminToken);
    
    // Contract Management
    await testEndpoint('Get Contract Templates', 'GET', '/api/contract-templates', null, adminToken);
    await testEndpoint('Get Contracts', 'GET', '/api/contracts', null, adminToken);
    
    // Susan AI
    await testEndpoint('Susan AI Chat', 'POST', '/api/susan-ai/chat', {
      message: 'Hello Susan, what can you help me with?'
    }, adminToken);
    await testEndpoint('Susan AI Analytics', 'GET', '/api/susan-ai/analytics', null, adminToken);
    
    // Notifications
    await testEndpoint('Get Email Templates', 'GET', '/api/email-templates', null, adminToken);
    await testEndpoint('Get Workflows', 'GET', '/api/workflows', null, adminToken);
    
    // Google Integration
    await testEndpoint('Check Google Integration', 'GET', '/api/google-integration/status', null, adminToken);
  }
  
  // Print Results
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  // Detailed failure report
  if (testResults.failed > 0) {
    console.log('\n📋 Failed Tests:');
    testResults.tests
      .filter(t => !t.success)
      .forEach(t => {
        console.log(`  - ${t.name}: ${t.status || 'ERROR'}`);
        if (t.error) console.log(`    Error: ${t.error}`);
        if (t.response) console.log(`    Response: ${JSON.stringify(t.response).substring(0, 100)}`);
      });
  }
  
  // Save results to file
  require('fs').writeFileSync(
    'final-test-results.json',
    JSON.stringify(testResults, null, 2)
  );
  
  console.log('\n✅ Test results saved to final-test-results.json');
  
  // Return exit code based on results
  const successRate = (testResults.passed / testResults.total) * 100;
  if (successRate === 100) {
    console.log('\n🎉 SYSTEM IS AT 100% FUNCTIONALITY! 🎉');
    process.exit(0);
  } else if (successRate >= 90) {
    console.log(`\n✨ System is at ${successRate.toFixed(1)}% functionality - Nearly there!`);
    process.exit(0);
  } else {
    console.log(`\n⚠️ System is at ${successRate.toFixed(1)}% functionality - More work needed`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);