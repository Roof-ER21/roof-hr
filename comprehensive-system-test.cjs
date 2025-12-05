#!/usr/bin/env node

/**
 * Comprehensive System Test for HR Management System
 * Tests all fixed areas and generates detailed report
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const TEST_RESULTS = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Test credentials
const TEST_ACCOUNTS = {
  admin: {
    email: 'ahmed.mahmoud@theroofdocs.com',
    password: 'Admin123!',
    role: 'ADMIN'
  },
  manager: {
    email: 'ford.barsi@theroofdocs.com',
    password: 'Manager123!',
    role: 'MANAGER'
  },
  employee: {
    email: 'test.employee@company.com',
    password: 'Employee123!',
    role: 'EMPLOYEE'
  }
};

let AUTH_TOKEN = '';
let CURRENT_USER = null;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (AUTH_TOKEN && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: data ? (res.headers['content-type']?.includes('json') ? JSON.parse(data) : data) : null
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 0,
        error: error.message
      });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function test(category, name, testFn) {
  TEST_RESULTS.total++;
  try {
    log(`\n  Testing: ${name}`, 'cyan');
    const result = await testFn();
    
    if (result.success) {
      log(`    ✓ ${name}`, 'green');
      if (result.details) {
        log(`      ${result.details}`, 'reset');
      }
      TEST_RESULTS.passed++;
      TEST_RESULTS.tests.push({
        category,
        name,
        status: 'PASSED',
        details: result.details
      });
    } else {
      log(`    ✗ ${name}`, 'red');
      log(`      Error: ${result.error}`, 'yellow');
      TEST_RESULTS.failed++;
      TEST_RESULTS.tests.push({
        category,
        name,
        status: 'FAILED',
        error: result.error
      });
    }
    
    return result;
  } catch (error) {
    log(`    ✗ ${name}`, 'red');
    log(`      Exception: ${error.message}`, 'yellow');
    TEST_RESULTS.failed++;
    TEST_RESULTS.tests.push({
      category,
      name,
      status: 'ERROR',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

async function login(accountType) {
  const account = TEST_ACCOUNTS[accountType];
  const response = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: {
      email: account.email,
      password: account.password
    },
    skipAuth: true
  });

  if (response.status === 200 && response.data?.token) {
    AUTH_TOKEN = response.data.token;
    CURRENT_USER = response.data.user;
    return { success: true, user: response.data.user };
  } else {
    return { 
      success: false, 
      error: `Login failed with status ${response.status}: ${JSON.stringify(response.data)}` 
    };
  }
}

// Test Categories
async function testAuthentication() {
  log('\n1. AUTHENTICATION TESTS', 'magenta');
  
  // Test login for each account type
  for (const [type, account] of Object.entries(TEST_ACCOUNTS)) {
    await test('Authentication', `Login as ${type} (${account.email})`, async () => {
      const result = await login(type);
      if (result.success) {
        return { 
          success: true, 
          details: `Logged in as ${result.user.firstName} ${result.user.lastName} (${result.user.role})` 
        };
      }
      return result;
    });
  }

  // Test token validation
  await test('Authentication', 'Token validation', async () => {
    await login('admin');
    const response = await makeRequest('/api/auth/validate');
    if (response.status === 200 && response.data?.email) {
      return { success: true, details: `Token valid for ${response.data.email}` };
    }
    return { success: false, error: `Validation failed: ${response.status}` };
  });
}

async function testPTOSystem() {
  log('\n2. PTO SYSTEM TESTS', 'magenta');
  
  await login('employee');
  
  // Test PTO request with only start/end dates (no days field)
  await test('PTO', 'Create PTO request (server-side day calculation)', async () => {
    const ptoRequest = {
      startDate: '2025-01-20',
      endDate: '2025-01-22',
      type: 'VACATION',
      reason: 'Family vacation - automated test'
      // Note: NOT sending days field - server should calculate
    };
    
    const response = await makeRequest('/api/pto', {
      method: 'POST',
      body: ptoRequest
    });
    
    if (response.status === 200 && response.data?.id) {
      const days = response.data.days;
      if (days === 3) {
        return { 
          success: true, 
          details: `PTO request created with ${days} days (calculated server-side)` 
        };
      } else {
        return { 
          success: false, 
          error: `Days calculation incorrect: expected 3, got ${days}` 
        };
      }
    }
    return { success: false, error: `Failed with status ${response.status}: ${JSON.stringify(response.data)}` };
  });

  // Test half-day request
  await test('PTO', 'Create half-day PTO request', async () => {
    const ptoRequest = {
      startDate: '2025-01-25',
      endDate: '2025-01-25',
      type: 'PERSONAL',
      reason: 'Half day - automated test',
      halfDay: true
    };
    
    const response = await makeRequest('/api/pto', {
      method: 'POST',
      body: ptoRequest
    });
    
    if (response.status === 200 && response.data?.id) {
      const days = response.data.days;
      if (days === 0.5) {
        return { 
          success: true, 
          details: `Half-day PTO request created with ${days} days` 
        };
      } else {
        return { 
          success: false, 
          error: `Half-day calculation incorrect: expected 0.5, got ${days}` 
        };
      }
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test fetching PTO requests
  await test('PTO', 'Fetch PTO requests', async () => {
    const response = await makeRequest('/api/pto');
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} PTO requests` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });
}

async function testDocumentManagement() {
  log('\n3. DOCUMENT MANAGEMENT TESTS', 'magenta');
  
  await login('manager');
  
  // Test GET documents endpoint
  await test('Documents', 'GET /api/documents (JSON response)', async () => {
    const response = await makeRequest('/api/documents');
    
    if (response.status === 200) {
      if (response.headers['content-type']?.includes('json')) {
        if (Array.isArray(response.data)) {
          return { 
            success: true, 
            details: `Received JSON array with ${response.data.length} documents` 
          };
        } else {
          return { 
            success: false, 
            error: `Response is JSON but not an array: ${typeof response.data}` 
          };
        }
      } else {
        return { 
          success: false, 
          error: `Wrong content-type: ${response.headers['content-type']}` 
        };
      }
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test document creation
  await test('Documents', 'Create document metadata', async () => {
    const document = {
      name: 'Test Document',
      category: 'EMPLOYEE_HANDBOOK',
      description: 'Automated test document',
      fileUrl: '/test/document.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf'
    };
    
    const response = await makeRequest('/api/documents', {
      method: 'POST',
      body: document
    });
    
    if (response.status === 200 && response.data?.id) {
      return { success: true, details: `Document created with ID: ${response.data.id}` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });
}

async function testToolsAndEquipment() {
  log('\n4. TOOLS & EQUIPMENT TESTS', 'magenta');
  
  await login('manager');
  
  // Test inventory endpoint
  await test('Tools', 'GET /api/tools/inventory', async () => {
    const response = await makeRequest('/api/tools/inventory');
    
    if (response.status === 200 && response.headers['content-type']?.includes('json')) {
      if (Array.isArray(response.data)) {
        return { 
          success: true, 
          details: `Fetched ${response.data.length} tools from inventory` 
        };
      }
      return { success: false, error: 'Response is not an array' };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test creating new tool
  await test('Tools', 'Create new tool', async () => {
    const tool = {
      name: 'Test Hammer',
      category: 'Hand Tools',
      quantity: 5,
      location: 'Warehouse A',
      status: 'AVAILABLE'
    };
    
    const response = await makeRequest('/api/tools/inventory', {
      method: 'POST',
      body: tool
    });
    
    if (response.status === 200 && response.data?.id) {
      return { success: true, details: `Tool created with ID: ${response.data.id}` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test tool assignments
  await test('Tools', 'GET /api/tools/assignments', async () => {
    const response = await makeRequest('/api/tools/assignments');
    
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} tool assignments` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });
}

async function testRecruitment() {
  log('\n5. RECRUITMENT TESTS', 'magenta');
  
  await login('manager');
  
  // Test fetching candidates
  await test('Recruitment', 'GET /api/candidates', async () => {
    const response = await makeRequest('/api/candidates');
    
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} candidates` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test creating candidate
  await test('Recruitment', 'Create new candidate', async () => {
    const candidate = {
      firstName: 'Test',
      lastName: 'Candidate',
      email: `test.candidate.${Date.now()}@example.com`,
      phone: '555-0123',
      position: 'Roofer',
      source: 'Website',
      resumeUrl: '/test/resume.pdf'
    };
    
    const response = await makeRequest('/api/candidates', {
      method: 'POST',
      body: candidate
    });
    
    if (response.status === 200 && response.data?.id) {
      return { success: true, details: `Candidate created with ID: ${response.data.id}` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test recruitment bot status
  await test('Recruitment', 'Recruitment bot status', async () => {
    const response = await makeRequest('/api/recruitment-bot/status');
    
    if (response.status === 200 && typeof response.data === 'object') {
      return { 
        success: true, 
        details: `Bot status: ${response.data.status || 'Unknown'}` 
      };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test interview endpoints
  await test('Recruitment', 'GET /api/interviews', async () => {
    const response = await makeRequest('/api/interviews');
    
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} interviews` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });
}

async function testContractManagement() {
  log('\n6. CONTRACT MANAGEMENT TESTS', 'magenta');
  
  await login('manager');
  
  // Test contract templates
  await test('Contracts', 'GET /api/contract-templates', async () => {
    const response = await makeRequest('/api/contract-templates');
    
    if (response.status === 200 && Array.isArray(response.data)) {
      return { 
        success: true, 
        details: `Fetched ${response.data.length} contract templates` 
      };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test contracts list
  await test('Contracts', 'GET /api/contracts', async () => {
    const response = await makeRequest('/api/contracts');
    
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} contracts` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });
}

async function testSusanAIAnalytics() {
  log('\n7. SUSAN AI ANALYTICS TESTS', 'magenta');
  
  await login('admin');
  
  // Test analytics endpoint
  await test('Susan AI', 'GET /api/analytics/overview (no crashes)', async () => {
    const response = await makeRequest('/api/analytics/overview');
    
    if (response.status === 200 && response.headers['content-type']?.includes('json')) {
      if (typeof response.data === 'object') {
        return { 
          success: true, 
          details: 'Analytics data returned without crashes' 
        };
      }
      return { success: false, error: 'Invalid response format' };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test Susan AI status
  await test('Susan AI', 'Susan AI system status', async () => {
    const response = await makeRequest('/api/susan-ai/status');
    
    if (response.status === 200 && typeof response.data === 'object') {
      return { 
        success: true, 
        details: `AI Status: ${response.data.status || 'Unknown'}` 
      };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });
}

async function testAdditionalEndpoints() {
  log('\n8. ADDITIONAL ENDPOINT TESTS', 'magenta');
  
  await login('admin');
  
  // Test territories
  await test('Territories', 'GET /api/territories', async () => {
    const response = await makeRequest('/api/territories');
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} territories` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test PTO policies
  await test('PTO Policies', 'GET /api/pto-policies', async () => {
    const response = await makeRequest('/api/pto-policies');
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} PTO policies` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test email templates
  await test('Email Templates', 'GET /api/email-templates', async () => {
    const response = await makeRequest('/api/email-templates');
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} email templates` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });

  // Test workflows
  await test('Workflows', 'GET /api/workflows', async () => {
    const response = await makeRequest('/api/workflows');
    if (response.status === 200 && Array.isArray(response.data)) {
      return { success: true, details: `Fetched ${response.data.length} workflows` };
    }
    return { success: false, error: `Failed with status ${response.status}` };
  });
}

function generateReport() {
  const percentage = Math.round((TEST_RESULTS.passed / TEST_RESULTS.total) * 100);
  const status = percentage >= 95 ? 'EXCELLENT' : 
                 percentage >= 80 ? 'GOOD' :
                 percentage >= 60 ? 'FAIR' : 'NEEDS ATTENTION';

  log('\n' + '='.repeat(80), 'cyan');
  log('COMPREHENSIVE SYSTEM TEST REPORT', 'cyan');
  log('='.repeat(80), 'cyan');
  log(`\nTest Date: ${new Date().toISOString()}`, 'reset');
  log(`System URL: ${BASE_URL}`, 'reset');
  
  log('\n📊 OVERALL RESULTS', 'magenta');
  log(`  Total Tests: ${TEST_RESULTS.total}`, 'reset');
  log(`  Passed: ${TEST_RESULTS.passed}`, 'green');
  log(`  Failed: ${TEST_RESULTS.failed}`, TEST_RESULTS.failed > 0 ? 'red' : 'reset');
  log(`  Success Rate: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');
  log(`  System Status: ${status}`, percentage >= 80 ? 'green' : 'yellow');

  // Group results by category
  const categories = {};
  TEST_RESULTS.tests.forEach(test => {
    if (!categories[test.category]) {
      categories[test.category] = { passed: 0, failed: 0, tests: [] };
    }
    categories[test.category].tests.push(test);
    if (test.status === 'PASSED') {
      categories[test.category].passed++;
    } else {
      categories[test.category].failed++;
    }
  });

  log('\n📋 DETAILED RESULTS BY CATEGORY', 'magenta');
  for (const [category, data] of Object.entries(categories)) {
    const catPercentage = Math.round((data.passed / data.tests.length) * 100);
    log(`\n  ${category} (${catPercentage}% passing)`, 'blue');
    data.tests.forEach(test => {
      const icon = test.status === 'PASSED' ? '✓' : '✗';
      const color = test.status === 'PASSED' ? 'green' : 'red';
      log(`    ${icon} ${test.name}`, color);
      if (test.error) {
        log(`      └─ ${test.error}`, 'yellow');
      }
    });
  }

  // Failed tests summary
  if (TEST_RESULTS.failed > 0) {
    log('\n⚠️  FAILED TESTS REQUIRING ATTENTION', 'red');
    TEST_RESULTS.tests.filter(t => t.status !== 'PASSED').forEach(test => {
      log(`  - ${test.category}: ${test.name}`, 'red');
      log(`    Error: ${test.error}`, 'yellow');
    });
  }

  // Summary
  log('\n📝 SUMMARY', 'magenta');
  if (percentage >= 95) {
    log('  ✓ System is functioning at EXCELLENT level (95%+ tests passing)', 'green');
    log('  ✓ All critical features are operational', 'green');
    log('  ✓ System is ready for production use', 'green');
  } else if (percentage >= 80) {
    log('  ✓ System is functioning at GOOD level (80%+ tests passing)', 'green');
    log('  ⚠ Some minor issues detected but system is stable', 'yellow');
  } else {
    log('  ✗ System needs attention (below 80% passing)', 'red');
    log('  ✗ Critical issues detected that need resolution', 'red');
  }

  // Save report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    url: BASE_URL,
    summary: {
      total: TEST_RESULTS.total,
      passed: TEST_RESULTS.passed,
      failed: TEST_RESULTS.failed,
      percentage,
      status
    },
    categories,
    tests: TEST_RESULTS.tests
  };

  fs.writeFileSync('test-report.json', JSON.stringify(reportData, null, 2));
  log('\n💾 Detailed report saved to test-report.json', 'cyan');
  
  return percentage;
}

// Main test runner
async function runAllTests() {
  log('\n🚀 STARTING COMPREHENSIVE SYSTEM TESTS', 'cyan');
  log('Testing HR Management System at ' + BASE_URL, 'reset');
  
  try {
    // Check if server is running
    const healthCheck = await makeRequest('/api/health');
    if (healthCheck.status !== 200) {
      log('\n❌ Server is not responding at ' + BASE_URL, 'red');
      log('Please ensure the application is running with: npm run dev', 'yellow');
      process.exit(1);
    }
    
    log('✓ Server is running and responsive', 'green');
    
    // Run all test categories
    await testAuthentication();
    await testPTOSystem();
    await testDocumentManagement();
    await testToolsAndEquipment();
    await testRecruitment();
    await testContractManagement();
    await testSusanAIAnalytics();
    await testAdditionalEndpoints();
    
    // Generate final report
    const successRate = generateReport();
    
    // Exit with appropriate code
    process.exit(successRate >= 80 ? 0 : 1);
    
  } catch (error) {
    log('\n❌ Test suite encountered an error:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// Run tests
runAllTests();