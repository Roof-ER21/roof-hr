/**
 * Test script for Google integration - tests Gmail, Calendar, and Drive
 * Run with: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/test-google-integration.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';
import { serviceAccountAuth } from '../services/service-account-auth';
import { googleAuthService } from '../services/google-auth';

const TEST_USER_EMAIL = process.env.GOOGLE_USER_EMAIL || 'ahmed.mahmoud@theroofdocs.com';

async function testServiceAccountConfig() {
  console.log('\n========================================');
  console.log('TEST 1: Service Account Configuration');
  console.log('========================================');

  const isConfigured = serviceAccountAuth.isConfigured();
  const serviceAccountEmail = serviceAccountAuth.getServiceAccountEmail();

  console.log(`✓ Service Account Configured: ${isConfigured}`);
  console.log(`✓ Service Account Email: ${serviceAccountEmail}`);
  console.log(`✓ User Email to Impersonate: ${TEST_USER_EMAIL}`);

  if (!isConfigured) {
    throw new Error('Service account not configured. Check GOOGLE_SERVICE_ACCOUNT_KEY env var.');
  }

  return true;
}

async function testGoogleAuth() {
  console.log('\n========================================');
  console.log('TEST 2: Google Auth Service');
  console.log('========================================');

  try {
    await googleAuthService.initialize();
    console.log('✓ Google Auth Service initialized successfully');

    const impersonatedEmail = googleAuthService.getImpersonatedEmail();
    console.log(`✓ Impersonating: ${impersonatedEmail}`);

    return true;
  } catch (error) {
    console.error('✗ Google Auth Service failed:', error);
    throw error;
  }
}

async function testGmailConnection() {
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

    return { success: true, labelCount: labels.length };
  } catch (error: any) {
    console.error('✗ Gmail connection failed:', error.message);
    if (error.message?.includes('Domain-wide delegation')) {
      console.error('  → Domain-wide delegation may not be enabled for this service account');
      console.error('  → Go to Google Admin Console → Security → API controls → Domain-wide delegation');
    }
    throw error;
  }
}

async function testCalendarConnection() {
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

    return { success: true, eventCount: events.length };
  } catch (error: any) {
    console.error('✗ Calendar connection failed:', error.message);
    throw error;
  }
}

async function testDriveConnection() {
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

    return { success: true, fileCount: files.length };
  } catch (error: any) {
    console.error('✗ Drive connection failed:', error.message);
    throw error;
  }
}

async function testCalendarEventCreation(dryRun = true) {
  console.log('\n========================================');
  console.log('TEST 6: Calendar Event Creation' + (dryRun ? ' (DRY RUN)' : ''));
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
      },
      attendees: dryRun ? [] : [
        { email: 'careers@theroofdocs.com' }
      ],
      conferenceData: {
        createRequest: {
          requestId: `test-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    if (dryRun) {
      console.log('✓ Event data prepared (dry run - not creating)');
      console.log(`  Title: ${eventData.summary}`);
      console.log(`  Time: ${tomorrow.toLocaleString()} - ${endTime.toLocaleString()}`);
      return { success: true, dryRun: true };
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData,
      conferenceDataVersion: 1,
      sendNotifications: false // Don't send emails for test
    });

    console.log(`✓ Test event created successfully`);
    console.log(`  Event ID: ${response.data.id}`);
    console.log(`  Meet Link: ${response.data.hangoutLink || 'N/A'}`);

    return { success: true, eventId: response.data.id, meetLink: response.data.hangoutLink };
  } catch (error: any) {
    console.error('✗ Calendar event creation failed:', error.message);
    throw error;
  }
}

async function runAllTests() {
  console.log('==============================================');
  console.log('  GOOGLE INTEGRATION TEST SUITE - ROOF HR');
  console.log('==============================================');
  console.log(`Test User: ${TEST_USER_EMAIL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  const results: { [key: string]: any } = {};
  let allPassed = true;

  try {
    results['serviceAccountConfig'] = await testServiceAccountConfig();
  } catch (error) {
    results['serviceAccountConfig'] = { error: String(error) };
    allPassed = false;
  }

  try {
    results['googleAuth'] = await testGoogleAuth();
  } catch (error) {
    results['googleAuth'] = { error: String(error) };
    allPassed = false;
  }

  try {
    results['gmail'] = await testGmailConnection();
  } catch (error) {
    results['gmail'] = { error: String(error) };
    allPassed = false;
  }

  try {
    results['calendar'] = await testCalendarConnection();
  } catch (error) {
    results['calendar'] = { error: String(error) };
    allPassed = false;
  }

  try {
    results['drive'] = await testDriveConnection();
  } catch (error) {
    results['drive'] = { error: String(error) };
    allPassed = false;
  }

  try {
    results['calendarEventCreation'] = await testCalendarEventCreation(true); // Dry run
  } catch (error) {
    results['calendarEventCreation'] = { error: String(error) };
    allPassed = false;
  }

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
runAllTests()
  .then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
