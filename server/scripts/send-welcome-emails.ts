import { db } from '../db';
import { users } from '../../shared/schema';
import { gmailService } from '../services/gmail-service';
import { eq, inArray } from 'drizzle-orm';

// Recipients for welcome emails
const WELCOME_RECIPIENTS = [
  { email: 'ahmed.mahmoud@theroofdocs.com', name: 'Ahmed Mahmoud' },
  { email: 'careers@theroofdocs.com', name: 'Careers Team' },
  { email: 'reese.samala@theroofdocs.com', name: 'Reese Samala' },
  { email: 'oliver.brown@theroofdocs.com', name: 'Oliver Brown' },
  { email: 'ford.barsi@theroofdocs.com', name: 'Ford Barsi' }
];

async function sendWelcomeEmails(productionUrl: string = 'https://your-app.replit.app') {
  console.log('🚀 Starting to send welcome emails...\n');
  
  await gmailService.initialize();
  
  for (const recipient of WELCOME_RECIPIENTS) {
    try {
      // Check if user exists in database
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, recipient.email));
      
      let loginCredentials = '';
      if (existingUser) {
        loginCredentials = `
          <p><strong>Your Login Credentials:</strong></p>
          <ul>
            <li>Email: ${recipient.email}</li>
            <li>Temporary Password: Welcome2025!</li>
          </ul>
          <p><em>Please change your password after your first login.</em></p>
        `;
      } else {
        loginCredentials = `
          <p><strong>Account Setup:</strong></p>
          <p>Your account will be created by an administrator. You will receive separate login credentials.</p>
        `;
      }
      
      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #666; }
            ul { margin: 10px 0; padding-left: 20px; }
            .highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ROOF-ER HR System!</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipient.name}!</h2>
              
              <p>We're excited to announce that the ROOF-ER HR Management System is now live and ready for use!</p>
              
              <div class="highlight">
                <strong>🎉 System Features:</strong>
                <ul>
                  <li>Complete employee management and directory</li>
                  <li>Smart recruitment workflow with AI assistance</li>
                  <li>Tools & equipment inventory tracking</li>
                  <li>PTO management with automated workflows</li>
                  <li>Performance reviews and document management</li>
                  <li>Susan AI - Your intelligent HR assistant</li>
                  <li>Google ecosystem integration (Calendar, Drive, Gmail)</li>
                </ul>
              </div>
              
              ${loginCredentials}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${productionUrl}" class="button">Access HR System</a>
              </div>
              
              <p><strong>Getting Started:</strong></p>
              <ol>
                <li>Click the button above to access the system</li>
                <li>Log in with your credentials</li>
                <li>Explore the dashboard and familiarize yourself with the features</li>
                <li>Update your profile information</li>
                <li>Start using Susan AI for any HR-related questions</li>
              </ol>
              
              <p><strong>Need Help?</strong></p>
              <p>If you have any questions or need assistance, you can:</p>
              <ul>
                <li>Use Susan AI within the system for instant help</li>
                <li>Contact the HR team at careers@theroofdocs.com</li>
                <li>Check the built-in documentation and guides</li>
              </ul>
              
              <div class="footer">
                <p>This is an automated message from the ROOF-ER HR System.</p>
                <p>© 2025 ROOF-ER Roofing Company. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      await gmailService.sendEmail({
        to: recipient.email,
        subject: '🎉 Welcome to ROOF-ER HR System - Your Access is Ready!',
        html: emailContent,
        from: '"ROOF-ER HR System" <admin@theroofdocs.com>'
      });
      
      console.log(`✅ Welcome email sent to ${recipient.name} (${recipient.email})`);
      
    } catch (error: any) {
      console.error(`❌ Failed to send email to ${recipient.name}:`, error.message);
      
      // Log what the email would contain for manual sending if needed
      console.log(`\n📧 Email content for ${recipient.name} (${recipient.email}):`);
      console.log(`   Subject: Welcome to ROOF-ER HR System - Your Access is Ready!`);
      console.log(`   Login URL: ${productionUrl}`);
      console.log(`   Note: Send this manually if automatic sending fails.\n`);
    }
  }
  
  console.log('\n✨ Welcome email process complete!');
}

// Command line execution
const productionUrl = process.argv[2] || 'https://your-app.replit.app';

console.log('ROOF-ER HR System - Welcome Email Sender');
console.log('=========================================');
console.log(`Production URL: ${productionUrl}\n`);

sendWelcomeEmails(productionUrl)
  .then(() => {
    console.log('Process completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

export { sendWelcomeEmails };