import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

class GoogleAuthService {
  private serviceAccountKey: any;
  private jwtClient: JWT | null = null;
  private isInitialized = false;
  private userEmail: string;

  constructor() {
    // Parse the service account key from environment variable
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (keyString) {
      try {
        this.serviceAccountKey = JSON.parse(keyString);
      } catch (error) {
        console.error('[GoogleAuth] Failed to parse service account key:', error);
      }
    }

    // The email to impersonate for all operations
    this.userEmail = process.env.GOOGLE_USER_EMAIL || 'info@theroofdocs.com';
  }

  async initialize() {
    if (this.isInitialized) return;

    if (!this.serviceAccountKey) {
      throw new Error('Google service account key not configured');
    }

    try {
      // Create JWT client with domain-wide delegation
      this.jwtClient = new google.auth.JWT({
        email: this.serviceAccountKey.client_email,
        key: this.serviceAccountKey.private_key,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify'
        ],
        subject: this.userEmail // Impersonate this user for all operations
      });

      // Authorize the client
      await this.jwtClient.authorize();
      
      this.isInitialized = true;
      console.log(`[GoogleAuth] Service account initialized, impersonating: ${this.userEmail}`);
    } catch (error) {
      console.error('[GoogleAuth] Failed to initialize service account:', error);
      throw error;
    }
  }

  getAuthClient(): JWT {
    if (!this.isInitialized || !this.jwtClient) {
      throw new Error('Google Auth Service not initialized');
    }
    return this.jwtClient;
  }

  async refreshAccessToken() {
    if (!this.jwtClient) {
      throw new Error('JWT client not initialized');
    }
    
    try {
      await this.jwtClient.authorize();
      console.log('[GoogleAuth] Access token refreshed');
    } catch (error) {
      console.error('[GoogleAuth] Error refreshing access token:', error);
      throw new Error('Failed to refresh Google access token');
    }
  }

  // Get service-specific auth client (for compatibility)
  async getServiceAuth(serviceName: string) {
    if (!this.jwtClient) {
      await this.initialize();
    }
    await this.refreshAccessToken();
    return this.jwtClient;
  }

  // Check if service account is properly configured
  isConfigured(): boolean {
    return !!this.serviceAccountKey;
  }

  // Get the service account email
  getServiceAccountEmail(): string | null {
    return this.serviceAccountKey?.client_email || null;
  }

  // Get the user email being impersonated
  getImpersonatedEmail(): string {
    return this.userEmail;
  }
}

export const googleAuthService = new GoogleAuthService();