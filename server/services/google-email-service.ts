import { google } from 'googleapis';
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

class GoogleEmailService {
  private transporter: nodemailer.Transporter | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const userEmail = process.env.GOOGLE_USER_EMAIL;

    if (!clientId || !clientSecret || !refreshToken || !userEmail) {
      console.warn('Google OAuth credentials not configured. Email sending disabled.');
      return;
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const accessToken = await oauth2Client.getAccessToken();

      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userEmail,
          clientId: clientId,
          clientSecret: clientSecret,
          refreshToken: refreshToken,
          accessToken: accessToken.token as string
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      console.log('Google Email Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Email Service:', error);
      // Fall back to SendGrid if available
      this.initializeSendGrid();
    }
  }

  private initializeSendGrid() {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (sendgridApiKey) {
      // SendGrid is already configured in email-service.ts
      console.log('Falling back to SendGrid for email delivery');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      console.error('Email service not available');
      return false;
    }

    try {
      const mailOptions = {
        from: options.from || process.env.GOOGLE_USER_EMAIL,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendTemplateEmail(
    to: string,
    subject: string,
    body: string,
    variables: Record<string, string> = {}
  ): Promise<boolean> {
    // Replace variables in subject and body
    let processedSubject = subject;
    let processedBody = body;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedSubject = processedSubject.replace(regex, value);
      processedBody = processedBody.replace(regex, value);
    });

    return this.sendEmail({
      to,
      subject: processedSubject,
      html: processedBody
    });
  }
}

export const googleEmailService = new GoogleEmailService();