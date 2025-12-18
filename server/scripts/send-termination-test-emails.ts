/**
 * Send 4 Test Termination Reminder Emails
 *
 * This script sends all 4 emails in the termination workflow to careers@ and support@
 * (excluding info@ per request) so you can see what each email looks like.
 *
 * Simulates someone terminated TODAY, showing what they'd receive over time:
 * 1. Day 0 - Initial equipment return email (sent today)
 * 2. Day 7 - No schedule set reminder (would be sent 7 days from now)
 * 3. Day 15 - Equipment not returned alert (would be sent 15 days from now)
 * 4. Day 30 - URGENT: No signed form (would be sent 30 days from now)
 *
 * Run: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/send-termination-test-emails.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';

const CAREERS_EMAIL = 'careers@theroofdocs.com';
const SUPPORT_EMAIL = 'support@theroofdocs.com';

// Test employee data
const testEmployee = {
  name: 'Test Employee - John Smith',
  email: 'test.terminated@example.com'
};

// Calculate dates (forward from today - as it would happen in real life)
// If someone is terminated today, Day 0 = today, Day 7 = 7 days from now, etc.
const today = new Date();
const day7FromNow = new Date(today);
day7FromNow.setDate(day7FromNow.getDate() + 7);
const day15FromNow = new Date(today);
day15FromNow.setDate(day15FromNow.getDate() + 15);
const day30FromNow = new Date(today);
day30FromNow.setDate(day30FromNow.getDate() + 30);

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function sendEmail(
  credentials: any,
  to: string,
  cc: string[],
  subject: string,
  html: string
) {
  const fromEmail = 'ahmed.mahmoud@theroofdocs.com';

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: fromEmail,
  });

  const gmail = google.gmail({ version: 'v1', auth });

  const emailContent = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html
  ].filter(Boolean).join('\r\n');

  const encodedMessage = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });

  return result.data.id;
}

// Email 1: Day 0 - Initial Equipment Return Email
function getDay0Email(terminationDate: Date): { subject: string; html: string } {
  const formattedTermDate = formatDate(terminationDate);
  const scheduleUrl = 'https://roofhr.up.railway.app/equipment-return/TEST-TOKEN-SCHEDULE';
  const checklistUrl = 'https://roofhr.up.railway.app/equipment-checklist/TEST-TOKEN-CHECKLIST';

  return {
    subject: `[TEST - Day 0] Equipment Return Required - Schedule Your Dropoff`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #2563eb; padding: 10px; text-align: center;">
          <span style="color: white; font-size: 12px; font-weight: bold;">TEST EMAIL - Day 0 (Initial Notice)</span>
        </div>
        <div style="background-color: #1e3a5f; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Return Required</h1>
        </div>

        <div style="padding: 30px;">
          <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello ${testEmployee.name},</p>

          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            As part of your offboarding process (effective ${formattedTermDate}), you are required to return all company equipment.
          </p>

          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">Important:</strong>
            <p style="margin: 10px 0 0 0; color: #78350f;">
              All equipment must be returned within <strong>15 days</strong> of your termination date.
              Unreturned items will result in paycheck deductions per the equipment agreement you signed.
            </p>
          </div>

          <h3 style="color: #1e3a5f; margin-top: 25px;">Step 1: Schedule Your Dropoff</h3>
          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            Select a convenient date and time to drop off your equipment at the office.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${scheduleUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Schedule Dropoff Time
            </a>
          </div>

          <h3 style="color: #1e3a5f; margin-top: 25px;">Step 2: Bring Your Equipment</h3>
          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            On your scheduled day, bring all company equipment to the office.
          </p>

          <h3 style="color: #1e3a5f; margin-top: 25px;">Step 3: Sign Equipment Return Form</h3>
          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            After returning your items, complete the equipment return checklist.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${checklistUrl}"
               style="display: inline-block; background-color: #059669; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Complete Return Checklist
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="font-size: 13px; color: #666;">
            <strong>Schedule Link:</strong> <a href="${scheduleUrl}" style="color: #2563eb;">${scheduleUrl}</a><br>
            <strong>Checklist Link:</strong> <a href="${checklistUrl}" style="color: #059669;">${checklistUrl}</a>
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #333; margin-top: 20px;">
            If you have any questions, please contact HR at careers@theroofdocs.com
          </p>

          <p style="font-size: 15px; line-height: 1.7; color: #333;">
            Thank you,<br>
            <strong>Roof-ER HR Team</strong>
          </p>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated message from the Roof-ER HR system.
          </p>
        </div>
      </div>
    `
  };
}

// Email 2: Day 7 - No Schedule Set Reminder
function getDay7Email(terminationDate: Date): { subject: string; html: string } {
  const formattedTermDate = formatDate(terminationDate);

  return {
    subject: `[TEST - Day 7] Equipment Return Not Scheduled: ${testEmployee.name} | 7-Day Alert`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #2563eb; padding: 10px; text-align: center;">
          <span style="color: white; font-size: 12px; font-weight: bold;">TEST EMAIL - Day 7 (No Schedule Reminder)</span>
        </div>
        <div style="background-color: #f59e0b; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Return Alert</h1>
        </div>

        <div style="padding: 30px;">
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            <h2 style="margin-top: 0; color: #92400e;">7 Days Since Termination - No Return Scheduled</h2>
            <p style="margin: 0; color: #92400e;">
              The following employee has not scheduled their equipment return dropoff.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold; width: 40%;">Employee Name</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${testEmployee.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold;">Employee Email</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><a href="mailto:${testEmployee.email}">${testEmployee.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold;">Termination Date</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${formattedTermDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: bold;">Days Since Termination</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">7 days</td>
            </tr>
          </table>

          <h3 style="color: #374151;">Recommended Actions:</h3>
          <ol style="color: #4b5563; line-height: 1.8;">
            <li>Contact the employee directly to remind them to schedule a return</li>
            <li>Resend the equipment return scheduling link if needed</li>
            <li>Document all communication attempts</li>
          </ol>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            This is an automated alert from the Roof HR system. A 30-day reminder will be sent if the equipment is still not returned.
          </p>
        </div>
      </div>
    `
  };
}

// Email 3: Day 15 - Equipment Not Returned Alert
function getDay15Email(terminationDate: Date): { subject: string; html: string } {
  const formattedTermDate = formatDate(terminationDate);

  return {
    subject: `[TEST - Day 15] Equipment Return Follow-up Required: ${testEmployee.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #2563eb; padding: 10px; text-align: center;">
          <span style="color: white; font-size: 12px; font-weight: bold;">TEST EMAIL - Day 15 (Equipment Not Returned)</span>
        </div>
        <div style="background-color: #ea580c; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Return Alert - 15 Days</h1>
        </div>

        <div style="padding: 30px;">
          <div style="background-color: #ffedd5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ea580c;">
            <h2 style="margin-top: 0; color: #9a3412;">15 Days Since Termination - Action Required</h2>
            <p style="margin: 0; color: #9a3412;">
              Equipment has <strong>NOT</strong> been marked as returned.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #ffedd5; font-weight: bold; width: 40%;">Employee Name</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${testEmployee.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #ffedd5; font-weight: bold;">Employee Email</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><a href="mailto:${testEmployee.email}">${testEmployee.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #ffedd5; font-weight: bold;">Termination Date</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${formattedTermDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #ffedd5; font-weight: bold;">Days Since Termination</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; color: #ea580c; font-weight: bold; font-size: 18px;">15 days</td>
            </tr>
          </table>

          <h3 style="color: #9a3412;">Actions Required:</h3>
          <ol style="color: #4b5563; line-height: 1.8;">
            <li>Contact the employee to retrieve company belongings</li>
            <li>Update the system when items are returned</li>
            <li>Initiate deduction process if items are not returned</li>
            <li>Prepare formal notice if employee is unresponsive</li>
          </ol>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            This is an automated message from the Roof-ER HR system. A 30-day URGENT reminder will follow.
          </p>
        </div>
      </div>
    `
  };
}

// Email 4: Day 30 - URGENT No Signed Form
function getDay30Email(terminationDate: Date): { subject: string; html: string } {
  const formattedTermDate = formatDate(terminationDate);

  return {
    subject: `[TEST - Day 30] URGENT: Equipment Not Returned - 30 Days: ${testEmployee.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #2563eb; padding: 10px; text-align: center;">
          <span style="color: white; font-size: 12px; font-weight: bold;">TEST EMAIL - Day 30 (URGENT Final Notice)</span>
        </div>
        <div style="background-color: #dc2626; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">URGENT: Equipment Not Returned</h1>
        </div>

        <div style="padding: 30px;">
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="margin-top: 0; color: #991b1b;">30 Days Since Termination - Action Required</h2>
            <p style="margin: 0; color: #991b1b;">
              The following employee has not returned company equipment and has not signed a return form.
              <strong>Immediate action is required.</strong>
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold; width: 40%;">Employee Name</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${testEmployee.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold;">Employee Email</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><a href="mailto:${testEmployee.email}">${testEmployee.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold;">Termination Date</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${formattedTermDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #fef2f2; font-weight: bold;">Days Since Termination</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold; font-size: 18px;">30+ days</td>
            </tr>
          </table>

          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">Equipment Fee Schedule (Per Policy)</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li>Ladder: <strong>$300</strong></li>
              <li>iPad w/ keyboard set: <strong>$500</strong></li>
              <li>High-powered Flashlight: <strong>$70</strong></li>
              <li>Two Company Polos: <strong>$140 Total</strong></li>
              <li>Company Winter Jacket: <strong>$250</strong></li>
              <li>Company Long-sleeve shirt: <strong>$70</strong></li>
            </ul>
          </div>

          <h3 style="color: #991b1b;">Immediate Actions Required:</h3>
          <ol style="color: #4b5563; line-height: 1.8;">
            <li><strong>Final Contact Attempt:</strong> Call the employee directly</li>
            <li><strong>Formal Notice:</strong> Send written notice regarding equipment fees</li>
            <li><strong>Invoice Preparation:</strong> Prepare invoice for unreturned equipment per fee schedule</li>
            <li><strong>Legal Consultation:</strong> Consult with legal if employee is unresponsive</li>
            <li><strong>Payroll Deduction:</strong> If applicable, coordinate with payroll for commission deduction</li>
          </ol>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            This is an automated URGENT alert from the Roof HR system. No further automated reminders will be sent.
          </p>
        </div>
      </div>
    `
  };
}

async function main() {
  console.log('=== Sending 4 Test Termination Reminder Emails ===\n');

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
    process.exit(1);
  }

  const credentials = JSON.parse(serviceAccountKey);

  try {
    // All emails simulate same employee terminated today
    // The emails show what would be sent at each stage of the timeline

    // Email 1: Day 0 - Sent today (termination date = today)
    console.log('1. Sending Day 0 - Initial Equipment Return Email...');
    console.log(`   (This email would be sent TODAY - ${formatDate(today)})`);
    const email1 = getDay0Email(today);
    await sendEmail(credentials, CAREERS_EMAIL, [SUPPORT_EMAIL], email1.subject, email1.html);
    console.log(`   Sent to: ${CAREERS_EMAIL}, CC: ${SUPPORT_EMAIL}`);
    console.log(`   Termination Date shown: ${formatDate(today)}\n`);

    // Email 2: Day 7 - Would be sent 7 days from now (termination date = today)
    console.log('2. Sending Day 7 - No Schedule Reminder...');
    console.log(`   (This email would be sent on ${formatDate(day7FromNow)})`);
    const email2 = getDay7Email(today);  // termination was today
    await sendEmail(credentials, CAREERS_EMAIL, [SUPPORT_EMAIL], email2.subject, email2.html);
    console.log(`   Sent to: ${CAREERS_EMAIL}, CC: ${SUPPORT_EMAIL}`);
    console.log(`   Termination Date shown: ${formatDate(today)}\n`);

    // Email 3: Day 15 - Would be sent 15 days from now (termination date = today)
    console.log('3. Sending Day 15 - Equipment Not Returned Alert...');
    console.log(`   (This email would be sent on ${formatDate(day15FromNow)})`);
    const email3 = getDay15Email(today);  // termination was today
    await sendEmail(credentials, CAREERS_EMAIL, [SUPPORT_EMAIL], email3.subject, email3.html);
    console.log(`   Sent to: ${CAREERS_EMAIL}, CC: ${SUPPORT_EMAIL}`);
    console.log(`   Termination Date shown: ${formatDate(today)}\n`);

    // Email 4: Day 30 - Would be sent 30 days from now (termination date = today)
    console.log('4. Sending Day 30 - URGENT Final Notice...');
    console.log(`   (This email would be sent on ${formatDate(day30FromNow)})`);
    const email4 = getDay30Email(today);  // termination was today
    await sendEmail(credentials, CAREERS_EMAIL, [SUPPORT_EMAIL], email4.subject, email4.html);
    console.log(`   Sent to: ${CAREERS_EMAIL}, CC: ${SUPPORT_EMAIL}`);
    console.log(`   Termination Date shown: ${formatDate(today)}\n`);

    console.log('=== All 4 Test Emails Sent Successfully! ===');
    console.log('\nCheck the following inboxes:');
    console.log(`  - ${CAREERS_EMAIL}`);
    console.log(`  - ${SUPPORT_EMAIL}`);
    console.log('\nEach email has a blue banner at the top indicating which day it represents.');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
