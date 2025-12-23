import { google } from 'googleapis';
import { googleAuthService } from './google-auth';
import { serviceAccountAuth } from './service-account-auth';

class GmailService {
  private gmail: any;
  private systemGmail: any; // For system emails

  async initialize() {
    try {
      await googleAuthService.initialize();
      
      // Use service account authentication
      const auth = googleAuthService.getAuthClient();
      this.systemGmail = google.gmail({ version: 'v1', auth });
      
      // Default gmail instance will be set per user request
      this.gmail = this.systemGmail;
      console.log('[Gmail] Service initialized with service account');
    } catch (error) {
      console.error('[Gmail] Failed to initialize:', error);
      throw error;
    }
  }

  private async getAccessToken() {
    try {
      const auth = googleAuthService.getAuthClient();
      // This will automatically refresh the token if expired
      const { credentials } = await auth.refreshAccessToken();
      return credentials.access_token;
    } catch (error) {
      console.error('[Gmail] Error refreshing access token:', error);
      // If refresh fails, try to get the current token
      try {
        const auth = googleAuthService.getAuthClient();
        const { token } = await auth.getAccessToken();
        return token;
      } catch (fallbackError) {
        console.error('[Gmail] Fallback token retrieval failed:', fallbackError);
        throw new Error('Unable to obtain Gmail access token. Please check GOOGLE_REFRESH_TOKEN environment variable.');
      }
    }
  }

  async sendEmail(options: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: any[];
    from?: string;
    userEmail?: string; // Email of the user sending this (for impersonation)
  }) {
    try {
      let gmailService = this.systemGmail;
      let fromEmail = options.from || '"ROOF-ER HR System" <admin@theroofdocs.com>';
      
      // If userEmail is provided and service account is configured, use impersonation
      if (options.userEmail && serviceAccountAuth.isConfigured()) {
        try {
          gmailService = await serviceAccountAuth.getGmailForUser(options.userEmail);
          // When impersonating, use the user's email as the from address
          fromEmail = options.userEmail;
        } catch (error) {
          console.warn('[Gmail] Failed to impersonate user, falling back to system account:', error);
        }
      }
      
      // Build the email message
      const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
      const messageParts = [
        `From: ${fromEmail}`,
        `To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
        options.cc ? `Cc: ${Array.isArray(options.cc) ? options.cc.join(', ') : options.cc}` : '',
        options.bcc ? `Bcc: ${Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc}` : '',
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        options.html || options.text || ''
      ].filter(Boolean).join('\n');

      const encodedMessage = Buffer.from(messageParts)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send using Gmail API
      const result = await gmailService.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log('[Gmail] Email sent successfully via API:', result.data.id);
      return { success: true, messageId: result.data.id };
    } catch (error) {
      console.error('[Gmail] Error sending email:', error);
      throw error;
    }
  }

  async getEmails(query: string = 'is:unread', maxResults: number = 10) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });

      const messages = response.data.messages || [];
      const emails = [];

      for (const message of messages) {
        const email = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });
        emails.push(email.data);
      }

      return emails;
    } catch (error) {
      console.error('[Gmail] Error fetching emails:', error);
      throw error;
    }
  }

  async createDraft(options: {
    to: string;
    subject: string;
    body: string;
  }) {
    try {
      const message = [
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        '',
        options.body
      ].join('\n');

      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      const draft = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage
          }
        }
      });

      return draft.data;
    } catch (error) {
      console.error('[Gmail] Error creating draft:', error);
      throw error;
    }
  }

  async getLabels() {
    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me'
      });
      return response.data.labels;
    } catch (error) {
      console.error('[Gmail] Error fetching labels:', error);
      throw error;
    }
  }

  /**
   * Check if the Gmail service is configured and ready to send emails
   */
  isConfigured(): boolean {
    return serviceAccountAuth.isConfigured();
  }
}

export const gmailService = new GmailService();