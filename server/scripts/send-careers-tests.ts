/**
 * Send two test equipment agreements to Careers
 * 1. Locked (start date: next Monday Dec 23, 2025)
 * 2. Unlocked (start date: yesterday Dec 16, 2025)
 *
 * Run: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/send-careers-tests.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';
import crypto from 'crypto';
import pg from 'pg';

const CAREERS_EMAIL = 'Careers@theroofdocs.com';

interface TestAgreement {
  name: string;
  startDate: string;
  description: string;
}

const testAgreements: TestAgreement[] = [
  {
    name: 'Test - LOCKED (Next Monday)',
    startDate: '2025-12-23', // Next Monday - form will be locked
    description: 'This agreement is LOCKED - you can view but NOT sign until Monday Dec 23'
  },
  {
    name: 'Test - UNLOCKED (Ready to Sign)',
    startDate: '2025-12-16', // Yesterday - can sign immediately
    description: 'This agreement is UNLOCKED - you can view AND sign it now'
  }
];

async function createAndSendAgreement(agreement: TestAgreement, pool: pg.Pool, credentials: any) {
  const id = crypto.randomUUID();
  const accessToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date();
  tokenExpiry.setDate(tokenExpiry.getDate() + 30);

  const items = JSON.stringify([
    { name: 'iPad', quantity: 1 },
    { name: 'Keyboard', quantity: 1 },
    { name: 'Gray Polo', quantity: 2 },
    { name: 'Black Polo', quantity: 2 },
    { name: 'Gray Quarter Zip', quantity: 1 },
    { name: 'Black Quarter Zip', quantity: 1 }
  ]);

  // Insert agreement
  await pool.query(`
    INSERT INTO equipment_agreements (
      id, employee_name, employee_email, employee_role,
      access_token, token_expiry, items, status,
      employee_start_date, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
  `, [
    id,
    agreement.name,
    CAREERS_EMAIL,
    'SALES_REP',
    accessToken,
    tokenExpiry,
    items,
    'PENDING',
    agreement.startDate
  ]);

  console.log(`✅ Created: ${agreement.name}`);
  console.log(`   Start Date: ${agreement.startDate}`);
  console.log(`   Token: ${accessToken.substring(0, 20)}...`);

  // Send email
  const fromEmail = 'ahmed.mahmoud@theroofdocs.com';
  const formUrl = `https://roofhr.up.railway.app/equipment-agreement/${accessToken}`;

  const isLocked = new Date(agreement.startDate) > new Date();
  const statusColor = isLocked ? '#f59e0b' : '#10b981';
  const statusText = isLocked ? 'LOCKED - View Only Until Start Date' : 'UNLOCKED - Ready to Sign';
  const statusBg = isLocked ? '#fef3c7' : '#d1fae5';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <div style="background-color: #2563eb; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Equipment Agreement</h1>
      </div>
      <div style="padding: 30px;">
        <p>Hello,</p>
        <p>This is a <strong>TEST equipment agreement</strong> to verify the start date locking feature.</p>

        <div style="background-color: ${statusBg}; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
          <strong style="color: ${statusColor};">${statusText}</strong><br><br>
          <strong>Start Date:</strong> ${new Date(agreement.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br>
          <strong>Description:</strong> ${agreement.description}
        </div>

        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong>Equipment Items:</strong>
          <ul style="margin: 10px 0;">
            <li>iPad (1)</li>
            <li>Keyboard (1)</li>
            <li>Gray Polo (2)</li>
            <li>Black Polo (2)</li>
            <li>Gray Quarter Zip (1)</li>
            <li>Black Quarter Zip (1)</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${formUrl}"
             style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${isLocked ? 'View Agreement (Locked)' : 'Review & Sign Agreement'}
          </a>
        </div>

        <p style="font-size: 14px; color: #666;">
          Direct link: <a href="${formUrl}">${formUrl}</a>
        </p>
      </div>
    </div>
  `;

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: fromEmail,
  });

  const gmail = google.gmail({ version: 'v1', auth });

  const subject = isLocked
    ? `[TEST - LOCKED] Equipment Agreement - Start Date: ${agreement.startDate}`
    : `[TEST - READY TO SIGN] Equipment Agreement`;

  const emailContent = [
    `From: ${fromEmail}`,
    `To: ${CAREERS_EMAIL}`,
    `Subject: ${subject}`,
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

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });

  console.log(`   Email sent! Message ID: ${result.data.id}\n`);
}

async function main() {
  console.log('=== Sending Test Equipment Agreements to Careers ===\n');
  console.log(`Target: ${CAREERS_EMAIL}\n`);

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
    process.exit(1);
  }

  const credentials = JSON.parse(serviceAccountKey);
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const agreement of testAgreements) {
      await createAndSendAgreement(agreement, pool, credentials);
    }

    console.log('=== Complete ===');
    console.log('Two emails sent to Careers@theroofdocs.com:');
    console.log('1. LOCKED - Start date next Monday (Dec 23) - can view but not sign');
    console.log('2. UNLOCKED - Start date yesterday (Dec 16) - can sign immediately');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
