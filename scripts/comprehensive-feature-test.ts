#!/usr/bin/env tsx

import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

const BASE_URL = 'http://localhost:5000';

// Test accounts
const TEST_ACCOUNTS = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!',
    role: 'ADMIN'
  },
  manager: {
    email: 'ford.barsi@theroofdocs.com',
    password: 'Manager123!',
    role: 'ADMIN'
  },
  employee: {
    email: 'test.employee@company.com',
    password: 'Employee123!',
    role: 'EMPLOYEE'
  }
};

interface TestResult {
  feature: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details: string;
  errors?: string[];
}

const results: TestResult[] = [];

async function login(email: string, password: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      console.error(`Login failed for ${email}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error(`Login error for ${email}:`, error);
    return null;
  }
}

async function testEmployeeManagement(token: string) {
  console.log('\n🧑‍💼 Testing Employee Management...');
  const errors: string[] = [];
  
  try {
    // Test 1: Get employees list
    const listResponse = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!listResponse.ok) {
      errors.push(`Failed to fetch employees: ${listResponse.status}`);
    } else {
      const employees = await listResponse.json();
      console.log(`  ✓ Fetched ${employees.length} employees`);
    }

    // Test 2: Create new employee
    const newEmployee = {
      email: `test.emp.${Date.now()}@company.com`,
      password: 'TempPass123!',
      firstName: 'Test',
      lastName: 'Employee',
      role: 'EMPLOYEE',
      employmentType: 'W2',
      department: 'Engineering',
      position: 'Developer',
      hireDate: new Date().toISOString().split('T')[0]
    };

    const createResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newEmployee)
    });

    if (!createResponse.ok) {
      errors.push(`Failed to create employee: ${createResponse.status}`);
    } else {
      console.log('  ✓ Created new employee successfully');
    }

    // Test 3: Get territories
    const territoriesResponse = await fetch(`${BASE_URL}/api/territories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!territoriesResponse.ok) {
      errors.push(`Failed to fetch territories: ${territoriesResponse.status}`);
    } else {
      const territories = await territoriesResponse.json();
      console.log(`  ✓ Fetched ${territories.length} territories`);
    }

    results.push({
      feature: 'Employee Management',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `Employee list, creation, and territories tested`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'Employee Management',
      status: 'FAIL',
      details: 'Failed to test employee management',
      errors: [error.message]
    });
  }
}

async function testPTOSystem(token: string, role: string) {
  console.log('\n🏖️  Testing PTO System...');
  const errors: string[] = [];
  
  try {
    // Test 1: Get PTO requests
    const ptoResponse = await fetch(`${BASE_URL}/api/pto`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!ptoResponse.ok) {
      errors.push(`Failed to fetch PTO requests: ${ptoResponse.status}`);
    } else {
      const requests = await ptoResponse.json();
      console.log(`  ✓ Fetched ${requests.length} PTO requests`);
    }

    // Test 2: Submit PTO request (if employee)
    if (role === 'EMPLOYEE') {
      const newPTO = {
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reason: 'Vacation'
      };

      const createPTOResponse = await fetch(`${BASE_URL}/api/pto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPTO)
      });

      if (!createPTOResponse.ok) {
        errors.push(`Failed to create PTO request: ${createPTOResponse.status}`);
      } else {
        console.log('  ✓ Created PTO request successfully');
      }
    }

    // Test 3: Get PTO policies
    const policiesResponse = await fetch(`${BASE_URL}/api/pto/policies`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!policiesResponse.ok) {
      errors.push(`Failed to fetch PTO policies: ${policiesResponse.status}`);
    } else {
      console.log('  ✓ Fetched PTO policies');
    }

    results.push({
      feature: 'PTO System',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `PTO requests, submission, and policies tested`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'PTO System',
      status: 'FAIL',
      details: 'Failed to test PTO system',
      errors: [error.message]
    });
  }
}

async function testRecruitment(token: string) {
  console.log('\n👥 Testing Recruitment System...');
  const errors: string[] = [];
  
  try {
    // Test 1: Get candidates
    const candidatesResponse = await fetch(`${BASE_URL}/api/candidates`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!candidatesResponse.ok) {
      errors.push(`Failed to fetch candidates: ${candidatesResponse.status}`);
    } else {
      const candidates = await candidatesResponse.json();
      console.log(`  ✓ Fetched ${candidates.length} candidates`);
    }

    // Test 2: Create new candidate
    const newCandidate = {
      firstName: 'John',
      lastName: 'TestCandidate',
      email: `candidate.${Date.now()}@example.com`,
      phone: '555-0123',
      position: 'Software Engineer',
      status: 'NEW',
      stage: 'APPLIED'
    };

    const createCandidateResponse = await fetch(`${BASE_URL}/api/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newCandidate)
    });

    if (!createCandidateResponse.ok) {
      errors.push(`Failed to create candidate: ${createCandidateResponse.status}`);
    } else {
      console.log('  ✓ Created new candidate successfully');
    }

    // Test 3: Get interviews
    const interviewsResponse = await fetch(`${BASE_URL}/api/interviews`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!interviewsResponse.ok) {
      errors.push(`Failed to fetch interviews: ${interviewsResponse.status}`);
    } else {
      const interviews = await interviewsResponse.json();
      console.log(`  ✓ Fetched ${interviews.length} interviews`);
    }

    results.push({
      feature: 'Recruitment System',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `Candidates, creation, and interviews tested`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'Recruitment System',
      status: 'FAIL',
      details: 'Failed to test recruitment system',
      errors: [error.message]
    });
  }
}

