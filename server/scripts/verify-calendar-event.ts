/**
 * Verify calendar event exists
 * Run with: npx tsx server/scripts/verify-calendar-event.ts
 */

import dotenv from 'dotenv';
dotenv.config();

async function verifyEvent() {
  const { serviceAccountAuth } = await import('../services/service-account-auth');

  const USER_EMAIL = process.env.GOOGLE_USER_EMAIL || 'ahmed.mahmoud@theroofdocs.com';
  const EVENT_ID = '6issi1apv27tvdui8bker8an8c';

  console.log('==============================================');
  console.log('  VERIFYING CALENDAR EVENT');
  console.log('==============================================');

  try {
    const calendar = await serviceAccountAuth.getCalendarForUser(USER_EMAIL);

    // Get the specific event
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: EVENT_ID
    });

    console.log('\n✓ Event found on Google Calendar!');
    console.log('\n📋 Event Details:');
    console.log(`  Summary: ${event.data.summary}`);
    console.log(`  Status: ${event.data.status}`);
    console.log(`  Start: ${event.data.start?.dateTime}`);
    console.log(`  End: ${event.data.end?.dateTime}`);
    console.log(`  Meet Link: ${event.data.hangoutLink}`);
    console.log(`  HTML Link: ${event.data.htmlLink}`);

    if (event.data.attendees) {
      console.log('\n📧 Attendees:');
      event.data.attendees.forEach(a => {
        console.log(`  - ${a.email}: ${a.responseStatus}`);
      });
    }

    // Also list upcoming events to double-check
    console.log('\n📅 Upcoming events on calendar:');
    const now = new Date();
    const listResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = listResponse.data.items || [];
    events.forEach((e, i) => {
      const isOurEvent = e.id === EVENT_ID ? ' ← OUR TEST EVENT' : '';
      console.log(`  ${i + 1}. ${e.summary} - ${e.start?.dateTime || e.start?.date}${isOurEvent}`);
    });

    console.log('\n========================================');
    console.log('  ✓ VERIFICATION COMPLETE - EVENT EXISTS!');
    console.log('========================================\n');

    return { success: true, event: event.data };

  } catch (error: any) {
    console.error('\n✗ Verification failed:', error.message);
    throw error;
  }
}

verifyEvent()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
