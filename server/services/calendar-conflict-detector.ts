import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { addMinutes, format, parseISO, startOfDay, endOfDay } from 'date-fns';
import type { IStorage } from '../storage';

export interface CalendarConflict {
  type: 'PTO' | 'INTERVIEW' | 'MEETING' | 'BUSY';
  title: string;
  start: Date;
  end: Date;
  attendees?: string[];
  severity: 'hard' | 'soft'; // hard = must reschedule, soft = warning only
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: CalendarConflict[];
  suggestedTimes?: Date[];
  warnings: string[];
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export class CalendarConflictDetector {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  private storage: IStorage;
  private isInitialized: boolean = false;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async initialize() {
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      this.isInitialized = true;
      console.log('[CalendarConflictDetector] Initialized with Google Calendar');
    } else {
      console.warn('[CalendarConflictDetector] No Google refresh token available');
    }
  }

  /**
   * Check for calendar conflicts for multiple participants
   */
  async checkConflicts(
    participants: string[], // email addresses
    startTime: Date,
    endTime: Date,
    excludeEventId?: string // Exclude this event from conflict check (for updates)
  ): Promise<ConflictCheckResult> {
    const conflicts: CalendarConflict[] = [];
    const warnings: string[] = [];

    try {
      // Check each participant's calendar
      for (const email of participants) {
        // 1. Check for PTO conflicts
        const ptoConflicts = await this.checkPTOConflicts(email, startTime, endTime);
        conflicts.push(...ptoConflicts);

        // 2. Check for interview conflicts
        const interviewConflicts = await this.checkInterviewConflicts(email, startTime, endTime, excludeEventId);
        conflicts.push(...interviewConflicts);

        // 3. Check Google Calendar conflicts (if initialized)
        if (this.isInitialized) {
          const calendarConflicts = await this.checkGoogleCalendarConflicts(email, startTime, endTime, excludeEventId);
          conflicts.push(...calendarConflicts);
        }

        // 4. Check for soft conflicts (lunch hours, end of day, etc.)
        const softConflicts = this.checkSoftConflicts(startTime, endTime);
        warnings.push(...softConflicts);
      }

      // Generate suggested alternative times if there are conflicts
      let suggestedTimes: Date[] = [];
      if (conflicts.length > 0) {
        suggestedTimes = await this.findAvailableSlots(participants, startTime, 5);
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts: this.deduplicateConflicts(conflicts),
        suggestedTimes,
        warnings
      };
    } catch (error) {
      console.error('[CalendarConflictDetector] Error checking conflicts:', error);
      return {
        hasConflicts: false,
        conflicts: [],
        warnings: ['Unable to perform complete conflict check. Please verify availability manually.']
      };
    }
  }

  /**
   * Check for PTO conflicts
   */
  private async checkPTOConflicts(email: string, startTime: Date, endTime: Date): Promise<CalendarConflict[]> {
    const conflicts: CalendarConflict[] = [];

    try {
      // Get user by email
      const users = await this.storage.getUserByEmail(email);
      const user = Array.isArray(users) ? users[0] : users;
      
      if (!user) return conflicts;

      // Get approved PTO requests for this user
      const ptoRequests = await this.storage.getPtoRequestsByEmployee(user.id);
      
      for (const pto of ptoRequests) {
        if (pto.status !== 'APPROVED') continue;

        const ptoStart = parseISO(pto.startDate);
        const ptoEnd = parseISO(pto.endDate);

        // Check if interview overlaps with PTO
        if (this.datesOverlap(startTime, endTime, ptoStart, ptoEnd)) {
          conflicts.push({
            type: 'PTO',
            title: `${user.firstName} ${user.lastName} - Time Off`,
            start: ptoStart,
            end: ptoEnd,
            attendees: [email],
            severity: 'hard'
          });
        }
      }
    } catch (error) {
      console.error(`[CalendarConflictDetector] Error checking PTO conflicts for ${email}:`, error);
    }

    return conflicts;
  }

