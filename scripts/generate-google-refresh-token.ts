/**
 * Google OAuth Refresh Token Generator
 *
 * This script helps generate a Google OAuth refresh token for Calendar API access.
 *
 * Usage:
 *   npx tsx scripts/generate-google-refresh-token.ts
 *
 * Requirements:
 *   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
 *   - GOOGLE_REDIRECT_URI should be http://localhost:3333/oauth2callback
 */

import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import { parse as parseUrl } from 'url';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cross-platform browser opener
function openBrowser(urlToOpen: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${urlToOpen}"`;
    } else if (platform === 'win32') {
      command = `start "" "${urlToOpen}"`;
    } else {
      command = `xdg-open "${urlToOpen}"`;
    }

    exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

// Required scopes for calendar conflict detection
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    console.log('\nTo set up Google OAuth:');
    console.log('1. Go to https://console.cloud.google.com/apis/credentials');
    console.log('2. Create or select an OAuth 2.0 Client ID');
    console.log('3. Add http://localhost:3333/oauth2callback to Authorized redirect URIs');
    console.log('4. Copy the Client ID and Client Secret to your .env file');
    process.exit(1);
  }

  console.log('🔐 Google OAuth Refresh Token Generator\n');
  console.log('This will open your browser to authorize calendar access.');
  console.log('Sign in with a @theroofdocs.com account that has calendar access.\n');

  const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

  // Generate the authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });

  // Create a promise that resolves when we get the authorization code
  const codePromise = new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const queryParams = parseUrl(req.url || '', true).query;
        const code = queryParams.code as string;
        const error = queryParams.error as string;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          reject(new Error(error));
          server.close();
          return;
        }

        if (!code) {
          return; // Ignore favicon requests, etc.
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>✅ Authorization Successful!</h1>
              <p>You can close this window and check the terminal for your refresh token.</p>
            </body>
          </html>
        `);

        resolve(code);
        server.close();
      } catch (err) {
        reject(err);
        server.close();
      }
    });

    server.listen(PORT, () => {
      console.log(`📡 Local server listening on port ${PORT}`);
      console.log('🌐 Opening browser for authorization...\n');
    });

    // Open the browser
    openBrowser(authUrl).catch((err) => {
      console.log('⚠️  Could not open browser automatically.');
      console.log('Please open this URL in your browser:\n');
      console.log(authUrl);
    });
  });

  try {
    const code = await codePromise;
    console.log('\n📝 Authorization code received. Exchanging for tokens...\n');

    // Exchange the authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('❌ No refresh token received!');
      console.log('This usually happens if you\'ve already authorized this app.');
      console.log('\nTo get a new refresh token:');
      console.log('1. Go to https://myaccount.google.com/permissions');
      console.log('2. Remove access for "Roof HR" or your app name');
      console.log('3. Run this script again\n');
      process.exit(1);
    }

    console.log('✅ Success! Here is your refresh token:\n');
    console.log('━'.repeat(60));
    console.log(tokens.refresh_token);
    console.log('━'.repeat(60));
    console.log('\n📋 Copy this token and add it to Railway environment variables:');
    console.log('   Variable name: GOOGLE_REFRESH_TOKEN');
    console.log('   Variable value: <the token above>\n');
    console.log('After adding to Railway, redeploy to enable Google Calendar conflict detection.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
