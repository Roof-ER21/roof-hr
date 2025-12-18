/**
 * Send Equipment Agreement Emails
 *
 * Run: npx tsx server/scripts/send-agreement-emails.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';

interface AgreementData {
  employeeName: string;
  employeeEmail: string;
  accessToken: string;
  items: { name: string; quantity: number }[];
}

const agreements: AgreementData[] = [
  {
    employeeName: 'Ryan',
    employeeEmail: 'Careers@theroofdocs.com',
    accessToken: '59bff6fc81705b8c2da0efd46da1507e4f7ee4d987c888204850ab7045bbb1df',
    items: [
      { name: 'iPad', quantity: 1 },
      { name: 'Keyboard', quantity: 1 },
      { name: 'Gray Polo', quantity: 2 },
      { name: 'Black Polo', quantity: 2 },
      { name: 'Gray Quarter Zip', quantity: 1 },
      { name: 'Black Quarter Zip', quantity: 1 },
      { name: 'black polo', quantity: 1 }
    ]
  },
  {
    employeeName: 'Big Baller',
    employeeEmail: 'omniasaqr1@gmail.com',
    accessToken: '2f7281d668ecdc966af2241c9f38de707bad76cd4fe16c56915a215fae609f62',
    items: [
      { name: 'iPad', quantity: 1 },
      { name: 'Keyboard', quantity: 1 },
      { name: 'Gray Polo', quantity: 2 },
      { name: 'Black Polo', quantity: 2 },
      { name: 'Gray Quarter Zip', quantity: 1 },
      { name: 'Black Quarter Zip', quantity: 1 }
    ]
  }
];

async function sendAgreementEmail(agreement: AgreementData) {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    console.error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
    process.exit(1);
  }

  const credentials = JSON.parse(serviceAccountKey);
  const fromEmail = 'ahmed.mahmoud@theroofdocs.com';

  const formUrl = `https://roofhr.up.railway.app/equipment-agreement/${agreement.accessToken}`;

  const itemsHtml = agreement.items.map(item =>
    `<tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
    </tr>`
  ).join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #2563eb; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Equipment Agreement</h1>
      </div>

      <div style="padding: 30px;">
        <p style="font-size: 15px; line-height: 1.7; color: #333;">Hello ${agreement.employeeName},</p>

        <p style="font-size: 15px; line-height: 1.7; color: #333;">
          Welcome to Roof-ER! As part of your onboarding, we need you to review and sign an equipment agreement
          for the company items you will be receiving.
        </p>

        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
          <h3 style="margin-top: 0; color: #0369a1;">Equipment You Will Receive:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #e0f2fe;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #0284c7;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #0284c7;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${formUrl}"
             style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Review & Sign Agreement
          </a>
        </div>

        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          If the button above doesn't work, copy and paste this link into your browser:
          <br><a href="${formUrl}" style="color: #2563eb; word-break: break-all;">${formUrl}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 15px; line-height: 1.7; color: #333;">Best regards,</p>
        <p style="font-size: 15px; line-height: 1.7; color: #333;">
          <strong>Roof-ER HR Team</strong><br>
          Human Resources
        </p>
      </div>

      <div style="background-color: #f9fafb; padding: 15px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          This is an automated message from the Roof-ER HR system.
        </p>
      </div>
    </div>
  `;

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: fromEmail,
    });

    const gmail = google.gmail({ version: 'v1', auth });

    const emailContent = [
      `From: ${fromEmail}`,
      `To: ${agreement.employeeEmail}`,
      `Subject: Equipment Agreement - Please Review and Sign`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlContent
    ].join('\r\n');

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log(`Sending email to ${agreement.employeeName} (${agreement.employeeEmail})...`);

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`✅ Email sent to ${agreement.employeeName}! Message ID: ${result.data.id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${agreement.employeeName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('=== Sending Equipment Agreement Emails ===\n');

  let successCount = 0;
  let failCount = 0;

  for (const agreement of agreements) {
    const success = await sendAgreementEmail(agreement);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Sent: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
