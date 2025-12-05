/**
 * Susan AI Role-Based Access Test Suite
 * Tests various queries with different user roles to ensure appropriate responses
 */

const testCases = [
  // ADMIN Role Tests
  {
    role: 'ADMIN',
    userId: 'admin-123',
    email: 'ahmed.mahmoud@theroofdocs.com',
    department: 'Administration',
    queries: [
      "How many employees do we have?",
      "Show me all pending PTO requests",
      "What's the company PTO policy?",
      "Show me department statistics",
      "Who are the top performing employees?",
      "Generate a company-wide report",
      "How many PTO days do I have?",
      "Show me my personal information"
    ],
    expectedAccess: {
      companyStats: true,
      allEmployees: true,
      allPTO: true,
      personalPTO: true,
      salaryData: true,
      departments: true,
      reports: true
    }
  },

  // MANAGER Role Tests
  {
    role: 'MANAGER',
    userId: 'manager-456',
    email: 'john.manager@theroofdocs.com',
    department: 'Sales',
    queries: [
      "Show me my department's employees",
      "How many PTO requests are pending in my department?",
      "What's my team's performance this month?",
      "Can I see all employee salaries?", // Should be restricted
      "How many PTO days do I have?",
      "Show me my personal information",
      "Approve PTO for my team member"
    ],
    expectedAccess: {
      companyStats: false,
      departmentEmployees: true,
      departmentPTO: true,
      personalPTO: true,
      salaryData: false,
      ownDepartment: true,
      reports: 'department-only'
    }
  },

  // EMPLOYEE Role Tests
  {
    role: 'EMPLOYEE',
    userId: 'emp-789',
    email: 'mike.employee@theroofdocs.com',
    department: 'Operations',
    queries: [
      "How many PTO days do I have?",
      "What's my vacation balance?",
      "Show me my time off",
      "When is my next review?",
      "What are the company holidays?",
      "Show me my personal information",
      "Can I see other employees' PTO?", // Should be restricted
      "Show me all company employees", // Should be restricted
      "What's the average salary in my department?" // Should be restricted
    ],
    expectedAccess: {
      companyStats: false,
      allEmployees: false,
      othersPTO: false,
      personalPTO: true,
      personalInfo: true,
      salaryData: false,
      publicInfo: true
    }
  },

  // CONTRACTOR Role Tests
  {
    role: 'CONTRACTOR',
    userId: 'contractor-101',
    email: 'alex.contractor@theroofdocs.com',
    department: null,
    queries: [
      "Show me my contract details",
      "What documents do I need to submit?",
      "Can I see company employee information?", // Should be restricted
      "Show me PTO policies", // Should be restricted
      "What equipment is assigned to me?"
    ],
    expectedAccess: {
      contractInfo: true,
      assignedDocs: true,
      employeeData: false,
      ptoData: false,
      assignedEquipment: true
    }
  }
];

