/**
 * Send Test Email - Equipment Agreement System Verification
 *
 * Run: DATABASE_URL="..." npx tsx server/scripts/send-test-email.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';

async function sendTestEmail() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    console.error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
    process.exit(1);
  }

  const credentials = JSON.parse(serviceAccountKey);
  const fromEmail = 'ahmed.mahmoud@theroofdocs.com';
  const toEmail = 'marketing@theroofdocs.com';

  const testItems = [
    { name: 'iPad', quantity: 1 },
    { name: 'iPad Keyboard', quantity: 1 },
    { name: 'Ladder', quantity: 1 },
    { name: 'Flashlight Set', quantity: 1 },
    { name: 'Gray Polo', quantity: 2 },
    { name: 'Black Polo', quantity: 2 },
  ];

  const itemsHtml = testItems.map(item =>
    `<li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
      ${item.name}${item.quantity > 1 ? ` (Qty: ${item.quantity})` : ''}
    </li>`
  ).join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #2563eb; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Agreement System - Test Email</h1>
      </div>

      <div style="padding: 30px;">
        <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello,</p>

        <p style="font-size: 15px; line-height: 1.7; color: #333;">
          This is a <strong>test email</strong> to verify the new Equipment Agreement & Return Tracking System has been deployed successfully.
        </p>

        <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="margin-top: 0; color: #065f46;">✅ System Update Complete</h3>
          <p style="margin: 0; color: #065f46;">
            The Equipment Agreement system has been committed and pushed to production.
          </p>
        </div>

        <h3 style="color: #374151;">New Features:</h3>
        <ul style="color: #4b5563; line-height: 1.8;">
          <li><strong>Onboarding:</strong> New hires sign digital equipment receipt via emailed link</li>
          <li><strong>Offboarding:</strong> Terminated employees schedule equipment return dropoff</li>
          <li><strong>7-Day Reminder:</strong> Alert to HR if no scheduling after termination</li>
          <li><strong>30-Day URGENT Reminder:</strong> Escalation if no signed return form</li>
          <li><strong>Role-Based Equipment:</strong> Default equipment lists per role (customizable by HR)</li>
        </ul>

        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
          <h3 style="margin-top: 0; color: #0369a1;">Sample Equipment List (Sales Rep):</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${itemsHtml}
          </ul>
        </div>

        <p style="font-size: 15px; line-height: 1.7; color: #333;">
          Access the Equipment Agreements tab in the <strong>Documents</strong> section to manage agreements.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 15px; line-height: 1.7; color: #333;">Best regards,</p>
        <p style="font-size: 15px; line-height: 1.7; color: #333;">
          <strong>Roof-ER HR System</strong><br>
          Automated Notification
        </p>
      </div>

      <div style="background-color: #f9fafb; padding: 15px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Git Commit: 51fd6a1 | Deployed: ${new Date().toLocaleString()}
        </p>
      </div>
    </div>
  `;

  try {
    console.log('Initializing service account...');

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: fromEmail, // Impersonate this user
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // Create email content
    const emailContent = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: Equipment Agreement System Deployed - Verification`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlContent
    ].join('\r\n');

    // Encode in base64url
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log(`Sending email from ${fromEmail} to ${toEmail}...`);

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log('✅ Email sent successfully!');
    console.log(`Message ID: ${result.data.id}`);

  } catch (error: any) {
    console.error('❌ Failed to send email:', error.message);
    if (error.errors) {
      console.error('Details:', JSON.stringify(error.errors, null, 2));
    }
  }

  process.exit(0);
}

sendTestEmail().catch(console.error);
