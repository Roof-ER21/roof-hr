import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../middleware/logger';

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  private isInitialized: boolean = false;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URL || 'http://localhost:5000/api/auth/google/callback'
    );

    // Set credentials if refresh token is available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      this.isInitialized = true;
    }
  }

  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async setTokens(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      this.isInitialized = true;
      
      // Store refresh token for future use
      if (tokens.refresh_token) {
        logger.info('Gmail OAuth2 tokens obtained. Add this to your .env file:');
        logger.info(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      }
      
      return tokens;
    } catch (error) {
      logger.error('Failed to get Gmail tokens:', error);
      throw error;
    }
  }

  private createMessage(options: EmailOptions): string {
    const message = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      options.html || options.body.replace(/\n/g, '<br>')
    ].join('\n');

    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  async sendEmail(options: EmailOptions) {
    if (!this.isInitialized) {
      throw new Error('Gmail service not initialized. Please authenticate first.');
    }

    try {
      const message = this.createMessage(options);
      
      const result = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      logger.info(`Email sent successfully via Gmail to: ${options.to}`);
      return result.data;
    } catch (error) {
      logger.error('Failed to send email via Gmail:', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }
}

export const gmailService = new GmailService();
