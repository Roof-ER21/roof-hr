import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

class ServiceAccountAuth {
  private serviceAccountKey: any;
  private jwtClients: Map<string, JWT> = new Map();

  constructor() {
    // Parse the service account key from environment variable
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (keyString) {
      try {
        this.serviceAccountKey = JSON.parse(keyString);
      } catch (error) {
        console.error('[ServiceAccount] Failed to parse service account key:', error);
      }
    }
  }

  /**
   * Get a JWT client that impersonates a specific user
   * @param userEmail The email of the user to impersonate
   * @param scopes The OAuth scopes needed
   */
  getImpersonatedClient(userEmail: string, scopes: string[]): JWT {
    // Check if we already have a client for this user
    const cacheKey = `${userEmail}:${scopes.join(',')}`;
    
    if (this.jwtClients.has(cacheKey)) {
      return this.jwtClients.get(cacheKey)!;
    }

    if (!this.serviceAccountKey) {
      throw new Error('Service account key not configured');
    }

    // Create a new JWT client that impersonates the user
    const jwtClient = new google.auth.JWT({
      email: this.serviceAccountKey.client_email,
      key: this.serviceAccountKey.private_key,
      scopes: scopes,
      subject: userEmail // This is the key - impersonate this user
    });

    // Cache the client
    this.jwtClients.set(cacheKey, jwtClient);
    
    return jwtClient;
  }

  /**
   * Get Gmail service for a specific user
   */
  async getGmailForUser(userEmail: string) {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    
    const auth = this.getImpersonatedClient(userEmail, scopes);
    await auth.authorize();
    
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Get Calendar service for a specific user
   */
  async getCalendarForUser(userEmail: string) {
    console.log(`[ServiceAccount] Getting calendar for user: ${userEmail}`);

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const auth = this.getImpersonatedClient(userEmail, scopes);

    try {
      await auth.authorize();
      console.log(`[ServiceAccount] ✅ Successfully authorized impersonation for: ${userEmail}`);
    } catch (error: any) {
      console.error(`[ServiceAccount] ❌ Failed to authorize impersonation for ${userEmail}:`, {
        message: error.message,
        code: error.code,
        status: error.status
      });
      throw error;
    }

    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Get Drive service for a specific user
   */
  async getDriveForUser(userEmail: string) {
    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ];
    
    const auth = this.getImpersonatedClient(userEmail, scopes);
    await auth.authorize();
    
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Get Sheets service for a specific user
   */
  async getSheetsForUser(userEmail: string) {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets'
    ];
    
    const auth = this.getImpersonatedClient(userEmail, scopes);
    await auth.authorize();
    
    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Get Docs service for a specific user
   */
  async getDocsForUser(userEmail: string) {
    const scopes = [
      'https://www.googleapis.com/auth/documents'
    ];
    
    const auth = this.getImpersonatedClient(userEmail, scopes);
    await auth.authorize();
    
    return google.docs({ version: 'v1', auth });
  }

  /**
   * Test if service account is properly configured
   */
  isConfigured(): boolean {
    return !!this.serviceAccountKey;
  }

  /**
   * Get the service account email
   */
  getServiceAccountEmail(): string | null {
    return this.serviceAccountKey?.client_email || null;
  }
}

export const serviceAccountAuth = new ServiceAccountAuth();