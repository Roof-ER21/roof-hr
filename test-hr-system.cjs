#!/usr/bin/env node

/**
 * Comprehensive Testing Script for HR Management System
 * Tests all pages and features systematically
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';
const TEST_RESULTS = [];
let AUTH_TOKEN = '';

// Test credentials
const TEST_USERS = {
  admin: {
    email: 'ahmed.mahmoud@theroofdocs.com',
    password: 'Test123!',
    firstName: 'Ahmed',
    lastName: 'Mahmoud',
    role: 'ADMIN'
  },
  manager: {
    email: 'test.manager@company.com',
    password: 'Manager123!',
    firstName: 'Test',
    lastName: 'Manager',
    role: 'MANAGER'
  },
  employee: {
    email: 'test.employee@company.com',
    password: 'Employee123!',
    firstName: 'Test',
    lastName: 'Employee',
    role: 'EMPLOYEE'
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testEndpoint(name, path, options = {}) {
  try {
    log(`\nTesting: ${name}`, 'cyan');
    const response = await makeRequest(path, options);
    
    if (response.status >= 200 && response.status < 300) {
      log(`  ✓ ${name} - Status: ${response.status}`, 'green');
      TEST_RESULTS.push({
        name,
        path,
        status: 'PASS',
        statusCode: response.status,
        data: response.data
      });
      return response;
    } else {
      log(`  ✗ ${name} - Status: ${response.status}`, 'red');
      if (response.data) {
        log(`    Error: ${JSON.stringify(response.data)}`, 'yellow');
      }
      TEST_RESULTS.push({
        name,
        path,
        status: 'FAIL',
        statusCode: response.status,
        error: response.data
      });
      return response;
    }
  } catch (error) {
    log(`  ✗ ${name} - Error: ${error.message}`, 'red');
    TEST_RESULTS.push({
      name,
      path,
      status: 'ERROR',
      error: error.message
    });
    return null;
  }
}

async function createTestUser(userType) {
  const user = TEST_USERS[userType];
  log(`\nCreating ${userType} user: ${user.email}`, 'blue');
  
  const response = await testEndpoint(
    `Create ${userType} user`,
    '/api/auth/register',
    {
      method: 'POST',
      body: user
    }
  );
  
  return response;
}

async function loginUser(userType) {
  const user = TEST_USERS[userType];
  log(`\nLogging in as ${userType}: ${user.email}`, 'blue');
  
  const response = await testEndpoint(
    `Login as ${userType}`,
    '/api/auth/login',
    {
      method: 'POST',
      body: {
        email: user.email,
        password: user.password
      }
    }
  );
  
  if (response && response.data && response.data.token) {
    AUTH_TOKEN = response.data.token;
    log(`  Token obtained: ${AUTH_TOKEN.substring(0, 20)}...`, 'green');
  }
  
  return response;
}

async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('HR MANAGEMENT SYSTEM - COMPREHENSIVE TEST SUITE', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  // 1. Test Basic Connectivity
  log('\n1. TESTING BASIC CONNECTIVITY', 'blue');
  log('-'.repeat(40), 'blue');
  await testEndpoint('Health Check', '/api/health');
  await testEndpoint('Root Page', '/');
  
  // 2. Test Authentication System
  log('\n2. TESTING AUTHENTICATION SYSTEM', 'blue');
  log('-'.repeat(40), 'blue');
  
  // Try to create admin user
  await createTestUser('admin');
  
  // Try to login as admin
  const loginResponse = await loginUser('admin');
  
  if (!AUTH_TOKEN) {
    log('\n⚠️  Could not obtain auth token. Creating default admin...', 'yellow');
    // Try with a simpler password
    TEST_USERS.admin.password = 'admin123';
    await createTestUser('admin');
    await loginUser('admin');
  }
  
  // Test auth validation
  await testEndpoint('Validate Session', '/api/auth/validate');
  
  // 3. Test API Endpoints
  log('\n3. TESTING API ENDPOINTS', 'blue');
  log('-'.repeat(40), 'blue');
  
  // User Management
  await testEndpoint('Get Users', '/api/users');
  await testEndpoint('Get Current User', '/api/users/me');
  
  // Employee Management
  await testEndpoint('Get Employees', '/api/employees');
  
  // PTO System
  await testEndpoint('Get PTO Requests', '/api/pto');
  await testEndpoint('Get PTO Policies', '/api/pto-policies');
  await testEndpoint('Get PTO Settings', '/api/settings');
  
  // Recruitment
  await testEndpoint('Get Candidates', '/api/candidates');
  await testEndpoint('Get Interviews', '/api/interviews');
  await testEndpoint('Get Job Postings', '/api/job-postings');
  
  // Documents
  await testEndpoint('Get Documents', '/api/documents');
  await testEndpoint('Get COI Documents', '/api/coi-documents');
  await testEndpoint('Get Contracts', '/api/contracts');
  
  // Tools & Equipment
  await testEndpoint('Get Tools', '/api/tools');
  await testEndpoint('Get Tool Assignments', '/api/tools/assignments');
  
  // Susan AI
  await testEndpoint('Get Susan AI Status', '/api/susan-ai/status');
  await testEndpoint('Get Susan AI Analytics', '/api/susan-ai/analytics?timeframe=month');
  await testEndpoint('Get HR Agents', '/api/hr-agents');
  
  // Email & Communication
  await testEndpoint('Get Email Templates', '/api/email-templates');
  await testEndpoint('Get Email Campaigns', '/api/email-campaigns');
  
  // Google Integration
  await testEndpoint('Get Google Auth Status', '/api/google-auth/status');
  await testEndpoint('Get Google Services Status', '/api/google-services/status');
  
  // Workflows
  await testEndpoint('Get Workflows', '/api/workflows');
  await testEndpoint('Get Workflow Templates', '/api/workflows/templates');
  
  // Analytics
  await testEndpoint('Get Analytics Overview', '/api/analytics/overview');
  await testEndpoint('Get Enterprise Analytics', '/api/analytics/enterprise');
  
  // Territories
  await testEndpoint('Get Territories', '/api/territories');
  
  // Employee Assignments
  await testEndpoint('Get Employee Assignments', '/api/employee-assignments');
  
  // 4. Test Page Routes
  log('\n4. TESTING PAGE ROUTES', 'blue');
  log('-'.repeat(40), 'blue');
  
  const pages = [
    '/dashboard',
    '/employees',
    '/pto',
    '/recruiting',
    '/documents',
    '/tools',
    '/susan-ai',
    '/google-integration',
    '/email-templates',
    '/workflow-builder',
    '/territories',
    '/pto-policies',
    '/coi-documents',
    '/contracts',
    '/employee-assignments',
    '/job-postings',
    '/enterprise-analytics',
    '/admin-control-hub',
    '/settings'
  ];
  
  for (const page of pages) {
    await testEndpoint(`Page: ${page}`, page);
  }
  
  // 5. Test Susan AI Chat
  log('\n5. TESTING SUSAN AI CHAT', 'blue');
  log('-'.repeat(40), 'blue');
  
  await testEndpoint('Susan AI Chat', '/api/susan-ai/chat', {
    method: 'POST',
    body: {
      message: 'Hello Susan, what can you help me with?',
      context: {}
    }
  });
  
  // 6. Test CRUD Operations
  log('\n6. TESTING CRUD OPERATIONS', 'blue');
  log('-'.repeat(40), 'blue');
  
  // Test creating a PTO request
  const ptoRequest = await testEndpoint('Create PTO Request', '/api/pto', {
    method: 'POST',
    body: {
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Test vacation request'
    }
  });
  
  // Test creating a candidate
  const candidate = await testEndpoint('Create Candidate', '/api/candidates', {
    method: 'POST',
    body: {
      firstName: 'Test',
      lastName: 'Candidate',
      email: 'test.candidate@example.com',
      phone: '555-0123',
      position: 'Software Developer',
      notes: 'Test candidate created by automated test'
    }
  });
  
  // 7. Generate Summary Report
  log('\n' + '='.repeat(60), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const passed = TEST_RESULTS.filter(r => r.status === 'PASS').length;
  const failed = TEST_RESULTS.filter(r => r.status === 'FAIL').length;
  const errors = TEST_RESULTS.filter(r => r.status === 'ERROR').length;
  const total = TEST_RESULTS.length;
  
  log(`\nTotal Tests: ${total}`, 'blue');
  log(`Passed: ${passed} (${Math.round(passed/total*100)}%)`, 'green');
  log(`Failed: ${failed} (${Math.round(failed/total*100)}%)`, failed > 0 ? 'red' : 'green');
  log(`Errors: ${errors} (${Math.round(errors/total*100)}%)`, errors > 0 ? 'red' : 'green');
  
  // List failed tests
  if (failed > 0 || errors > 0) {
    log('\nFAILED/ERROR TESTS:', 'red');
    TEST_RESULTS.filter(r => r.status !== 'PASS').forEach(test => {
      log(`  - ${test.name} (${test.path}): ${test.status} ${test.statusCode || ''}`, 'yellow');
      if (test.error) {
        log(`    ${JSON.stringify(test.error)}`, 'yellow');
      }
    });
  }
  
  // Write detailed report to file
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      errors,
      passRate: Math.round(passed/total*100)
    },
    results: TEST_RESULTS
  };
  
  fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  log('\nDetailed report saved to test-report.json', 'cyan');
  
  // Recommendations
  log('\n' + '='.repeat(60), 'cyan');
  log('RECOMMENDATIONS', 'cyan');
  log('='.repeat(60), 'cyan');
  
  if (AUTH_TOKEN) {
    log('\n✓ Authentication system is working', 'green');
  } else {
    log('\n✗ Authentication system needs attention', 'red');
    log('  - Check if users exist in database', 'yellow');
    log('  - Verify password hashing is working', 'yellow');
  }
  
  const criticalEndpoints = [
    '/api/users',
    '/api/employees',
    '/api/pto',
    '/api/candidates'
  ];
  
  const criticalFailures = TEST_RESULTS.filter(r => 
    criticalEndpoints.includes(r.path) && r.status !== 'PASS'
  );
  
  if (criticalFailures.length > 0) {
    log('\n✗ Critical endpoints are failing:', 'red');
    criticalFailures.forEach(f => {
      log(`  - ${f.path}`, 'yellow');
    });
  } else {
    log('\n✓ All critical endpoints are operational', 'green');
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  log('TEST COMPLETE', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
}

// Run the tests
runTests().catch(error => {
  log(`\nFATAL ERROR: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});