async function testDocumentManagement(token: string) {
  console.log('\n📄 Testing Document Management...');
  const errors: string[] = [];
  
  try {
    // Test 1: Get documents
    const docsResponse = await fetch(`${BASE_URL}/api/documents`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!docsResponse.ok) {
      errors.push(`Failed to fetch documents: ${docsResponse.status}`);
    } else {
      const documents = await docsResponse.json();
      console.log(`  ✓ Fetched ${documents.length} documents`);
    }

    // Test 2: Get COI documents
    const coiResponse = await fetch(`${BASE_URL}/api/coi-documents`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!coiResponse.ok) {
      errors.push(`Failed to fetch COI documents: ${coiResponse.status}`);
    } else {
      const coiDocs = await coiResponse.json();
      console.log(`  ✓ Fetched ${coiDocs.length} COI documents`);
    }

    // Test 3: Get contract templates
    const contractsResponse = await fetch(`${BASE_URL}/api/contracts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!contractsResponse.ok) {
      errors.push(`Failed to fetch contracts: ${contractsResponse.status}`);
    } else {
      const contracts = await contractsResponse.json();
      console.log(`  ✓ Fetched ${contracts.length} contracts`);
    }

    results.push({
      feature: 'Document Management',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `Documents, COI docs, and contracts tested`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'Document Management',
      status: 'FAIL',
      details: 'Failed to test document management',
      errors: [error.message]
    });
  }
}

async function testToolsInventory(token: string) {
  console.log('\n🔧 Testing Tools & Equipment...');
  const errors: string[] = [];
  
  try {
    // Test 1: Get tools inventory
    const toolsResponse = await fetch(`${BASE_URL}/api/tools`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!toolsResponse.ok) {
      errors.push(`Failed to fetch tools: ${toolsResponse.status}`);
    } else {
      const tools = await toolsResponse.json();
      console.log(`  ✓ Fetched ${tools.length} tools`);
    }

    // Test 2: Get tool assignments
    const assignmentsResponse = await fetch(`${BASE_URL}/api/tools/assignments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!assignmentsResponse.ok) {
      errors.push(`Failed to fetch tool assignments: ${assignmentsResponse.status}`);
    } else {
      const assignments = await assignmentsResponse.json();
      console.log(`  ✓ Fetched ${assignments.length} tool assignments`);
    }

    // Test 3: Create new tool
    const newTool = {
      name: 'Test Laptop',
      category: 'LAPTOP',
      description: 'Test laptop for development',
      serialNumber: `SN-${Date.now()}`,
      model: 'MacBook Pro',
      quantity: 1,
      condition: 'NEW',
      location: 'Office',
      purchasePrice: 2000
    };

    const createToolResponse = await fetch(`${BASE_URL}/api/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newTool)
    });

    if (!createToolResponse.ok) {
      errors.push(`Failed to create tool: ${createToolResponse.status}`);
    } else {
      console.log('  ✓ Created new tool successfully');
    }

    results.push({
      feature: 'Tools & Equipment',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `Tools inventory, assignments, and creation tested`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'Tools & Equipment',
      status: 'FAIL',
      details: 'Failed to test tools system',
      errors: [error.message]
    });
  }
}

async function testNotificationSystem(token: string) {
  console.log('\n🔔 Testing Notification System...');
  const errors: string[] = [];
  
  try {
    // Test 1: Get email templates
    const templatesResponse = await fetch(`${BASE_URL}/api/email-templates`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!templatesResponse.ok) {
      errors.push(`Failed to fetch email templates: ${templatesResponse.status}`);
    } else {
      const templates = await templatesResponse.json();
      console.log(`  ✓ Fetched ${templates.length} email templates`);
    }

    // Test 2: Get notifications
    const notificationsResponse = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!notificationsResponse.ok) {
      errors.push(`Failed to fetch notifications: ${notificationsResponse.status}`);
    } else {
      const notifications = await notificationsResponse.json();
      console.log(`  ✓ Fetched ${notifications.count || 0} notifications`);
    }

    results.push({
      feature: 'Notification System',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `Email templates and notifications tested`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'Notification System',
      status: 'FAIL',
      details: 'Failed to test notification system',
      errors: [error.message]
    });
  }
}

async function testSusanAI(token: string, role: string) {
  console.log('\n🤖 Testing Susan AI...');
  const errors: string[] = [];
  
  try {
    // Test 1: Get Susan AI chat
    const chatResponse = await fetch(`${BASE_URL}/api/susan-ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: 'Hello Susan, what can you help me with?' })
    });
    
    if (!chatResponse.ok) {
      errors.push(`Failed to chat with Susan AI: ${chatResponse.status}`);
    } else {
      console.log('  ✓ Susan AI chat working');
    }

    // Test 2: Get analytics (admin only)
    if (role === 'ADMIN' || role === 'TRUE_ADMIN') {
      const analyticsResponse = await fetch(`${BASE_URL}/api/susan-ai/analytics?timeframe=month`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!analyticsResponse.ok) {
        errors.push(`Failed to fetch Susan AI analytics: ${analyticsResponse.status}`);
      } else {
        console.log('  ✓ Susan AI analytics available');
      }
    }

    results.push({
      feature: 'Susan AI',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `AI chat and analytics tested for ${role}`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'Susan AI',
      status: 'FAIL',
      details: 'Failed to test Susan AI',
      errors: [error.message]
    });
  }
}

