/**
 * Fixed test script for Google integration - uses dynamic imports
 * Run with: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/test-google-fixed.ts
 */

import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

// Verify env vars loaded
console.log('Environment Check:');
console.log(`- GOOGLE_SERVICE_ACCOUNT_KEY length: ${process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.length || 0}`);
console.log(`- GOOGLE_USER_EMAIL: ${process.env.GOOGLE_USER_EMAIL || 'not set'}`);

// Now dynamically import the services
async function runTests() {
  const TEST_USER_EMAIL = process.env.GOOGLE_USER_EMAIL || 'ahmed.mahmoud@theroofdocs.com';

  console.log('\n==============================================');
  console.log('  GOOGLE INTEGRATION TEST SUITE - ROOF HR');
  console.log('==============================================');
  console.log(`Test User: ${TEST_USER_EMAIL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Dynamic imports AFTER dotenv.config()
  const { serviceAccountAuth } = await import('../services/service-account-auth');
  const { googleAuthService } = await import('../services/google-auth');

  const results: { [key: string]: any } = {};
  let allPassed = true;

  // Test 1: Service Account Configuration
  console.log('\n========================================');
  console.log('TEST 1: Service Account Configuration');
  console.log('========================================');

  try {
    const isConfigured = serviceAccountAuth.isConfigured();
    const serviceAccountEmail = serviceAccountAuth.getServiceAccountEmail();

    console.log(`✓ Service Account Configured: ${isConfigured}`);
    console.log(`✓ Service Account Email: ${serviceAccountEmail}`);
    console.log(`✓ User Email to Impersonate: ${TEST_USER_EMAIL}`);

    if (!isConfigured) {
      throw new Error('Service account not configured. Check GOOGLE_SERVICE_ACCOUNT_KEY env var.');
    }
    results['serviceAccountConfig'] = { success: true, email: serviceAccountEmail };
  } catch (error: any) {
    console.error('✗ Service Account Config failed:', error.message);
    results['serviceAccountConfig'] = { error: String(error) };
    allPassed = false;
  }

  // Test 2: Google Auth Service
  console.log('\n========================================');
  console.log('TEST 2: Google Auth Service');
  console.log('========================================');

  try {
    await googleAuthService.initialize();
    console.log('✓ Google Auth Service initialized successfully');

    const impersonatedEmail = googleAuthService.getImpersonatedEmail();
    console.log(`✓ Impersonating: ${impersonatedEmail}`);
    results['googleAuth'] = { success: true, impersonating: impersonatedEmail };
  } catch (error: any) {
    console.error('✗ Google Auth Service failed:', error.message);
    results['googleAuth'] = { error: String(error) };
    allPassed = false;
  }

  // Test 3: Gmail Connection
  console.log('\n========================================');
  console.log('TEST 3: Gmail Connection');
  console.log('========================================');

  try {
    const gmail = await serviceAccountAuth.getGmailForUser(TEST_USER_EMAIL);
    console.log('✓ Gmail service obtained for user');

    // Test by listing labels
    const response = await gmail.users.labels.list({ userId: 'me' });
    const labels = response.data.labels || [];
    console.log(`✓ Gmail connected - Found ${labels.length} labels`);
    console.log(`  Sample labels: ${labels.slice(0, 5).map(l => l.name).join(', ')}`);

    results['gmail'] = { success: true, labelCount: labels.length };
  } catch (error: any) {
    console.error('✗ Gmail connection failed:', error.message);
    if (error.message?.includes('Domain-wide delegation')) {
      console.error('  → Domain-wide delegation may not be enabled for this service account');
      console.error('  → Go to Google Admin Console → Security → API controls → Domain-wide delegation');
    }
    results['gmail'] = { error: String(error) };
    allPassed = false;
  }

  // Test 4: Calendar Connection
  console.log('\n========================================');
  console.log('TEST 4: Calendar Connection');
  console.log('========================================');

  try {
    const calendar = await serviceAccountAuth.getCalendarForUser(TEST_USER_EMAIL);
    console.log('✓ Calendar service obtained for user');

    // Test by listing upcoming events
    const now = new Date();
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      maxResults: 5,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`✓ Calendar connected - Found ${events.length} upcoming events`);
    if (events.length > 0) {
      console.log(`  Next event: ${events[0].summary} at ${events[0].start?.dateTime || events[0].start?.date}`);
    }

    results['calendar'] = { success: true, eventCount: events.length };
  } catch (error: any) {
    console.error('✗ Calendar connection failed:', error.message);
    results['calendar'] = { error: String(error) };
    allPassed = false;
  }

  // Test 5: Google Drive Connection
  console.log('\n========================================');
  console.log('TEST 5: Google Drive Connection');
  console.log('========================================');

  try {
    const drive = await serviceAccountAuth.getDriveForUser(TEST_USER_EMAIL);
    console.log('✓ Drive service obtained for user');

    // Test by listing files
    const response = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType)'
    });

    const files = response.data.files || [];
    console.log(`✓ Drive connected - Found ${files.length} files`);
    if (files.length > 0) {
      console.log(`  Sample files: ${files.map(f => f.name).join(', ')}`);
    }

    results['drive'] = { success: true, fileCount: files.length };
  } catch (error: any) {
    console.error('✗ Drive connection failed:', error.message);
    results['drive'] = { error: String(error) };
    allPassed = false;
  }

  // Test 6: Calendar Event Creation (DRY RUN)
  console.log('\n========================================');
  console.log('TEST 6: Calendar Event Creation (DRY RUN)');
  console.log('========================================');

  try {
    const calendar = await serviceAccountAuth.getCalendarForUser(TEST_USER_EMAIL);

    // Create a test event for tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const endTime = new Date(tomorrow);
    endTime.setHours(11, 0, 0, 0);

    const eventData = {
      summary: 'Test Interview - DELETE ME',
      description: 'This is a test event created by the Google integration test script. You can delete this.',
      start: {
        dateTime: tomorrow.toISOString(),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/New_York'
      }
    };

    console.log('✓ Event data prepared (dry run - not creating)');
    console.log(`  Title: ${eventData.summary}`);
    console.log(`  Time: ${tomorrow.toLocaleString()} - ${endTime.toLocaleString()}`);
    results['calendarEventCreation'] = { success: true, dryRun: true };
  } catch (error: any) {
    console.error('✗ Calendar event creation prep failed:', error.message);
    results['calendarEventCreation'] = { error: String(error) };
    allPassed = false;
  }

  // Summary
  console.log('\n========================================');
  console.log('  TEST RESULTS SUMMARY');
  console.log('========================================');

  for (const [test, result] of Object.entries(results)) {
    const status = result.error ? '✗ FAILED' : '✓ PASSED';
    console.log(`${status}: ${test}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log('\n========================================');
  console.log(allPassed ? '  ✓ ALL TESTS PASSED!' : '  ✗ SOME TESTS FAILED');
  console.log('========================================\n');

  return { allPassed, results };
}

// Run tests
runTests()
  .then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
