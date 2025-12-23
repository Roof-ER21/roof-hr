/**
 * Test Interview Scheduling with Google Calendar Integration
 * This script tests the full flow: schedule interview -> create calendar event -> send emails
 */

import 'dotenv/config';

const PRODUCTION_URL = 'https://roofhr.up.railway.app';

async function testInterviewScheduling() {
  console.log('Testing Interview Scheduling with Google Calendar Integration\n');

  // Step 1: Login as admin
  console.log('1. Logging in as admin...');
  const loginResponse = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ahmed.mahmoud@theroofdocs.com',
      password: process.env.ADMIN_TEMP_PASSWORD || 'TRD2025!'
    })
  });

  if (!loginResponse.ok) {
    const error = await loginResponse.text();
    console.error('Login failed:', error);
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('Logged in successfully\n');

  // Step 2: Get list of users to find Ryan Ferguson
  console.log('2. Finding Ryan Ferguson...');
  const usersResponse = await fetch(`${PRODUCTION_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!usersResponse.ok) {
    console.error('Failed to fetch users');
    return;
  }

  const users = await usersResponse.json();
  const ryanFerguson = users.find((u: any) =>
    u.firstName && u.lastName &&
    u.firstName.toLowerCase() === 'ryan' &&
    u.lastName.toLowerCase() === 'ferguson'
  );
  const ahmedMahmoud = users.find((u: any) =>
    u.email === 'ahmed.mahmoud@theroofdocs.com'
  );

  console.log('Users found:');
  console.log('  - Ahmed:', ahmedMahmoud ? ahmedMahmoud.email : 'NOT FOUND');
  console.log('  - Ryan Ferguson:', ryanFerguson ? ryanFerguson.email : 'NOT FOUND');

  if (!ryanFerguson) {
    console.log('\nRyan Ferguson not found. Available users:');
    users.slice(0, 15).forEach((u: any) => {
      console.log('  -', u.firstName, u.lastName, '(' + u.email + ')');
    });
    return;
  }

  // Step 3: Get a candidate to schedule interview for
  console.log('\n3. Finding a candidate...');
  const candidatesResponse = await fetch(`${PRODUCTION_URL}/api/candidates`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!candidatesResponse.ok) {
    console.error('Failed to fetch candidates');
    return;
  }

  const candidates = await candidatesResponse.json();
  const testCandidate = candidates[0]; // Get first candidate

  if (!testCandidate) {
    console.log('No candidates found.');
    return;
  }

  console.log('Using candidate:', testCandidate.firstName, testCandidate.lastName, '(' + testCandidate.email + ')\n');

  // Step 4: Schedule interview with Ryan Ferguson as interviewer
  console.log('4. Scheduling interview...');

  // Schedule for tomorrow at 2 PM EST
  const interviewDate = new Date();
  interviewDate.setDate(interviewDate.getDate() + 1);
  interviewDate.setHours(14, 0, 0, 0);

  const interviewData = {
    candidateId: testCandidate.id,
    interviewerId: ryanFerguson.id,
    scheduledDate: interviewDate.toISOString(),
    duration: 30,
    type: 'VIDEO', // This will trigger Google Meet link creation
    notes: 'Test interview scheduled via API to verify Google Calendar integration',
    sendReminders: true,
    reminderHours: 24
  };

  console.log('Interview details:');
  console.log('  Candidate:', testCandidate.firstName, testCandidate.lastName);
  console.log('  Interviewer:', ryanFerguson.firstName, ryanFerguson.lastName, '(' + ryanFerguson.email + ')');
  console.log('  Date:', interviewDate.toLocaleString());
  console.log('  Type: VIDEO (will create Google Meet link)');

  const scheduleResponse = await fetch(`${PRODUCTION_URL}/api/interviews/schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(interviewData)
  });

  const scheduleResult = await scheduleResponse.json();

  if (!scheduleResponse.ok) {
    console.error('\nFailed to schedule interview:', scheduleResult);
    return;
  }

  console.log('\nInterview scheduled successfully!');
  console.log('Interview ID:', scheduleResult.id);
  console.log('Google Event ID:', scheduleResult.googleEventId || 'NOT CREATED');
  console.log('Meeting Link:', scheduleResult.meetingLink || 'NOT GENERATED');

  if (scheduleResult.warnings) {
    console.log('\nWarnings:', scheduleResult.warnings);
  }

  console.log('\nTest complete! Check:');
  console.log('  1. Ryan Ferguson\'s Google Calendar for the event');
  console.log('  2. Email inboxes for interview notifications');
  console.log('  3. Railway logs for detailed execution logs');
}

testInterviewScheduling().catch(console.error);
