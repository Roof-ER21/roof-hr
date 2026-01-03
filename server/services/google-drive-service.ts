import { google } from 'googleapis';
import { googleAuthService } from './google-auth';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

class GoogleDriveService {
  private drive: any;
  private initialized = false;

  async initialize() {
    try {
      if (this.initialized) {
        return;
      }
      await googleAuthService.initialize();
      const auth = googleAuthService.getAuthClient();
      this.drive = google.drive({ version: 'v3', auth });
      this.initialized = true;
      console.log('[Google Drive] Service initialized with service account');
    } catch (error) {
      console.error('[Google Drive] Failed to initialize:', error);
      throw error;
    }
  }

  isInitialized() {
    return this.initialized;
  }

  // Check if Google Drive service can be configured (has required credentials)
  isConfigured(): boolean {
    try {
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (!serviceAccountKey) {
        return false;
      }
      // Try to parse to verify it's valid JSON
      JSON.parse(serviceAccountKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Safe initialization that doesn't throw
  async safeInitialize(): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        console.warn('[Google Drive] Service account not configured - Drive features disabled');
        return false;
      }
      await this.initialize();
      return true;
    } catch (error) {
      console.error('[Google Drive] Failed to initialize:', error);
      return false;
    }
  }

  async createFolder(name: string, parentFolderId?: string) {
    try {
      const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, webViewLink'
      });