  /**
   * Check for interview conflicts
   */
  private async checkInterviewConflicts(
    email: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarConflict[]> {
    const conflicts: CalendarConflict[] = [];

    try {
      // Get user by email
      const users = await this.storage.getUserByEmail(email);
      const user = Array.isArray(users) ? users[0] : users;
      
      if (!user) return conflicts;

      // Get interviews where this user is an interviewer
      const allInterviews = await this.storage.getAllInterviews();
      const userInterviews = allInterviews.filter(interview =>
        interview.interviewerId === user.id &&
        interview.status === 'SCHEDULED' &&
        interview.id !== excludeEventId
      );

      for (const interview of userInterviews) {
        if (!interview.scheduledDate) continue;

        const interviewStart = new Date(interview.scheduledDate);
        const interviewEnd = addMinutes(interviewStart, interview.duration || 60);

        // Check if times overlap
        if (this.datesOverlap(startTime, endTime, interviewStart, interviewEnd)) {
          // Get candidate info for better description
          const candidate = await this.storage.getCandidateById(interview.candidateId);
          
          conflicts.push({
            type: 'INTERVIEW',
            title: `Interview: ${candidate?.firstName} ${candidate?.lastName} - ${candidate?.position}`,
            start: interviewStart,
            end: interviewEnd,
            attendees: [email],
            severity: 'hard'
          });
        }
      }
    } catch (error) {
      console.error(`[CalendarConflictDetector] Error checking interview conflicts for ${email}:`, error);
    }

    return conflicts;
  }

  /**
   * Check Google Calendar for conflicts
   */
  private async checkGoogleCalendarConflicts(
    email: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarConflict[]> {
    const conflicts: CalendarConflict[] = [];

    if (!this.isInitialized) return conflicts;

    try {
      // Query Google Calendar for events in the time range
      const response = await this.calendar.events.list({
        calendarId: email,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];

      for (const event of events) {
        // Skip if this is the event we're updating
        if (excludeEventId && event.id === excludeEventId) continue;

        // Skip if the event is marked as free/transparent
        if (event.transparency === 'transparent') continue;

        // Skip if user has declined the event
        const userAttendee = event.attendees?.find((a: any) => a.email === email);
        if (userAttendee?.responseStatus === 'declined') continue;

        const eventStart = event.start?.dateTime ? 
          parseISO(event.start.dateTime) : 
          parseISO(event.start?.date || '');
        
        const eventEnd = event.end?.dateTime ? 
          parseISO(event.end.dateTime) : 
          parseISO(event.end?.date || '');

        if (this.datesOverlap(startTime, endTime, eventStart, eventEnd)) {
          conflicts.push({
            type: 'MEETING',
            title: event.summary || 'Busy',
            start: eventStart,
            end: eventEnd,
            attendees: event.attendees?.map((a: any) => a.email),
            severity: userAttendee?.responseStatus === 'tentative' ? 'soft' : 'hard'
          });
        }
      }
    } catch (error) {
      console.error(`[CalendarConflictDetector] Error checking Google Calendar for ${email}:`, error);
    }

    return conflicts;
  }

  /**
   * Check for soft conflicts (warnings)
   */
  private checkSoftConflicts(startTime: Date, endTime: Date): string[] {
    const warnings: string[] = [];
    const hour = startTime.getHours();
    const endHour = endTime.getHours();

    // Lunch hour warning (12pm - 1pm)
    if (hour === 12 || (hour < 12 && endHour > 12)) {
      warnings.push('Interview scheduled during typical lunch hours (12pm-1pm)');
    }

    // Early morning warning (before 9am)
    if (hour < 9) {
      warnings.push('Interview scheduled before typical business hours (before 9am)');
    }

    // Late afternoon warning (after 5pm)
    if (hour >= 17) {
      warnings.push('Interview scheduled after typical business hours (after 5pm)');
    }

    // Friday afternoon warning
    if (startTime.getDay() === 5 && hour >= 15) {
      warnings.push('Interview scheduled on Friday afternoon');
    }

    // Monday morning warning
    if (startTime.getDay() === 1 && hour < 10) {
      warnings.push('Interview scheduled early Monday morning');
    }

    return warnings;
  }

  /**
   * Find available time slots for all participants
   */
  async findAvailableSlots(
    participants: string[],
    preferredDate: Date,
    maxSuggestions: number = 5
  ): Promise<Date[]> {
    const suggestions: Date[] = [];
    const checkDate = new Date(preferredDate);
    const daysToCheck = 7; // Check up to 7 days ahead

    for (let day = 0; day < daysToCheck && suggestions.length < maxSuggestions; day++) {
      // Skip weekends
      if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
        checkDate.setDate(checkDate.getDate() + 1);
        continue;
      }

      // Check hourly slots from 9am to 5pm
      for (let hour = 9; hour < 17 && suggestions.length < maxSuggestions; hour++) {
        const slotStart = new Date(checkDate);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(checkDate);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Check if this slot is available for all participants
        const result = await this.checkConflicts(participants, slotStart, slotEnd);
        
        if (!result.hasConflicts && result.warnings.length === 0) {
          suggestions.push(slotStart);
        }
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }

    return suggestions;
  }

  /**
   * Check if two date ranges overlap
   */
  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  /**
   * Remove duplicate conflicts
   */
  private deduplicateConflicts(conflicts: CalendarConflict[]): CalendarConflict[] {
    const seen = new Set<string>();
    return conflicts.filter(conflict => {
      const key = `${conflict.type}-${conflict.start.toISOString()}-${conflict.end.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Format conflict for display
   */
  formatConflictMessage(conflict: CalendarConflict): string {
    const startStr = format(conflict.start, 'MMM d, h:mm a');
    const endStr = format(conflict.end, 'h:mm a');
    
    switch (conflict.type) {
      case 'PTO':
        return `❌ ${conflict.attendees?.[0] || 'Participant'} is on PTO from ${startStr} to ${endStr}`;
      case 'INTERVIEW':
        return `❌ ${conflict.title} scheduled from ${startStr} to ${endStr}`;
      case 'MEETING':
        return `⚠️ ${conflict.title} scheduled from ${startStr} to ${endStr}`;
      default:
        return `⚠️ Calendar conflict from ${startStr} to ${endStr}`;
    }
  }

  /**
   * Send conflict alert emails
   */
  async sendConflictAlerts(
    conflicts: CalendarConflict[],
    interviewDetails: any,
    forcedSchedule: boolean = false,
    scheduledByUserEmail?: string // Email of user who scheduled the interview (for impersonation)
  ): Promise<void> {
    try {
      const { getConflictNotifier } = await import('./interview-conflict-notifier');
      const notifier = getConflictNotifier(this.storage);

      await notifier.sendConflictAlerts(
        conflicts,
        interviewDetails,
        forcedSchedule,
        scheduledByUserEmail
      );

      console.log('[CalendarConflictDetector] Conflict alerts sent successfully');
    } catch (error) {
      console.error('[CalendarConflictDetector] Failed to send conflict alerts:', error);
    }
  }
}

// Export singleton instance
let conflictDetector: CalendarConflictDetector | null = null;

export function getConflictDetector(storage: IStorage): CalendarConflictDetector {
  if (!conflictDetector) {
    conflictDetector = new CalendarConflictDetector(storage);
    conflictDetector.initialize().catch(error => {
      console.error('[CalendarConflictDetector] Failed to initialize:', error);
    });
  }
  return conflictDetector;
}