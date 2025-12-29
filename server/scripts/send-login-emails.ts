import 'dotenv/config';
import { gmailService } from '../services/gmail-service';

// Recipients for login emails
const LOGIN_RECIPIENTS = [
  { email: 'reese.samala@theroofdocs.com', name: 'Reese Samala', role: 'HR Admin' },
  { email: 'oliver.brown@theroofdocs.com', name: 'Oliver Brown', role: 'HR Admin' },
  { email: 'ford.barsi@theroofdocs.com', name: 'Ford Barsi', role: 'HR Admin' },
  { email: 'mike.rafter@theroofdocs.com', name: 'Mike Rafter', role: 'Manager' },
  { email: 'jay@theroofdocs.com', name: 'Jay Waseem', role: 'Manager' },
  { email: 'keith.ziemba@theroofdocs.com', name: 'Keith Ziemba', role: 'Manager' }
];

const PRODUCTION_URL = 'https://roofhr.up.railway.app';
const DEFAULT_PASSWORD = 'TRD2025!';

async function sendLoginEmails() {
  console.log('🚀 Starting to send login emails...\n');

  await gmailService.initialize();

  for (const recipient of LOGIN_RECIPIENTS) {
    try {
      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #1d4ed8; }
            .credentials-box { background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #2563eb; margin: 20px 0; }
            .credentials-box h3 { margin-top: 0; color: #1e40af; }
            .credential-item { background: #f0f9ff; padding: 10px 15px; border-radius: 5px; margin: 10px 0; font-family: monospace; font-size: 14px; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #666; }
            .warning { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .role-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 5px 12px; border-radius: 15px; font-size: 0.85em; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🏠 ROOF HR System</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Account is Ready</p>
            </div>
            <div class="content">
              <h2>Hello ${recipient.name}!</h2>

              <p>Your ROOF HR account has been set up and is ready to use. Below are your login credentials to access the system.</p>

              <div class="credentials-box">
                <h3>🔐 Your Login Credentials</h3>
                <p><strong>Login URL:</strong></p>
                <div class="credential-item">${PRODUCTION_URL}</div>
                <p><strong>Email:</strong></p>
                <div class="credential-item">${recipient.email}</div>
                <p><strong>Password:</strong></p>
                <div class="credential-item">${DEFAULT_PASSWORD}</div>
                <p><strong>Your Role:</strong> <span class="role-badge">${recipient.role}</span></p>
              </div>

              <div class="warning">
                <strong>⚠️ Security Reminder:</strong> For your security, please change your password after your first login. Go to Settings → Change Password.
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${PRODUCTION_URL}" class="button">Login to ROOF HR →</a>
              </div>

              <p><strong>Quick Start Guide:</strong></p>
              <ol>
                <li>Click the login button above or go to <a href="${PRODUCTION_URL}">${PRODUCTION_URL}</a></li>
                <li>Enter your email and password</li>
                <li>Explore your dashboard</li>
                <li>Try asking Susan AI any HR-related questions</li>
              </ol>

              <p><strong>Need Help?</strong></p>
              <ul>
                <li>Use <strong>Susan AI</strong> in the system for instant assistance</li>
                <li>Contact HR at <a href="mailto:careers@theroofdocs.com">careers@theroofdocs.com</a></li>
              </ul>

              <div class="footer">
                <p>This email was sent from the ROOF HR System.</p>
                <p>© 2025 The Roof Docs. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await gmailService.sendEmail({
        to: recipient.email,
        subject: '🔐 Your ROOF HR Login Credentials',
        html: emailContent,
        from: '"ROOF HR System" <ahmed.mahmoud@theroofdocs.com>',
        userEmail: 'ahmed.mahmoud@theroofdocs.com'
      });

      console.log(`✅ Login email sent to ${recipient.name} (${recipient.email})`);

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`❌ Failed to send email to ${recipient.name}:`, error.message);
    }
  }

  console.log('\n✨ Login email process complete!');
}

// Execute
console.log('ROOF HR System - Login Email Sender');
console.log('====================================\n');

sendLoginEmails()
  .then(() => {
    console.log('\nProcess completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
