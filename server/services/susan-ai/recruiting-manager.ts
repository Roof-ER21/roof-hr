import { db } from '../../db';
import { candidates, users } from '../../../shared/schema';
import { eq, and, or, sql, desc, inArray, like } from 'drizzle-orm';
import { EmailService } from '../../email-service';
import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '../../storage';

export interface RecruitingAction {
  type: 'create_candidate' | 'update_candidate' | 'move_stage' | 'bulk_move' | 
        'bulk_email' | 'schedule_interview' | 'reject_candidates' | 'archive_candidates' |
        'add_note' | 'assign_recruiter' | 'import_candidates';
  candidateId?: string;
  candidateIds?: string[];
  data?: any;
}

export class SusanRecruitingManager {
  private emailService: EmailService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.emailService = new EmailService();
    this.storage = storage;
  }

  /**
   * Create a new candidate
   */
  async createCandidate(data: {
    name: string;
    email: string;
    phone?: string;
    position: string;
    department?: string;
    status?: string;
    source?: string;
    resumeUrl?: string;
    linkedinUrl?: string;
    notes?: string;
  }): Promise<{ success: boolean; candidateId?: string; error?: string }> {
    try {
      const candidateId = uuidv4();
      
      await db.insert(candidates).values({
        id: candidateId,
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        position: data.position,
        department: data.department || 'Engineering',
        status: data.status || 'NEW',
        source: data.source || 'Direct',
        resumeUrl: data.resumeUrl || '',
        linkedinUrl: data.linkedinUrl || '',
        notes: data.notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`[SUSAN-RECRUITING] Created candidate: ${data.name} (${candidateId})`);
      
      // Send welcome email to candidate
      if (data.email) {
        await this.sendCandidateEmail(candidateId, 'welcome');
      }

      return { success: true, candidateId };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error creating candidate:', error);
      return { success: false, error: 'Failed to create candidate' };
    }
  }

  /**
   * Update candidate information
   */
  async updateCandidate(
    candidateId: string,
    updates: Partial<{
      name: string;
      email: string;
      phone: string;
      position: string;
      department: string;
      status: string;
      resumeUrl: string;
      linkedinUrl: string;
      notes: string;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(candidates)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(candidates.id, candidateId));

      console.log(`[SUSAN-RECRUITING] Updated candidate ${candidateId}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error updating candidate:', error);
      return { success: false, error: 'Failed to update candidate' };
    }
  }

  /**
   * Move candidate to a different stage
   */
  async moveCandidateStage(
    candidateId: string,
    newStage: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const validStages = ['NEW', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN', 'DEAD_BY_US'];

      if (!validStages.includes(newStage.toUpperCase())) {
        return { success: false, error: `Invalid stage. Must be one of: ${validStages.join(', ')}` };
      }

      await db.update(candidates)
        .set({
          status: newStage.toUpperCase(),
          updatedAt: new Date()
        })
        .where(eq(candidates.id, candidateId));

      // Send appropriate email based on stage
      if (newStage === 'INTERVIEW') {
        await this.sendCandidateEmail(candidateId, 'interview_scheduled');
      } else if (newStage === 'OFFER') {
        await this.sendCandidateEmail(candidateId, 'offer');
      } else if (newStage === 'REJECTED') {
        await this.sendCandidateEmail(candidateId, 'rejection');
      }

      console.log(`[SUSAN-RECRUITING] Moved candidate ${candidateId} to ${newStage}`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error moving candidate stage:', error);
      return { success: false, error: 'Failed to move candidate' };
    }
  }

  /**
   * Bulk move candidates to a stage
   */
  async bulkMoveCandidates(
    candidateIds: string[],
    newStage: string
  ): Promise<{ success: boolean; movedCount?: number; error?: string }> {
    try {
      let movedCount = 0;
      
      for (const candidateId of candidateIds) {
        const result = await this.moveCandidateStage(candidateId, newStage);
        if (result.success) movedCount++;
      }

      console.log(`[SUSAN-RECRUITING] Bulk moved ${movedCount} candidates to ${newStage}`);
      return { success: true, movedCount };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error in bulk move:', error);
      return { success: false, error: 'Failed to bulk move candidates' };
    }
  }

  /**
   * Schedule interview for a candidate
   */
  async scheduleInterview(
    candidateId: string,
    interviewData: {
      date: Date;
      time: string;
      interviewerIds: string[];
      type: 'PHONE' | 'VIDEO' | 'ONSITE' | 'IN_PERSON';
      location?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; interviewId?: string; error?: string }> {
    try {
      // Parse time and combine with date
      const [hours, minutes] = interviewData.time.split(':').map(s => parseInt(s));
      const scheduledDate = new Date(interviewData.date);
      scheduledDate.setHours(hours || 10, minutes || 0, 0, 0);
      
      // Map type if needed
      const interviewType = interviewData.type === 'ONSITE' ? 'IN_PERSON' : interviewData.type;
      
      // Create actual interview record in database
      const interview = await this.storage.createInterview({
        candidateId,
        interviewerId: interviewData.interviewerIds[0], // Primary interviewer
        scheduledDate,
        duration: 60, // Default 1 hour
        type: interviewType as 'PHONE' | 'VIDEO' | 'IN_PERSON',
        status: 'SCHEDULED',
        location: interviewData.location || 'Main Office',
        notes: interviewData.notes || 'Interview scheduled via Susan AI'
      });
      
      // Update candidate status to INTERVIEW
      await this.moveCandidateStage(candidateId, 'INTERVIEW');
      
      // Create Google Calendar event
      try {
        const GoogleCalendarService = (await import('../google-calendar-service')).default;
        const calendarService = new GoogleCalendarService();
        await calendarService.initialize();
        
        // Get candidate and interviewer details for the calendar event
        const candidate = await this.storage.getCandidateById(candidateId);
        const interviewer = await this.storage.getUserById(interviewData.interviewerIds[0]);
        
        if (candidate && interviewer) {
          const endDateTime = new Date(scheduledDate.getTime() + 60 * 60 * 1000); // 1 hour duration
          
          const calendarEvent = await calendarService.createEvent({
            summary: `Interview: ${candidate.firstName} ${candidate.lastName} - ${candidate.position}`,
            description: `Interview with ${candidate.firstName} ${candidate.lastName} for ${candidate.position} position.\n\nCandidate Email: ${candidate.email}\nCandidate Phone: ${candidate.phone || 'N/A'}\n\nNotes: ${interviewData.notes || 'Scheduled via Susan AI'}`,
            startDateTime: scheduledDate,
            endDateTime,
            location: interviewData.location || 'Main Office',
            attendees: [candidate.email, interviewer.email].filter(Boolean),
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 60 },
                { method: 'popup', minutes: 15 }
              ]
            }
          });
          
          // Update interview with calendar event ID
          if (calendarEvent?.id) {
            await this.storage.updateInterview(interview.id, { 
              calendarEventId: calendarEvent.id 
            });
          }
          
          console.log(`[SUSAN-RECRUITING] Created calendar event for interview ${interview.id}`);
        }
      } catch (calendarError) {
        console.error('[SUSAN-RECRUITING] Failed to create calendar event:', calendarError);
        // Continue without failing - interview is still saved in database
      }

      // Send interview notification email
      await this.sendCandidateEmail(candidateId, 'interview_scheduled');

      console.log(`[SUSAN-RECRUITING] Successfully scheduled interview ${interview.id} for candidate ${candidateId}`);
      console.log(`[SUSAN-RECRUITING] Interview scheduled for: ${scheduledDate.toISOString()}`);
      
      return { success: true, interviewId: interview.id };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error scheduling interview:', error);
      return { success: false, error: 'Failed to schedule interview: ' + (error as Error).message };
    }
  }

  /**
   * Add note to candidate
   */
  async addCandidateNote(
    candidateId: string,
    note: string,
    userId: string
  ): Promise<{ success: boolean; noteId?: string; error?: string }> {
    try {
      const noteId = uuidv4();
      
      // In a real system, this would add to a notes table
      // For now, we append to the candidate's notes field
      const [candidate] = await db.select()
        .from(candidates)
        .where(eq(candidates.id, candidateId))
        .limit(1);
        
      if (candidate) {
        await db.update(candidates)
          .set({
            notes: sql`${candidates.notes} || E'\n[NOTE] ${note}'`,
            updatedAt: new Date()
          })
          .where(eq(candidates.id, candidateId));
      }

      console.log(`[SUSAN-RECRUITING] Added note to candidate ${candidateId}`);
      return { success: true, noteId };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error adding note:', error);
      return { success: false, error: 'Failed to add note' };
    }
  }

  /**
   * Reject multiple candidates
   */
  async rejectCandidates(
    candidateIds: string[],
    reason?: string
  ): Promise<{ success: boolean; rejectedCount?: number; error?: string }> {
    try {
      await db.update(candidates)
        .set({
          status: 'REJECTED',
          notes: sql`${candidates.notes} || E'\\n[REJECTED] ${reason || 'Position filled'}' `,
          updatedAt: new Date()
        })
        .where(inArray(candidates.id, candidateIds));

      // Send rejection emails
      for (const candidateId of candidateIds) {
        await this.sendCandidateEmail(candidateId, 'rejection');
      }

      console.log(`[SUSAN-RECRUITING] Rejected ${candidateIds.length} candidates`);
      return { success: true, rejectedCount: candidateIds.length };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error rejecting candidates:', error);
      return { success: false, error: 'Failed to reject candidates' };
    }
  }

  /**
   * Archive old candidates
   */
  async archiveCandidates(
    olderThanDays: number = 90
  ): Promise<{ success: boolean; archivedCount?: number; error?: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db.update(candidates)
        .set({
          status: 'ARCHIVED',
          updatedAt: new Date()
        })
        .where(and(
          sql`${candidates.updatedAt} < ${cutoffDate}`,
          inArray(candidates.status, ['NEW', 'SCREENING', 'WITHDRAWN'])
        ));

      console.log(`[SUSAN-RECRUITING] Archived old candidates`);
      return { success: true };
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error archiving candidates:', error);
      return { success: false, error: 'Failed to archive candidates' };
    }
  }

  /**
   * Send email to candidate
   */
  private async sendCandidateEmail(
    candidateId: string,
    templateType: 'welcome' | 'interview_scheduled' | 'offer' | 'rejection'
  ): Promise<void> {
    try {
      const [candidate] = await db.select()
        .from(candidates)
        .where(eq(candidates.id, candidateId))
        .limit(1);

      if (!candidate || !candidate.email) return;

      let subject = '';
      let html = '';

      switch (templateType) {
        case 'welcome':
          subject = 'Thank you for your application';
          html = `
            <p>Dear ${candidate.name},</p>
            <p>Thank you for your interest in the ${candidate.position} position at ROOF-ER.</p>
            <p>We have received your application and will review it shortly.</p>
            <p>Best regards,<br>ROOF-ER Recruiting Team</p>
          `;
          break;
        case 'interview_scheduled':
          subject = 'Interview Scheduled - ROOF-ER';
          html = `
            <p>Dear ${candidate.name},</p>
            <p>We are pleased to inform you that your interview for ${candidate.position} has been scheduled.</p>
            <p>Our team will contact you with the details shortly.</p>
            <p>Best regards,<br>ROOF-ER Recruiting Team</p>
          `;
          break;
        case 'offer':
          subject = 'Job Offer - ROOF-ER';
          html = `
            <p>Dear ${candidate.name},</p>
            <p>Congratulations! We are pleased to extend an offer for the ${candidate.position} position.</p>
            <p>Our HR team will contact you with the offer details.</p>
            <p>Best regards,<br>ROOF-ER Team</p>
          `;
          break;
        case 'rejection':
          subject = 'Application Update - ROOF-ER';
          html = `
            <p>Dear ${candidate.name},</p>
            <p>Thank you for your interest in the ${candidate.position} position at ROOF-ER.</p>
            <p>After careful consideration, we have decided to move forward with other candidates.</p>
            <p>We wish you the best in your job search.</p>
            <p>Best regards,<br>ROOF-ER Recruiting Team</p>
          `;
          break;
      }

      await this.emailService.sendEmail({
        to: candidate.email,
        subject,
        html
      });

      console.log(`[SUSAN-RECRUITING] Sent ${templateType} email to ${candidate.email}`);
    } catch (error) {
      console.error('[SUSAN-RECRUITING] Error sending email:', error);
    }
  }

  /**
   * Parse natural language command
   */
  parseCommand(command: string): RecruitingAction | null {
    const lowerCommand = command.toLowerCase();

    // Create candidate
    if (lowerCommand.includes('add candidate') || lowerCommand.includes('create candidate')) {
      const nameMatch = command.match(/(?:named?|called?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
      const emailMatch = command.match(/(?:email|with email)\s+([^\s@]+@[^\s@]+\.[^\s@]+)/i);
      const positionMatch = command.match(/(?:for|as|position)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
      
      if (nameMatch || emailMatch) {
        return {
          type: 'create_candidate',
          data: {
            name: nameMatch?.[1] || 'Unknown',
            email: emailMatch?.[1] || '',
            position: positionMatch?.[1] || 'General Application'
          }
        };
      }
    }

    // Move stage
    if (lowerCommand.includes('move') && lowerCommand.includes('to')) {
      const stages = ['screening', 'interview', 'offer', 'hired', 'rejected'];
      const foundStage = stages.find(stage => lowerCommand.includes(stage));
      
      if (foundStage) {
        // Check if it's bulk move
        if (lowerCommand.includes('all')) {
          return {
            type: 'bulk_move',
            data: { stage: foundStage.toUpperCase() }
          };
        } else {
          return {
            type: 'move_stage',
            data: { stage: foundStage.toUpperCase() }
          };
        }
      }
    }

    // Schedule interview
    if (lowerCommand.includes('schedule interview')) {
      return {
        type: 'schedule_interview',
        data: { type: 'VIDEO' }
      };
    }

    // Reject candidates
    if (lowerCommand.includes('reject')) {
      const reasonMatch = command.match(/(?:because|reason:?)\s+(.+)/i);
      return {
        type: 'reject_candidates',
        data: { reason: reasonMatch?.[1] || 'Position filled' }
      };
    }

    // Archive candidates
    if (lowerCommand.includes('archive')) {
      const daysMatch = command.match(/(\d+)\s*days?/i);
      return {
        type: 'archive_candidates',
        data: { days: daysMatch ? parseInt(daysMatch[1]) : 90 }
      };
    }

    return null;
  }
}