      console.log('[Google Drive] Folder created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('[Google Drive] Error creating folder:', error);
      throw error;
    }
  }

  async createEmployeeFolder(name: string) {
    try {
      // Create employee folder in the root of Google Drive
      // In production, you might want to create it under an HR folder
      return await this.createFolder(name);
    } catch (error) {
      console.error('[Google Drive] Error creating employee folder:', error);
      throw error;
    }
  }

  async uploadFile(options: {
    name: string;
    mimeType: string;
    content: Buffer | fs.ReadStream;
    parentFolderId?: string;
    description?: string;
    shareWithDomain?: boolean; // Auto-share with organization domain
  }) {
    try {
      // Ensure service is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      const fileMetadata = {
        name: options.name,
        description: options.description,
        parents: options.parentFolderId ? [options.parentFolderId] : undefined
      };

      // Convert Buffer to Stream if needed
      let body: Readable | fs.ReadStream;
      if (Buffer.isBuffer(options.content)) {
        // Convert Buffer to Readable Stream
        body = Readable.from(options.content);
      } else {
        // Already a stream
        body = options.content;
      }

      const media = {
        mimeType: options.mimeType,
        body: body
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink, parents'
      });

      console.log('[Google Drive] File uploaded:', response.data.id);

      // Auto-share with organization domain or make viewable with link
      // Default to true to make files accessible to all employees
      if (options.shareWithDomain !== false) {
        try {
          // Share with anyone who has the link (reader access)
          await this.drive.permissions.create({
            fileId: response.data.id,
            resource: {
              type: 'anyone',
              role: 'reader'
            },
            sendNotificationEmail: false
          });
          console.log('[Google Drive] File shared with anyone with link:', response.data.id);
        } catch (shareError) {
          console.warn('[Google Drive] Failed to auto-share file (continuing):', shareError);
        }
      }

      return response.data;
    } catch (error) {
      console.error('[Google Drive] Error uploading file:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string, destPath?: string) {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      if (destPath) {
        const dest = fs.createWriteStream(destPath);
        response.data
          .on('end', () => console.log('[Google Drive] File downloaded:', fileId))
          .on('error', (err: any) => console.error('[Google Drive] Download error:', err))
          .pipe(dest);
      }

      return response.data;
    } catch (error) {
      console.error('[Google Drive] Error downloading file:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string) {
    try {
      await this.drive.files.delete({ fileId });
      console.log('[Google Drive] File deleted:', fileId);
    } catch (error) {
      console.error('[Google Drive] Error deleting file:', error);
      throw error;
    }
  }

  async listFiles(options: {
    q?: string;
    pageSize?: number;
    orderBy?: string;
    fields?: string;
  } = {}) {
    try {
      const response = await this.drive.files.list({
        q: options.q,
        pageSize: options.pageSize || 20,
        orderBy: options.orderBy || 'modifiedTime desc',
        fields: options.fields || 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, parents)'
      });

      return response.data.files;
    } catch (error) {
      console.error('[Google Drive] Error listing files:', error);
      throw error;
    }
  }

  async shareFile(fileId: string, options: {
    type: 'user' | 'group' | 'domain' | 'anyone';
    role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
    emailAddress?: string;
    domain?: string;
    sendNotificationEmail?: boolean;
  }) {
    try {
      const permission = {
        type: options.type,
        role: options.role,
        emailAddress: options.emailAddress,
        domain: options.domain
      };

      const response = await this.drive.permissions.create({
        fileId,
        resource: permission,
        sendNotificationEmail: options.sendNotificationEmail ?? true
      });

      console.log('[Google Drive] File shared:', fileId);
      return response.data;
    } catch (error) {
      console.error('[Google Drive] Error sharing file:', error);
      throw error;
    }
  }

  async getFileMetadata(fileId: string) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: '*'
      });
      return response.data;
    } catch (error) {
      console.error('[Google Drive] Error getting file metadata:', error);
      throw error;
    }
  }
  
  // Escape special characters for Google Drive API queries
  private escapeQueryString(str: string): string {
    // Escape single quotes and backslashes for Google Drive API queries
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  
  async findFolderByName(name: string, parentId?: string) {
    try {
      const escapedName = this.escapeQueryString(name);
      let query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        pageSize: 1
      });
      
      return response.data.files?.[0] || null;
    } catch (error) {
      console.error('[Google Drive] Error finding folder:', error);
      throw error;
    }
  }
  
  async searchFolders(name: string, parentId?: string) {
    try {
      const escapedName = this.escapeQueryString(name);
      let query = `name contains '${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        pageSize: 10
      });
      
      return response.data.files || [];
    } catch (error) {
      console.error('[Google Drive] Error searching folders:', error);
      throw error;
    }
  }
  
  async searchFiles(name: string, mimeType?: string) {
    try {
      const escapedName = this.escapeQueryString(name);
      let query = `name contains '${escapedName}' and trashed=false`;
      if (mimeType) {
        query += ` and mimeType='${mimeType}'`;
      }
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, webViewLink)',
        pageSize: 20
      });
      
      return response.data.files || [];
    } catch (error) {
      console.error('[Google Drive] Error searching files:', error);
      throw error;
    }
  }
  
  async moveFile(fileId: string, newParentId: string) {
    try {
      // Get current parents
      const file = await this.drive.files.get({
        fileId,
        fields: 'parents'
      });
      
      const previousParents = file.data.parents ? file.data.parents.join(',') : '';
      
      // Move the file
      const response = await this.drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id, parents'
      });
      
      console.log('[Google Drive] File moved:', fileId);
      return response.data;
    } catch (error) {
      console.error('[Google Drive] Error moving file:', error);
      throw error;
    }
  }

  // Create HR document structure in Drive
  async setupHRDocumentStructure() {
    try {
      // Create main HR folder
      const hrFolder = await this.createFolder('ROOF-ER HR Documents');
      
      // Create subfolders
      const folders = [
        'Employee Files',
        'Contracts',
        'Policies',
        'COI Documents',
        'Performance Reviews',
        'Training Materials',
        'Templates'
      ];

      const createdFolders: any = {};
      for (const folderName of folders) {
        const folder = await this.createFolder(folderName, hrFolder.id);
        createdFolders[folderName] = folder;
      }

      console.log('[Google Drive] HR document structure created');
      return { hrFolder, subfolders: createdFolders };
    } catch (error) {
      console.error('[Google Drive] Error setting up HR structure:', error);
      throw error;
    }
  }
}

export const googleDriveService = new GoogleDriveService();

// Export wrapper function for uploading files to Google Drive
export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderType?: string
) {
  try {
    // Initialize if needed
    if (!googleDriveService.isInitialized()) {
      await googleDriveService.initialize();
    }

    // Determine folder based on type
    let parentFolderId: string | undefined;
    
    if (folderType === 'recruiting') {
      // Try to find or create recruiting folder
      const allFiles = await googleDriveService.listFiles({ q: "mimeType='application/vnd.google-apps.folder'" });
      const recruitingFolder = allFiles.find((f: any) => f.name === 'Recruiting');
      
      if (recruitingFolder) {
        parentFolderId = recruitingFolder.id;
      } else {
        const newFolder = await googleDriveService.createFolder('Recruiting');
        parentFolderId = newFolder.id;
      }
    }

    // Upload the file
    const result = await googleDriveService.uploadFile({
      name: fileName,
      mimeType: mimeType,
      content: fileBuffer,
      parentFolderId: parentFolderId,
      description: 'Uploaded via HR System'
    });

    return result;
  } catch (error) {
    console.error('[uploadToGoogleDrive] Error:', error);
    throw error;
  }
}