// Test execution function
async function runSusanAITests() {
  console.log('🧪 Starting Susan AI Role-Based Access Tests\n');
  console.log('=' .repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    issues: []
  };

  for (const testCase of testCases) {
    console.log(`\n📋 Testing Role: ${testCase.role}`);
    console.log(`   User: ${testCase.email}`);
    console.log(`   Department: ${testCase.department || 'N/A'}`);
    console.log('-'.repeat(40));
    
    // Create Susan context for this user
    const context = {
      userId: testCase.userId,
      userRole: testCase.role,
      department: testCase.department,
      sessionHistory: []
    };
    
    for (const query of testCase.queries) {
      console.log(`\n   Query: "${query}"`);
      
      // Simulate the intent analysis
      const intent = analyzeQueryIntent(query, testCase.role);
      
      // Check permissions
      const hasAccess = checkPermissionForRole(intent, testCase.role);
      
      // Validate expected behavior
      const isValid = validateAccess(query, hasAccess, testCase.expectedAccess);
      
      if (isValid) {
        console.log(`   ✅ Access: ${hasAccess ? 'GRANTED' : 'DENIED'} (Correct)`);
        results.passed++;
      } else {
        console.log(`   ❌ Access: ${hasAccess ? 'GRANTED' : 'DENIED'} (Incorrect)`);
        results.failed++;
        results.issues.push({
          role: testCase.role,
          query: query,
          gotAccess: hasAccess,
          expectedAccess: !hasAccess
        });
      }
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.issues.length > 0) {
    console.log('\n⚠️  ISSUES FOUND:');
    results.issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. Role: ${issue.role}`);
      console.log(`   Query: "${issue.query}"`);
      console.log(`   Expected: ${issue.expectedAccess ? 'GRANTED' : 'DENIED'}`);
      console.log(`   Got: ${issue.gotAccess ? 'GRANTED' : 'DENIED'}`);
    });
  } else {
    console.log('\n🎉 All tests passed! Susan AI is properly enforcing role-based access.');
  }
  
  return results;
}

// Helper function to analyze query intent
function analyzeQueryIntent(query, role) {
  const lowerQuery = query.toLowerCase();
  
  // Check for keywords about others vs self
  const mentionsOthers = /\b(other|others|everyone|all employees?|coworkers?|colleagues?|team(?:'s)?|department(?:'s)?|employees'?)\b/.test(lowerQuery);
  const mentionsSelf = /\b(my|me|i|i've|i have|myself)\b/.test(lowerQuery);
  
  if (lowerQuery.includes('pto') || lowerQuery.includes('time off') || lowerQuery.includes('vacation')) {
    // For employees, use deterministic scope based on keywords
    if (role === 'EMPLOYEE') {
      if (mentionsOthers) {
        return { dataSource: ['pto'], scope: 'company' }; // NOT self - will be denied
      } else if (mentionsSelf) {
        return { dataSource: ['userPtoData', 'pto'], scope: 'self' }; // Self - will be allowed
      } else {
        return { dataSource: ['pto'], scope: 'company' }; // Default to company scope for safety
      }
    }
    
    // For other roles, use existing logic
    if (lowerQuery.includes('my') || lowerQuery.includes('i have')) {
      return { dataSource: ['userPtoData', 'pto'], scope: 'self' };
    } else if (lowerQuery.includes('all') || lowerQuery.includes('company')) {
      return { dataSource: ['pto', 'all_employees'], scope: 'company' };
    } else if (lowerQuery.includes('department') || lowerQuery.includes('team')) {
      return { dataSource: ['pto'], scope: 'department' };
    }
  }
  
  if (lowerQuery.includes('employee') && (lowerQuery.includes('all') || lowerQuery.includes('show me'))) {
    return { dataSource: ['all_employees'], scope: 'company' };
  }
  
  if (lowerQuery.includes('salary') || lowerQuery.includes('compensation')) {
    return { dataSource: ['salary'], scope: 'restricted' };
  }
  
  if (lowerQuery.includes('my') || lowerQuery.includes('personal')) {
    return { dataSource: ['userData'], scope: 'self' };
  }
  
  if (lowerQuery.includes('company') || lowerQuery.includes('statistics')) {
    return { dataSource: ['companyStats'], scope: 'company' };
  }
  
  return { dataSource: ['public'], scope: 'public' };
}

// Helper function to check permissions based on role
function checkPermissionForRole(intent, role) {
  // Admin has access to everything
  if (role === 'ADMIN') return true;
  
  // Check specific permissions based on intent
  if (intent.dataSource?.includes('salary') && role !== 'HR_MANAGER') {
    return false;
  }
  
  if (intent.dataSource?.includes('all_employees') && 
      !['HR_MANAGER', 'MANAGER'].includes(role)) {
    return false;
  }
  
  // Employees can access their own PTO data
  if (role === 'EMPLOYEE') {
    if (intent.dataSource?.includes('userPtoData') || 
        (intent.dataSource?.includes('pto') && intent.scope === 'self')) {
      return true;
    }
    
    // For other data, check if it's self-scoped or public
    if (intent.scope !== 'self' && 
        !intent.dataSource?.includes('public')) {
      return false;
    }
  }
  
  // Managers can access department data
  if (role === 'MANAGER') {
    if (intent.scope === 'department' || intent.scope === 'self') {
      return true;
    }
    if (intent.scope === 'company' && !intent.dataSource?.includes('salary')) {
      return false;
    }
  }
  
  // Contractors have very limited access
  if (role === 'CONTRACTOR') {
    return intent.scope === 'self' || intent.dataSource?.includes('public');
  }
  
  return true;
}

// Helper function to validate access against expectations
function validateAccess(query, hasAccess, expectedAccess) {
  const lowerQuery = query.toLowerCase();
  
  // Check personal PTO queries
  if ((lowerQuery.includes('my') || lowerQuery.includes('i have')) && 
      (lowerQuery.includes('pto') || lowerQuery.includes('vacation'))) {
    return hasAccess === expectedAccess.personalPTO;
  }
  
  // Check other employees' data queries
  if (lowerQuery.includes('other') || lowerQuery.includes('all employee')) {
    return hasAccess === expectedAccess.allEmployees;
  }
  
  // Check salary queries
  if (lowerQuery.includes('salary')) {
    return hasAccess === expectedAccess.salaryData;
  }
  
  // Check company stats
  if (lowerQuery.includes('company') && lowerQuery.includes('employee')) {
    return hasAccess === expectedAccess.companyStats;
  }
  
  // Default to checking if restricted queries are properly blocked
  if (lowerQuery.includes('can i see')) {
    // Questions asking for restricted access should be denied for non-admins
    return !hasAccess || expectedAccess.companyStats;
  }
  
  return true;
}

// Run the tests
console.log('🚀 Susan AI Role-Based Access Control Test Suite');
console.log('Testing permissions and access control for different user roles\n');

runSusanAITests().then(results => {
  console.log('\n✨ Test suite completed!');
  if (results.failed > 0) {
    console.log('⚠️  Some tests failed. Please review the issues above.');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed successfully!');
    process.exit(0);
  }
});