/**
 * Schedule a real test interview with Google Meet
 * Run with: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/schedule-test-interview.ts
 */

import dotenv from 'dotenv';
dotenv.config();

async function scheduleTestInterview() {
  const { serviceAccountAuth } = await import('../services/service-account-auth');

  const ORGANIZER_EMAIL = process.env.GOOGLE_USER_EMAIL || 'ahmed.mahmoud@theroofdocs.com';
  const ATTENDEE_EMAIL = 'careers@theroofdocs.com';

  console.log('==============================================');
  console.log('  SCHEDULING TEST INTERVIEW - ROOF HR');
  console.log('==============================================');
  console.log(`Organizer: ${ORGANIZER_EMAIL}`);
  console.log(`Attendee: ${ATTENDEE_EMAIL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    const calendar = await serviceAccountAuth.getCalendarForUser(ORGANIZER_EMAIL);
    console.log('\n✓ Calendar service obtained');

    // Schedule for tomorrow at 2 PM EST
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0); // 2 PM

    const endTime = new Date(tomorrow);
    endTime.setHours(15, 0, 0, 0); // 3 PM (1 hour interview)

    const eventData = {
      summary: 'Test Interview - Google Integration Verification',
      description: `This is a test interview scheduled to verify the Google Calendar integration is working correctly.

Created by: Roof HR System
Purpose: Integration Testing
Date Created: ${new Date().toISOString()}

This event can be deleted after verification.`,
      start: {
        dateTime: tomorrow.toISOString(),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/New_York'
      },
      attendees: [
        { email: ATTENDEE_EMAIL },
        { email: ORGANIZER_EMAIL }
      ],
      conferenceData: {
        createRequest: {
          requestId: `test-interview-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 }
        ]
      }
    };

    console.log('\n📅 Creating calendar event...');
    console.log(`  Title: ${eventData.summary}`);
    console.log(`  Start: ${tomorrow.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);
    console.log(`  End: ${endTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);
    console.log(`  Attendees: ${eventData.attendees.map(a => a.email).join(', ')}`);

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData,
      conferenceDataVersion: 1,
      sendUpdates: 'all' // Send calendar invites to attendees
    });

    console.log('\n========================================');
    console.log('  ✓ TEST INTERVIEW SCHEDULED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`\n📋 Event Details:`);
    console.log(`  Event ID: ${response.data.id}`);
    console.log(`  HTML Link: ${response.data.htmlLink}`);
    console.log(`  Google Meet: ${response.data.hangoutLink || 'Not generated'}`);
    console.log(`  Status: ${response.data.status}`);
    console.log(`  Created: ${response.data.created}`);

    if (response.data.attendees) {
      console.log(`\n📧 Attendee Status:`);
      response.data.attendees.forEach(a => {
        console.log(`  - ${a.email}: ${a.responseStatus}`);
      });
    }

    console.log('\n✅ Calendar invite sent! Check:');
    console.log(`  1. ${ORGANIZER_EMAIL} calendar`);
    console.log(`  2. ${ATTENDEE_EMAIL} inbox for invite`);
    console.log('\n========================================\n');

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      meetLink: response.data.hangoutLink
    };

  } catch (error: any) {
    console.error('\n✗ Failed to schedule interview:', error.message);
    if (error.errors) {
      error.errors.forEach((e: any) => {
        console.error(`  - ${e.reason}: ${e.message}`);
      });
    }
    throw error;
  }
}

// Run
scheduleTestInterview()
  .then(result => {
    console.log('Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
