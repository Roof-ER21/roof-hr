import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

async function diagnoseGoogleAuth() {
  console.log('🔍 Google Authentication Diagnostic Tool');
  console.log('=========================================\n');

  // Check environment variables
  const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'GOOGLE_REFRESH_TOKEN'
  ];

  console.log('1️⃣ Checking environment variables:');
  let allVarsPresent = true;
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName} is set`);
    } else {
      console.log(`   ❌ ${varName} is missing`);
      allVarsPresent = false;
    }
  }

  if (!allVarsPresent) {
    console.log('\n❌ Missing required environment variables. Cannot proceed.');
    return;
  }

  console.log('\n2️⃣ Testing OAuth2 token refresh:');
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:5000/google-oauth-setup'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  try {
    console.log('   Attempting to refresh access token...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (credentials.access_token) {
      console.log('   ✅ Successfully refreshed access token!');
      console.log(`   Token expires at: ${new Date(credentials.expiry_date!).toLocaleString()}`);
      
      // Test Gmail API access
      console.log('\n3️⃣ Testing Gmail API access:');
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log(`   ✅ Gmail API working! Email: ${profile.data.emailAddress}`);
        console.log(`   Messages in mailbox: ${profile.data.messagesTotal}`);
      } catch (gmailError: any) {
        console.log(`   ❌ Gmail API error: ${gmailError.message}`);
      }
      
      // Test Drive API access
      console.log('\n4️⃣ Testing Google Drive API access:');
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      try {
        const about = await drive.about.get({ fields: 'user' });
        console.log(`   ✅ Drive API working! User: ${about.data.user?.displayName}`);
      } catch (driveError: any) {
        console.log(`   ❌ Drive API error: ${driveError.message}`);
      }
      
    } else {
      console.log('   ❌ No access token received');
    }
  } catch (error: any) {
    console.log('   ❌ Failed to refresh token');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n⚠️  SOLUTION: Your refresh token has expired or been revoked.');
      console.log('   You need to generate a new refresh token:');
      console.log('   1. Go to the Google OAuth Setup page in your app');
      console.log('   2. Click "Authorize with Google"');
      console.log('   3. Complete the authorization flow');
      console.log('   4. Copy the new refresh token');
      console.log('   5. Update the GOOGLE_REFRESH_TOKEN environment variable\n');
    } else if (error.message.includes('invalid_client')) {
      console.log('\n⚠️  SOLUTION: Your client credentials are invalid.');
      console.log('   Verify that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET match');
      console.log('   the credentials in your Google Cloud Console.\n');
    }
  }

  console.log('\n5️⃣ Summary:');
  console.log('===========');
  console.log('If all tests passed, your Google authentication is working correctly.');
  console.log('If any tests failed, follow the solutions provided above.');
  console.log('\nTo generate a new refresh token:');
  console.log('1. Start your application');
  console.log('2. Navigate to /google-oauth-setup');
  console.log('3. Complete the OAuth flow');
  console.log('4. Update your GOOGLE_REFRESH_TOKEN environment variable');
}

// Run the diagnostic
diagnoseGoogleAuth()
  .then(() => {
    console.log('\n✨ Diagnostic complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic error:', error);
    process.exit(1);
  });