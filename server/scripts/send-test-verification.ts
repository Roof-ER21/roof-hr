/**
 * Test Equipment Agreement Email with Start Date
 *
 * Run: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/send-test-verification.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';
import crypto from 'crypto';
import pg from 'pg';

const TEST_EMPLOYEE_EMAIL = 'omniasaqr1@gmail.com'; // Your email
const TEST_EMPLOYEE_NAME = 'Test Employee';
const TEST_START_DATE = '2025-12-20'; // Future date - form will be locked

async function main() {
  console.log('=== Creating Test Equipment Agreement with Start Date ===\n');

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Generate unique ID and token
    const id = crypto.randomUUID();
    const accessToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 30);

    const items = JSON.stringify([
      { name: 'Test iPad', quantity: 1 },
      { name: 'Test Keyboard', quantity: 1 },
      { name: 'Test Polo Shirt', quantity: 2 }
    ]);

    // Insert test agreement
    const result = await pool.query(`
      INSERT INTO equipment_agreements (
        id, employee_name, employee_email, employee_role,
        access_token, token_expiry, items, status,
        employee_start_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      id,
      TEST_EMPLOYEE_NAME,
      TEST_EMPLOYEE_EMAIL,
      'SALES_REP',
      accessToken,
      tokenExpiry,
      items,
      'PENDING',
      TEST_START_DATE
    ]);

    console.log('✅ Created test agreement:');
    console.log(`   ID: ${id}`);
    console.log(`   Token: ${accessToken}`);
    console.log(`   Start Date: ${TEST_START_DATE} (form will be locked until this date)`);
    console.log('');

    // Send email
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
      process.exit(1);
    }

    const credentials = JSON.parse(serviceAccountKey);
    const fromEmail = 'ahmed.mahmoud@theroofdocs.com';
    const formUrl = `https://roofhr.up.railway.app/equipment-agreement/${accessToken}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
        <div style="background-color: #2563eb; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Equipment Agreement Test</h1>
        </div>
        <div style="padding: 30px;">
          <p>Hello ${TEST_EMPLOYEE_NAME},</p>
          <p>This is a <strong>TEST equipment agreement</strong> to verify the start date locking feature.</p>

          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <strong>Start Date Lock Test:</strong><br>
            This agreement has a start date of <strong>${TEST_START_DATE}</strong>.<br>
            You should see a "locked" message when you open the form, and the signature section should be disabled.
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${formUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Agreement (Locked Test)
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

    const emailContent = [
      `From: ${fromEmail}`,
      `To: ${TEST_EMPLOYEE_EMAIL}`,
      `Subject: [TEST] Equipment Agreement - Start Date Lock Verification`,
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

    console.log(`Sending test email to ${TEST_EMPLOYEE_EMAIL}...`);

    const emailResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage }
    });

    console.log(`✅ Email sent! Message ID: ${emailResult.data.id}`);
    console.log('\n=== Test Complete ===');
    console.log('Check your email and click the link to verify:');
    console.log('1. The link opens the equipment agreement form');
    console.log('2. A "locked" message shows with the start date');
    console.log('3. The signature section is disabled');
    console.log('4. The submit button says "Available on Start Date"');

  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
