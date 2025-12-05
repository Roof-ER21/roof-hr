import { db } from '../../db';
import { documents, users } from '../../../shared/schema';
import { eq, and, or, sql, desc, inArray, like } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface DocumentAction {
  type: 'upload_document' | 'update_document' | 'delete_document' | 'set_permissions' | 
        'expire_documents' | 'share_document' | 'archive_documents' | 'bulk_update' |
        'create_folder' | 'move_documents';
  documentId?: string;
  documentIds?: string[];
  data?: any;
}

export class SusanDocumentManager {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Upload a new document
   */
  async uploadDocument(data: {
    name: string;
    type: string;
    category: string;
    employeeId?: string;
    departmentId?: string;
    fileUrl: string;
    expiryDate?: Date;
    metadata?: any;
  }): Promise<{ success: boolean; documentId?: string; error?: string }> {
    try {
      const documentId = uuidv4();
      
      await db.insert(documents).values({
        id: documentId,
        name: data.name,
        type: data.type,
        category: data.category,
        employeeId: data.employeeId || null,
        departmentId: data.departmentId || null,
        fileUrl: data.fileUrl,
        version: 1,
        expiryDate: data.expiryDate || null,
        metadata: data.metadata || {},
        status: 'ACTIVE',
        uploadedBy: 'susan-ai',
        uploadedAt: new Date(),
        lastModified: new Date()
      });

      console.log(`[SUSAN-DOCUMENTS] Uploaded document: ${data.name} (${documentId})`);
      return { success: true, documentId };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error uploading document:', error);
      return { success: false, error: 'Failed to upload document' };
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    updates: Partial<{
      name: string;
      category: string;
      expiryDate: Date;
      status: string;
      metadata: any;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Increment version if content changed
      const versionUpdate = updates.name || updates.category ? 
        { version: sql`${documents.version} + 1` } : {};

      await db.update(documents)
        .set({
          ...updates,
          ...versionUpdate,
          lastModified: new Date()
        })
        .where(eq(documents.id, documentId));

      console.log(`[SUSAN-DOCUMENTS] Updated document ${documentId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error updating document:', error);
      return { success: false, error: 'Failed to update document' };
    }
  }

  /**
   * Set document permissions (placeholder)
   */
  async setDocumentPermissions(
    documentId: string,
    permissions: {
      userIds?: string[];
      departmentIds?: string[];
      roleIds?: string[];
      accessLevel: 'VIEW' | 'EDIT' | 'DELETE';
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // In a real system, this would update a permissions table
      // For now, we just log the permission change
      console.log(`[SUSAN-DOCUMENTS] Set permissions for document ${documentId}:`, permissions);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error setting permissions:', error);
      return { success: false, error: 'Failed to set permissions' };
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(
    documentId: string,
    permanent: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (permanent) {
        await db.delete(documents)
          .where(eq(documents.id, documentId));
        console.log(`[SUSAN-DOCUMENTS] Permanently deleted document ${documentId}`);
      } else {
        await db.update(documents)
          .set({
            status: 'DELETED',
            lastModified: new Date()
          })
          .where(eq(documents.id, documentId));
        console.log(`[SUSAN-DOCUMENTS] Soft deleted document ${documentId}`);
      }

      return { success: true };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error deleting document:', error);
      return { success: false, error: 'Failed to delete document' };
    }
  }

  /**
   * Expire old documents
   */
  async expireDocuments(): Promise<{ success: boolean; expiredCount?: number; error?: string }> {
    try {
      const today = new Date();
      
      const result = await db.update(documents)
        .set({
          status: 'EXPIRED',
          lastModified: new Date()
        })
        .where(and(
          sql`${documents.expiryDate} < ${today}`,
          eq(documents.status, 'ACTIVE')
        ));

      console.log(`[SUSAN-DOCUMENTS] Expired documents`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error expiring documents:', error);
      return { success: false, error: 'Failed to expire documents' };
    }
  }

  /**
   * Archive old documents
   */
  async archiveDocuments(
    olderThanDays: number = 365
  ): Promise<{ success: boolean; archivedCount?: number; error?: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db.update(documents)
        .set({
          status: 'ARCHIVED',
          lastModified: new Date()
        })
        .where(and(
          sql`${documents.lastModified} < ${cutoffDate}`,
          eq(documents.status, 'ACTIVE')
        ));

      console.log(`[SUSAN-DOCUMENTS] Archived old documents`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error archiving documents:', error);
      return { success: false, error: 'Failed to archive documents' };
    }
  }

  /**
   * Share document with users
   */
  async shareDocument(
    documentId: string,
    userEmails: string[]
  ): Promise<{ success: boolean; sharedCount?: number; error?: string }> {
    try {
      // Get user IDs from emails
      const usersData = await db.select()
        .from(users)
        .where(inArray(users.email, userEmails));

      const userIds = usersData.map(u => u.id);

      if (userIds.length > 0) {
        await this.setDocumentPermissions(documentId, {
          userIds,
          accessLevel: 'VIEW'
        });
      }

      console.log(`[SUSAN-DOCUMENTS] Shared document ${documentId} with ${userIds.length} users`);
      return { success: true, sharedCount: userIds.length };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error sharing document:', error);
      return { success: false, error: 'Failed to share document' };
    }
  }

  /**
   * Bulk update documents
   */
  async bulkUpdateDocuments(
    documentIds: string[],
    updates: Partial<{
      category: string;
      status: string;
      expiryDate: Date;
    }>
  ): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
    try {
      await db.update(documents)
        .set({
          ...updates,
          lastModified: new Date()
        })
        .where(inArray(documents.id, documentIds));

      console.log(`[SUSAN-DOCUMENTS] Bulk updated ${documentIds.length} documents`);
      return { success: true, updatedCount: documentIds.length };
    } catch (error) {
      console.error('[SUSAN-DOCUMENTS] Error in bulk update:', error);
      return { success: false, error: 'Failed to bulk update documents' };
    }
  }

  /**
   * Parse natural language command
   */
  parseCommand(command: string): DocumentAction | null {
    const lowerCommand = command.toLowerCase();

    // Upload document
    if (lowerCommand.includes('upload') || lowerCommand.includes('add document')) {
      const nameMatch = command.match(/(?:called|named|document)\s+([^,]+)/i);
      return {
        type: 'upload_document',
        data: {
          name: nameMatch?.[1]?.trim() || 'New Document',
          type: 'GENERAL',
          category: 'HR'
        }
      };
    }

    // Delete document
    if (lowerCommand.includes('delete') || lowerCommand.includes('remove')) {
      const permanent = lowerCommand.includes('permanently') || lowerCommand.includes('forever');
      return {
        type: 'delete_document',
        data: { permanent }
      };
    }

    // Set permissions
    if (lowerCommand.includes('permission') || lowerCommand.includes('access')) {
      const levelMatch = lowerCommand.includes('edit') ? 'EDIT' : 
                        lowerCommand.includes('delete') ? 'DELETE' : 'VIEW';
      return {
        type: 'set_permissions',
        data: { accessLevel: levelMatch }
      };
    }

    // Share document
    if (lowerCommand.includes('share')) {
      const emailMatches = command.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/gi);
      if (emailMatches) {
        return {
          type: 'share_document',
          data: { emails: emailMatches }
        };
      }
    }

    // Expire documents
    if (lowerCommand.includes('expire')) {
      return { type: 'expire_documents' };
    }

    // Archive documents
    if (lowerCommand.includes('archive')) {
      const daysMatch = command.match(/(\d+)\s*days?/i);
      return {
        type: 'archive_documents',
        data: { days: daysMatch ? parseInt(daysMatch[1]) : 365 }
      };
    }

    return null;
  }
}