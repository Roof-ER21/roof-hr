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
    originalName: string;
    type: 'PDF' | 'DOC' | 'DOCX' | 'XLS' | 'XLSX' | 'TXT' | 'IMAGE' | 'OTHER';
    category: 'POLICY' | 'FORM' | 'HANDBOOK' | 'PROCEDURE' | 'TEMPLATE' | 'LEGAL' | 'TRAINING' | 'OTHER';
    fileUrl: string;
    fileSize: number;
    description?: string;
    expiresAt?: Date;
    tags?: string[];
  }): Promise<{ success: boolean; documentId?: string; error?: string }> {
    try {
      const documentId = uuidv4();

      await db.insert(documents).values({
        id: documentId,
        name: data.name,
        originalName: data.originalName,
        description: data.description || null,
        type: data.type,
        category: data.category,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        version: '1.0',
        expiresAt: data.expiresAt || null,
        tags: data.tags || null,
        status: 'DRAFT',
        visibility: 'EMPLOYEE',
        createdBy: 'susan-ai'
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
      description: string;
      category: 'POLICY' | 'FORM' | 'HANDBOOK' | 'PROCEDURE' | 'TEMPLATE' | 'LEGAL' | 'TRAINING' | 'OTHER';
      expiresAt: Date;
      status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
      visibility: 'PUBLIC' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
      tags: string[];
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(documents)
        .set({
          ...updates,
          updatedAt: new Date()
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
            status: 'ARCHIVED',
            updatedAt: new Date()
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

      await db.update(documents)
        .set({
          status: 'ARCHIVED',
          updatedAt: new Date()
        })
        .where(and(
          sql`${documents.expiresAt} < ${today}`,
          or(
            eq(documents.status, 'DRAFT'),
            eq(documents.status, 'REVIEW'),
            eq(documents.status, 'APPROVED')
          )
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

      await db.update(documents)
        .set({
          status: 'ARCHIVED',
          updatedAt: new Date()
        })
        .where(and(
          sql`${documents.updatedAt} < ${cutoffDate}`,
          or(
            eq(documents.status, 'DRAFT'),
            eq(documents.status, 'REVIEW'),
            eq(documents.status, 'APPROVED')
          )
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
      category: 'POLICY' | 'FORM' | 'HANDBOOK' | 'PROCEDURE' | 'TEMPLATE' | 'LEGAL' | 'TRAINING' | 'OTHER';
      status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
      expiresAt: Date;
      visibility: 'PUBLIC' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
      tags: string[];
    }>
  ): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
    try {
      await db.update(documents)
        .set({
          ...updates,
          updatedAt: new Date()
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
          originalName: nameMatch?.[1]?.trim() || 'New Document',
          type: 'OTHER',
          category: 'OTHER',
          fileSize: 0
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