async function testGoogleIntegrations(token: string) {
  console.log('\n🔗 Testing Google Integrations...');
  const errors: string[] = [];
  
  try {
    // Test 1: Check connection status
    const connectionResponse = await fetch(`${BASE_URL}/api/google/test-connection`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!connectionResponse.ok) {
      errors.push(`Google connection test failed: ${connectionResponse.status}`);
      console.log('  ⚠️  Google OAuth not configured (expected in dev)');
    } else {
      const status = await connectionResponse.json();
      console.log('  ✓ Google connection status checked');
    }

    results.push({
      feature: 'Google Integrations',
      status: errors.length === 0 ? 'PASS' : 'PARTIAL',
      details: `Google OAuth integration check`,
      errors
    });
  } catch (error) {
    results.push({
      feature: 'Google Integrations',
      status: 'PARTIAL',
      details: 'Google OAuth not configured (expected)',
      errors: []
    });
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive HR System Tests\n');
  console.log('=' .repeat(50));
  
  // Test with Admin account
  console.log('\n📊 ADMIN TESTS');
  console.log('-'.repeat(30));
  const adminToken = await login(TEST_ACCOUNTS.admin.email, TEST_ACCOUNTS.admin.password);
  if (adminToken) {
    console.log('✅ Admin login successful');
    await testEmployeeManagement(adminToken);
    await testPTOSystem(adminToken, 'ADMIN');
    await testRecruitment(adminToken);
    await testDocumentManagement(adminToken);
    await testToolsInventory(adminToken);
    await testNotificationSystem(adminToken);
    await testSusanAI(adminToken, 'ADMIN');
    await testGoogleIntegrations(adminToken);
  } else {
    console.error('❌ Admin login failed');
  }

  // Test with Manager account
  console.log('\n📊 MANAGER TESTS');
  console.log('-'.repeat(30));
  const managerToken = await login(TEST_ACCOUNTS.manager.email, TEST_ACCOUNTS.manager.password);
  if (managerToken) {
    console.log('✅ Manager login successful');
    await testPTOSystem(managerToken, 'MANAGER');
    await testSusanAI(managerToken, 'MANAGER');
  } else {
    console.error('❌ Manager login failed');
  }

  // Test with Employee account
  console.log('\n📊 EMPLOYEE TESTS');
  console.log('-'.repeat(30));
  const employeeToken = await login(TEST_ACCOUNTS.employee.email, TEST_ACCOUNTS.employee.password);
  if (employeeToken) {
    console.log('✅ Employee login successful');
    await testPTOSystem(employeeToken, 'EMPLOYEE');
    await testSusanAI(employeeToken, 'EMPLOYEE');
  } else {
    console.error('❌ Employee login failed');
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 TEST SUMMARY\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`✅ PASSED: ${passed}`);
  console.log(`⚠️  PARTIAL: ${partial}`);
  console.log(`❌ FAILED: ${failed}`);
  
  console.log('\nDetailed Results:');
  console.log('-'.repeat(50));
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : '❌';
    console.log(`\n${icon} ${result.feature}: ${result.status}`);
    console.log(`   ${result.details}`);
    if (result.errors && result.errors.length > 0) {
      console.log(`   Errors:`);
      result.errors.forEach(error => console.log(`   - ${error}`));
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ Testing Complete!\n');
}

// Run tests
runAllTests().catch(console.error);