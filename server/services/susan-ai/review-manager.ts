import { db } from '../../db';
import { users, employeeReviews } from '../../../shared/schema';
import { eq, and, sql, lte } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface ReviewAction {
  type: 'create_review' | 'update_review' | 'submit_review' | 'bulk_create' |
        'send_reminders' | 'generate_reports' | 'schedule_reviews';
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
    revieweeId: string;
    reviewerId: string;
    reviewType: 'ANNUAL' | 'QUARTERLY' | 'PROBATION' | 'PROJECT' | 'IMPROVEMENT';
    reviewPeriod: string;
    dueDate: Date;
  }): Promise<{ success: boolean; reviewId?: string; error?: string }> {
    try {
      const reviewId = uuidv4();

      await db.insert(employeeReviews).values({
        id: reviewId,
        revieweeId: data.revieweeId,
        reviewerId: data.reviewerId,
        reviewType: data.reviewType,
        reviewPeriod: data.reviewPeriod,
        status: 'DRAFT',
        dueDate: data.dueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`[SUSAN-REVIEWS] Created review: ${reviewId} for reviewee ${data.revieweeId}`);
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
      overallRating: number;
      performanceScore: number;
      teamworkScore: number;
      communicationScore: number;
      technicalScore: number;
      strengths: string;
      areasForImprovement: string;
      goals: string;
      comments: string;
      status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACKNOWLEDGED';
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeReviews)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(employeeReviews.id, reviewId));

      console.log(`[SUSAN-REVIEWS] Updated review ${reviewId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error updating review:', error);
      return { success: false, error: 'Failed to update review' };
    }
  }

  /**
   * Submit a review
   */
  async submitReview(
    reviewId: string,
    finalData: {
      overallRating: number;
      performanceScore?: number;
      teamworkScore?: number;
      communicationScore?: number;
      technicalScore?: number;
      strengths?: string;
      areasForImprovement?: string;
      goals?: string;
      comments?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeReviews)
        .set({
          ...finalData,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(employeeReviews.id, reviewId));

      // Send notification to reviewee
      await this.sendReviewNotification(reviewId, 'submitted');

      console.log(`[SUSAN-REVIEWS] Submitted review ${reviewId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error submitting review:', error);
      return { success: false, error: 'Failed to submit review' };
    }
  }

  /**
   * Acknowledge a review (by the reviewee)
   */
  async acknowledgeReview(
    reviewId: string,
    revieweeComments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(employeeReviews)
        .set({
          status: 'ACKNOWLEDGED',
          revieweeComments: revieweeComments || null,
          acknowledgedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(employeeReviews.id, reviewId));

      console.log(`[SUSAN-REVIEWS] Acknowledged review ${reviewId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error acknowledging review:', error);
      return { success: false, error: 'Failed to acknowledge review' };
    }
  }

  /**
   * Bulk create reviews for multiple employees
   */
  async bulkCreateReviews(
    revieweeIds: string[],
    reviewData: {
      reviewType: 'ANNUAL' | 'QUARTERLY' | 'PROBATION' | 'PROJECT' | 'IMPROVEMENT';
      reviewPeriod: string;
      dueDate: Date;
      reviewerId?: string;
    }
  ): Promise<{ success: boolean; createdCount?: number; error?: string }> {
    try {
      const reviews = revieweeIds.map((revieweeId) => ({
        id: uuidv4(),
        revieweeId,
        reviewerId: reviewData.reviewerId || 'auto-assigned',
        reviewType: reviewData.reviewType,
        reviewPeriod: reviewData.reviewPeriod,
        status: 'DRAFT' as const,
        dueDate: reviewData.dueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await db.insert(employeeReviews).values(reviews);

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
        .from(employeeReviews)
        .where(and(
          eq(employeeReviews.status, 'DRAFT'),
          lte(employeeReviews.dueDate, reminderDate)
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
    reviewPeriod: string
  ): Promise<{ success: boolean; report?: any; error?: string }> {
    try {
      const reviews = await db.select()
        .from(employeeReviews)
        .where(eq(employeeReviews.reviewPeriod, reviewPeriod));

      const submittedReviews = reviews.filter((r) => r.status === 'SUBMITTED' || r.status === 'ACKNOWLEDGED');
      const ratingsSum = submittedReviews.reduce((sum, r) => sum + (r.overallRating || 0), 0);

      const report = {
        reviewPeriod,
        totalReviews: reviews.length,
        submittedCount: submittedReviews.length,
        averageRating: submittedReviews.length > 0 ? ratingsSum / submittedReviews.length : 0,
        completionRate: reviews.length > 0 ? (submittedReviews.length / reviews.length) * 100 : 0,
        byStatus: {
          draft: reviews.filter((r) => r.status === 'DRAFT').length,
          inProgress: reviews.filter((r) => r.status === 'IN_PROGRESS').length,
          submitted: reviews.filter((r) => r.status === 'SUBMITTED').length,
          acknowledged: reviews.filter((r) => r.status === 'ACKNOWLEDGED').length
        },
        byRating: {
          excellent: submittedReviews.filter((r) => r.overallRating && r.overallRating >= 5).length,
          good: submittedReviews.filter((r) => r.overallRating && r.overallRating >= 4 && r.overallRating < 5).length,
          average: submittedReviews.filter((r) => r.overallRating && r.overallRating >= 3 && r.overallRating < 4).length,
          needsImprovement: submittedReviews.filter((r) => r.overallRating && r.overallRating < 3).length
        },
        generatedAt: new Date()
      };

      console.log(`[SUSAN-REVIEWS] Generated report for period ${reviewPeriod}`);
      return { success: true, report };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error generating report:', error);
      return { success: false, error: 'Failed to generate report' };
    }
  }

  /**
   * Schedule automated reviews for all active employees
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

      const reviews: Array<{
        id: string;
        revieweeId: string;
        reviewerId: string;
        reviewType: 'QUARTERLY' | 'ANNUAL';
        reviewPeriod: string;
        status: 'DRAFT';
        dueDate: Date;
        createdAt: Date;
        updatedAt: Date;
      }> = [];

      const dueDate = new Date(startDate);

      if (frequency === 'QUARTERLY') {
        dueDate.setMonth(dueDate.getMonth() + 3);
      } else {
        dueDate.setFullYear(dueDate.getFullYear() + 1);
      }

      for (const employee of employees) {
        reviews.push({
          id: uuidv4(),
          revieweeId: employee.id,
          reviewerId: employee.primaryManagerId || 'auto-assigned',
          reviewType: frequency,
          reviewPeriod: `${startDate.getFullYear()}-${frequency}`,
          status: 'DRAFT',
          dueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (reviews.length > 0) {
        await db.insert(employeeReviews).values(reviews);
      }

      console.log(`[SUSAN-REVIEWS] Scheduled ${reviews.length} ${frequency} reviews`);
      return { success: true, scheduledCount: reviews.length };
    } catch (error) {
      console.error('[SUSAN-REVIEWS] Error scheduling reviews:', error);
      return { success: false, error: 'Failed to schedule reviews' };
    }
  }

  /**
   * Send review notification
   */
  private async sendReviewNotification(
    reviewId: string,
    type: 'assigned' | 'reminder' | 'submitted'
  ): Promise<void> {
    try {
      const [review] = await db.select()
        .from(employeeReviews)
        .where(eq(employeeReviews.id, reviewId))
        .limit(1);

      if (!review) return;

      const [reviewer] = await db.select()
        .from(users)
        .where(eq(users.id, review.reviewerId))
        .limit(1);

      const [reviewee] = await db.select()
        .from(users)
        .where(eq(users.id, review.revieweeId))
        .limit(1);

      if (!reviewer || !reviewee) return;

      let subject = '';
      let html = '';

      const revieweeName = `${reviewee.firstName} ${reviewee.lastName}`;
      const reviewerName = `${reviewer.firstName} ${reviewer.lastName}`;

      switch (type) {
        case 'assigned':
          subject = `New Performance Review Assigned - ${revieweeName}`;
          html = `
            <p>Dear ${reviewerName},</p>
            <p>You have been assigned to complete a performance review for ${revieweeName}.</p>
            <p>Due Date: ${review.dueDate}</p>
            <p>Please log in to complete the review.</p>
            <p>Best regards,<br>HR Team</p>
          `;
          break;
        case 'reminder':
          subject = `Reminder: Performance Review Due - ${revieweeName}`;
          html = `
            <p>Dear ${reviewerName},</p>
            <p>This is a reminder that the performance review for ${revieweeName} is due on ${review.dueDate}.</p>
            <p>Please complete it as soon as possible.</p>
            <p>Best regards,<br>HR Team</p>
          `;
          break;
        case 'submitted':
          subject = `Performance Review Submitted`;
          html = `
            <p>Dear ${revieweeName},</p>
            <p>Your performance review has been submitted.</p>
            ${review.overallRating ? `<p>Overall Rating: ${review.overallRating}/5</p>` : ''}
            <p>Please log in to view and acknowledge your review.</p>
            <p>Best regards,<br>HR Team</p>
          `;
          break;
      }

      const recipient = type === 'submitted' ? reviewee.email : reviewer.email;

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
                       lowerCommand.includes('probation') ? 'PROBATION' :
                       lowerCommand.includes('improvement') ? 'IMPROVEMENT' : 'PROJECT';

      return {
        type: 'create_review',
        data: {
          reviewType: typeMatch,
          reviewPeriod: new Date().getFullYear().toString()
        }
      };
    }

    // Submit review
    if (lowerCommand.includes('submit review') || lowerCommand.includes('complete review') || lowerCommand.includes('finish review')) {
      const ratingMatch = command.match(/rating\s+(\d+)/i);
      return {
        type: 'submit_review',
        data: {
          overallRating: ratingMatch ? parseInt(ratingMatch[1]) : 4
        }
      };
    }

    // Bulk create
    if (lowerCommand.includes('create reviews for all') || lowerCommand.includes('bulk review')) {
      return {
        type: 'bulk_create',
        data: {
          reviewType: 'ANNUAL',
          reviewPeriod: new Date().getFullYear().toString()
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
        data: { reviewPeriod: new Date().getFullYear().toString() }
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
