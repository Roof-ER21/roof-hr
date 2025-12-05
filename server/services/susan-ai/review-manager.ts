import { db } from '../../db';
import { users } from '../../../shared/schema';
import { eq, and, or, sql, desc, inArray, like, gte } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface ReviewAction {
  type: 'create_review' | 'update_review' | 'complete_review' | 'bulk_create' | 
        'send_reminders' | 'generate_reports' | 'schedule_reviews' | 'archive_reviews' |
        'create_template' | 'assign_reviewer';
  reviewId?: string;
  reviewIds?: string[];
  data?: any;
}

export class SusanReviewManager {
  private emailService: EmailService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.emailService = new EmailService();
    this.storage = storage;
  }

  /**
   * Create a performance review
   */
  async createReview(data: {
    employeeId: string;
    reviewerId: string;
    reviewType: 'ANNUAL' | 'QUARTERLY' | 'PROBATION' | 'PROJECT';
    period: string;
    dueDate: Date;
    templateId?: string;
  }): Promise<{ success: boolean; reviewId?: string; error?: string }> {
    try {
      const reviewId = uuidv4();
      
      // In a real system, this would create a review record
      // For now, we just log and send notification
      console.log(`[SUSAN-REVIEWS] Creating review: ${reviewId} for employee ${data.employeeId}`);
      console.log(`[SUSAN-REVIEWS] Review details:`, data);

      // Send notification to reviewer
      await this.sendReviewNotification(data.employeeId, data.reviewerId, 'assigned');

      return { success: true, reviewId };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error creating review:', error);
      return { success: false, error: 'Failed to create review' };
    }
  }

  /**
   * Update review content
   */
  async updateReview(
    reviewId: string,
    updates: Partial<{
      rating: number;
      goals: string;
      achievements: string;
      improvements: string;
      feedback: string;
      status: string;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(performanceReviews)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(performanceReviews.id, reviewId));

      console.log(`[SUSAN-REVIEWS] Updated review ${reviewId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error updating review:', error);
      return { success: false, error: 'Failed to update review' };
    }
  }

  /**
   * Complete a review
   */
  async completeReview(
    reviewId: string,
    finalData: {
      rating: number;
      goals?: string;
      achievements?: string;
      improvements?: string;
      feedback?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(performanceReviews)
        .set({
          ...finalData,
          status: 'COMPLETED',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(performanceReviews.id, reviewId));

      // Send completion notification
      await this.sendReviewNotification(reviewId, 'completed');

      console.log(`[SUSAN-REVIEWS] Completed review ${reviewId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error completing review:', error);
      return { success: false, error: 'Failed to complete review' };
    }
  }

  /**
   * Bulk create reviews for multiple employees
   */
  async bulkCreateReviews(
    employeeIds: string[],
    reviewData: {
      reviewType: 'ANNUAL' | 'QUARTERLY' | 'PROBATION' | 'PROJECT';
      period: string;
      dueDate: Date;
      reviewerId?: string;
    }
  ): Promise<{ success: boolean; createdCount?: number; error?: string }> {
    try {
      const reviews = employeeIds.map(employeeId => ({
        id: uuidv4(),
        employeeId,
        reviewerId: reviewData.reviewerId || 'auto-assigned',
        reviewType: reviewData.reviewType,
        period: reviewData.period,
        status: 'PENDING',
        dueDate: reviewData.dueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await db.insert(performanceReviews).values(reviews);

      console.log(`[SUSAN-REVIEWS] Created ${reviews.length} reviews`);
      return { success: true, createdCount: reviews.length };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error in bulk create:', error);
      return { success: false, error: 'Failed to bulk create reviews' };
    }
  }

  /**
   * Send review reminders
   */
  async sendReviewReminders(
    daysBeforeDue: number = 7
  ): Promise<{ success: boolean; remindersSent?: number; error?: string }> {
    try {
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + daysBeforeDue);

      const pendingReviews = await db.select()
        .from(performanceReviews)
        .where(and(
          eq(performanceReviews.status, 'PENDING'),
          sql`${performanceReviews.dueDate} <= ${reminderDate}`
        ));

      for (const review of pendingReviews) {
        await this.sendReviewNotification(review.id, 'reminder');
      }

      console.log(`[SUSAN-REVIEWS] Sent ${pendingReviews.length} review reminders`);
      return { success: true, remindersSent: pendingReviews.length };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error sending reminders:', error);
      return { success: false, error: 'Failed to send reminders' };
    }
  }

  /**
   * Generate review reports
   */
  async generateReviewReports(
    period: string,
    department?: string
  ): Promise<{ success: boolean; report?: any; error?: string }> {
    try {
      const reviews = await db.select()
        .from(performanceReviews)
        .where(and(
          eq(performanceReviews.period, period),
          eq(performanceReviews.status, 'COMPLETED')
        ));

      const report = {
        period,
        totalReviews: reviews.length,
        averageRating: reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length,
        completionRate: (reviews.filter(r => r.status === 'COMPLETED').length / reviews.length) * 100,
        byRating: {
          excellent: reviews.filter(r => r.rating && r.rating >= 4.5).length,
          good: reviews.filter(r => r.rating && r.rating >= 3.5 && r.rating < 4.5).length,
          average: reviews.filter(r => r.rating && r.rating >= 2.5 && r.rating < 3.5).length,
          needsImprovement: reviews.filter(r => r.rating && r.rating < 2.5).length
        },
        generatedAt: new Date()
      };

      console.log(`[SUSAN-REVIEWS] Generated report for period ${period}`);
      return { success: true, report };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error generating report:', error);
      return { success: false, error: 'Failed to generate report' };
    }
  }

  /**
   * Schedule automated reviews
   */
  async scheduleReviews(
    frequency: 'QUARTERLY' | 'ANNUAL',
    startDate: Date
  ): Promise<{ success: boolean; scheduledCount?: number; error?: string }> {
    try {
      // Get all active employees
      const employees = await db.select()
        .from(users)
        .where(eq(users.isActive, true));

      const reviews = [];
      const dueDate = new Date(startDate);
      
      if (frequency === 'QUARTERLY') {
        dueDate.setMonth(dueDate.getMonth() + 3);
      } else {
        dueDate.setFullYear(dueDate.getFullYear() + 1);
      }

      for (const employee of employees) {
        reviews.push({
          id: uuidv4(),
          employeeId: employee.id,
          reviewerId: employee.managerId || 'auto-assigned',
          reviewType: frequency === 'QUARTERLY' ? 'QUARTERLY' : 'ANNUAL',
          period: `${startDate.getFullYear()}-${frequency}`,
          status: 'SCHEDULED',
          dueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (reviews.length > 0) {
        await db.insert(performanceReviews).values(reviews);
      }

      console.log(`[SUSAN-REVIEWS] Scheduled ${reviews.length} ${frequency} reviews`);
      return { success: true, scheduledCount: reviews.length };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error scheduling reviews:', error);
      return { success: false, error: 'Failed to schedule reviews' };
    }
  }

  /**
   * Archive old reviews
   */
  async archiveReviews(
    olderThanDays: number = 730 // 2 years
  ): Promise<{ success: boolean; archivedCount?: number; error?: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db.update(performanceReviews)
        .set({
          status: 'ARCHIVED',
          updatedAt: new Date()
        })
        .where(and(
          sql`${performanceReviews.completedAt} < ${cutoffDate}`,
          eq(performanceReviews.status, 'COMPLETED')
        ));

      console.log(`[SUSAN-REVIEWS] Archived old reviews`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error archiving reviews:', error);
      return { success: false, error: 'Failed to archive reviews' };
    }
  }

  /**
   * Send review notification
   */
  private async sendReviewNotification(
    reviewId: string,
    type: 'assigned' | 'reminder' | 'completed'
  ): Promise<void> {
    try {
      const [review] = await db.select()
        .from(performanceReviews)
        .where(eq(performanceReviews.id, reviewId))
        .limit(1);

      if (!review) return;

      const [reviewer] = await db.select()
        .from(users)
        .where(eq(users.id, review.reviewerId))
        .limit(1);

      const [employee] = await db.select()
        .from(users)
        .where(eq(users.id, review.employeeId))
        .limit(1);

      if (!reviewer || !employee) return;

      let subject = '';
      let html = '';

      switch (type) {
        case 'assigned':
          subject = `New Performance Review Assigned - ${employee.name}`;
          html = `
            <p>Dear ${reviewer.name},</p>
            <p>You have been assigned to complete a performance review for ${employee.name}.</p>
            <p>Due Date: ${review.dueDate}</p>
            <p>Please log in to complete the review.</p>
            <p>Best regards,<br>HR Team</p>
          `;
          break;
        case 'reminder':
          subject = `Reminder: Performance Review Due - ${employee.name}`;
          html = `
            <p>Dear ${reviewer.name},</p>
            <p>This is a reminder that the performance review for ${employee.name} is due on ${review.dueDate}.</p>
            <p>Please complete it as soon as possible.</p>
            <p>Best regards,<br>HR Team</p>
          `;
          break;
        case 'completed':
          subject = `Performance Review Completed`;
          html = `
            <p>Dear ${employee.name},</p>
            <p>Your performance review has been completed.</p>
            <p>Rating: ${review.rating}/5</p>
            <p>Please log in to view your full review.</p>
            <p>Best regards,<br>HR Team</p>
          `;
          break;
      }

      const recipient = type === 'completed' ? employee.email : reviewer.email;
      
      await this.emailService.sendEmail({
        to: recipient,
        subject,
        html
      });

      console.log(`[SUSAN-REVIEWS] Sent ${type} notification for review ${reviewId}`);
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error sending notification:', error);
    }
  }

  /**
   * Parse natural language command
   */
  parseCommand(command: string): ReviewAction | null {
    const lowerCommand = command.toLowerCase();

    // Create review
    if (lowerCommand.includes('create review') || lowerCommand.includes('start review')) {
      const typeMatch = lowerCommand.includes('annual') ? 'ANNUAL' :
                       lowerCommand.includes('quarterly') ? 'QUARTERLY' :
                       lowerCommand.includes('probation') ? 'PROBATION' : 'PROJECT';
      
      return {
        type: 'create_review',
        data: {
          reviewType: typeMatch,
          period: new Date().getFullYear().toString()
        }
      };
    }

    // Complete review
    if (lowerCommand.includes('complete review') || lowerCommand.includes('finish review')) {
      const ratingMatch = command.match(/rating\s+(\d+)/i);
      return {
        type: 'complete_review',
        data: {
          rating: ratingMatch ? parseInt(ratingMatch[1]) : 4
        }
      };
    }

    // Bulk create
    if (lowerCommand.includes('create reviews for all') || lowerCommand.includes('bulk review')) {
      return {
        type: 'bulk_create',
        data: {
          reviewType: 'ANNUAL',
          period: new Date().getFullYear().toString()
        }
      };
    }

    // Send reminders
    if (lowerCommand.includes('send reminder') || lowerCommand.includes('review reminder')) {
      return { type: 'send_reminders' };
    }

    // Generate reports
    if (lowerCommand.includes('generate report') || lowerCommand.includes('review report')) {
      return {
        type: 'generate_reports',
        data: { period: new Date().getFullYear().toString() }
      };
    }

    // Schedule reviews
    if (lowerCommand.includes('schedule') && lowerCommand.includes('review')) {
      const frequency = lowerCommand.includes('quarterly') ? 'QUARTERLY' : 'ANNUAL';
      return {
        type: 'schedule_reviews',
        data: { frequency }
      };
    }

    return null;
  }
}