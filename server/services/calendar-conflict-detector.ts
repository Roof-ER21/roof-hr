import { google } from 'googleapis';
import { addMinutes, parseISO } from 'date-fns';
import type { IStorage } from '../storage';
import { timezoneService } from './timezone-service';
import { serviceAccountAuth } from './service-account-auth';

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
  private storage: IStorage;
  private isInitialized: boolean = false;
  private initWarningLogged: boolean = false;
  private calendarRateLimitUntil: number | null = null;
  private calendarRateLimitByEmail = new Map<string, number>();
  private readonly calendarRateLimitCooldownMs = 60 * 1000;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async initialize() {
    // Use service account with domain-wide delegation for calendar access
    if (serviceAccountAuth.isConfigured()) {
      this.isInitialized = true;
      const serviceEmail = serviceAccountAuth.getServiceAccountEmail();
      console.log('[CalendarConflictDetector] ✅ Initialized with Service Account:', serviceEmail);
      console.log('[CalendarConflictDetector] 📅 Google Calendar conflict detection ENABLED');
    } else {
      console.warn('[CalendarConflictDetector] ⚠️ Service account not configured - Google Calendar checks disabled');
      console.warn('[CalendarConflictDetector] Set GOOGLE_SERVICE_ACCOUNT_KEY environment variable to enable');
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
      }

      // 4. Check for soft conflicts ONCE (outside the participant loop)
      const softConflicts = this.checkSoftConflicts(startTime, endTime);
      warnings.push(...softConflicts);

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

      const [primaryInterviews, panelInterviews] = await Promise.all([
        this.storage.getInterviewsByInterviewer(user.id),
        this.storage.getInterviewsByPanelMember(user.id)
      ]);

      const interviewsById = new Map<string, any>();
      for (const interview of [...primaryInterviews, ...panelInterviews]) {
        interviewsById.set(interview.id, interview);
      }

      const userInterviews = Array.from(interviewsById.values()).filter(interview =>
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
   * Check Google Calendar for conflicts using service account impersonation
   */
  private async checkGoogleCalendarConflicts(
    email: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarConflict[]> {
    const conflicts: CalendarConflict[] = [];
    const now = Date.now();

    if (!this.isInitialized) {
      console.log(`[CalendarConflictDetector] ⏭️ Skipping Google Calendar check for ${email} - not initialized`);
      return conflicts;
    }

    // Fetch scheduled interviews for this user to avoid ghost conflicts after deletes
    let scheduledInterviewWindows: Array<{ start: Date; end: Date }> = [];
    try {
      const user = await this.storage.getUserByEmail(email);
      const userId = Array.isArray(user) ? user?.[0]?.id : (user as any)?.id;
      if (userId) {
        const [primaryInterviews, panelInterviews] = await Promise.all([
          this.storage.getInterviewsByInterviewer(userId),
          this.storage.getInterviewsByPanelMember(userId)
        ]);
        const uniqueInterviews = new Map<string, any>();
        for (const interview of [...primaryInterviews, ...panelInterviews]) {
          if (interview.status === 'SCHEDULED') {
            uniqueInterviews.set(interview.id, interview);
          }
        }
        scheduledInterviewWindows = Array.from(uniqueInterviews.values()).map((int) => {
          const s = new Date(int.scheduledDate);
          const e = addMinutes(s, int.duration || 60);
          return { start: s, end: e };
        });
      }
    } catch (lookupErr) {
      console.warn('[CalendarConflictDetector] Skipping interview cross-check for', email, lookupErr);
    }

    // Only check @theroofdocs.com emails (domain-wide delegation scope)
    if (!email.endsWith('@theroofdocs.com')) {
      console.log(`[CalendarConflictDetector] ⏭️ Skipping Google Calendar check for ${email} - not @theroofdocs.com domain`);
      return conflicts;
    }

    if (this.isCalendarRateLimited(email, now)) {
      return conflicts;
    }

    console.log(`[CalendarConflictDetector] 📅 Checking Google Calendar for ${email}...`);
    console.log(`[CalendarConflictDetector] 🕒 Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);

    try {
      // Get calendar service impersonating this user
      const calendar = await serviceAccountAuth.getCalendarForUser(email);

      // Query the user's calendar for events in the time range
      const response = await calendar.events.list({
        calendarId: 'primary', // User's primary calendar
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      console.log(`[CalendarConflictDetector] 📊 Found ${events.length} calendar events for ${email}`);

      if (events.length > 0) {
        console.log(`[CalendarConflictDetector] 📋 Events:`, events.map(e => ({
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          transparency: e.transparency,
          status: e.status
        })));
      }

      for (const event of events) {
        // Skip if this is the event we're updating
        if (excludeEventId && event.id === excludeEventId) {
          console.log(`[CalendarConflictDetector] ⏭️ Skipping event ${event.id} - excluded event`);
          continue;
        }

        // Skip if the event is marked as free/transparent
        if (event.transparency === 'transparent') {
          console.log(`[CalendarConflictDetector] ⏭️ Skipping "${event.summary}" - marked as free/transparent`);
          continue;
        }

        // Skip if user has declined the event
        const userAttendee = event.attendees?.find((a: any) => a.email === email);
        if (userAttendee?.responseStatus === 'declined') {
          console.log(`[CalendarConflictDetector] ⏭️ Skipping "${event.summary}" - user declined`);
          continue;
        }

        const eventStart = event.start?.dateTime ?
          parseISO(event.start.dateTime) :
          parseISO(event.start?.date || '');

        const eventEnd = event.end?.dateTime ?
          parseISO(event.end.dateTime) :
          parseISO(event.end?.date || '');

        if (this.datesOverlap(startTime, endTime, eventStart, eventEnd)) {
          // Skip ghost interview events that no longer exist in our DB
          const looksLikeInterview = (event.summary || '').toLowerCase().includes('interview');
          if (looksLikeInterview && scheduledInterviewWindows.length > 0) {
            const hasMatchingDbInterview = scheduledInterviewWindows.some((win) =>
              this.datesOverlap(win.start, win.end, eventStart, eventEnd)
            );
            if (!hasMatchingDbInterview) {
              console.log(`[CalendarConflictDetector] ⏭️ Skipping ghost interview event "${event.summary}"`);
              continue;
            }
          }

          const severity = userAttendee?.responseStatus === 'tentative' ? 'soft' : 'hard';
          console.log(`[CalendarConflictDetector] ❌ CONFLICT DETECTED: "${event.summary}" (${severity})`);

          conflicts.push({
            type: 'MEETING',
            title: event.summary || 'Busy',
            start: eventStart,
            end: eventEnd,
            attendees: event.attendees?.map((a: any) => a.email),
            severity
          });
        }
      }

      console.log(`[CalendarConflictDetector] ✅ Finished checking ${email}'s calendar: ${events.length} events, ${conflicts.length} conflicts`);
    } catch (error: any) {
      const message = error?.message || '';
      const status = error?.response?.status || error?.code;
      const details = error?.response?.data || error?.errors || '';
      const detailsText = typeof details === 'string' ? details : JSON.stringify(details);
      const isRateLimit =
        status === 403 &&
        (message.includes('Quota exceeded') ||
          message.includes('RATE_LIMIT_EXCEEDED') ||
          detailsText.includes('rateLimitExceeded') ||
          detailsText.includes('RATE_LIMIT_EXCEEDED'));

      if (isRateLimit) {
        this.markCalendarRateLimited(email, now);
        console.warn(
          `[CalendarConflictDetector] [GoogleCalendar] Rate limit (status ${status}). Cooling down for ${Math.round(this.calendarRateLimitCooldownMs / 1000)}s.`
        );
        return conflicts;
      }

      // Log specific error types with more detail
      if (status === 403 || message.includes('Not Authorized') || message.includes('Forbidden')) {
        console.error(`[CalendarConflictDetector] ❌ ACCESS DENIED for ${email}'s calendar`);
        console.error(`[CalendarConflictDetector] 🔑 Error: ${message}`);
        console.error(`[CalendarConflictDetector] 📋 Details:`, JSON.stringify(details, null, 2));
        console.error(`[CalendarConflictDetector] 💡 SOLUTION: Verify domain-wide delegation is enabled for service account with Calendar API scope (https://www.googleapis.com/auth/calendar)`);

        if (!this.initWarningLogged) {
          this.initWarningLogged = true;
        }
      } else if (status === 404) {
        console.warn(`[CalendarConflictDetector] ⚠️ Calendar not found for ${email}`);
      } else {
        console.error(`[CalendarConflictDetector] ❌ Unexpected error checking Google Calendar for ${email}`);
        console.error(`[CalendarConflictDetector] Status: ${status}, Message: ${message}`);
        console.error(`[CalendarConflictDetector] Full error:`, error);
      }
    }

    return conflicts;
  }

  private isCalendarRateLimited(email: string, now: number): boolean {
    const globalUntil = this.calendarRateLimitUntil ?? 0;
    if (globalUntil > now) {
      return true;
    }
    const emailUntil = this.calendarRateLimitByEmail.get(email) ?? 0;
    return emailUntil > now;
  }

  private markCalendarRateLimited(email: string, now: number): void {
    const until = now + this.calendarRateLimitCooldownMs;
    this.calendarRateLimitUntil = Math.max(this.calendarRateLimitUntil ?? 0, until);
    const emailUntil = this.calendarRateLimitByEmail.get(email) ?? 0;
    this.calendarRateLimitByEmail.set(email, Math.max(emailUntil, until));
  }

  /**
   * Check for soft conflicts (warnings)
   * Uses Eastern Time for hour/day checks since all users are in ET
   */
  private checkSoftConflicts(startTime: Date, endTime: Date): string[] {
    const warnings: string[] = [];
    const timezone = 'America/New_York';

    // Get hours and day in Eastern Time, not UTC
    const hour = timezoneService.getHourInTimezone(startTime, timezone);
    const endHour = timezoneService.getHourInTimezone(endTime, timezone);
    const dayOfWeek = timezoneService.getDayOfWeekInTimezone(startTime, timezone);

    // Lunch hour warning (12pm - 1pm)
    if (hour === 12 || (hour < 12 && endHour > 12)) {
      warnings.push('Interview scheduled during typical lunch hours (12pm-1pm)');
    }

    // Early morning warning (before 7am)
    if (hour < 7) {
      warnings.push('Interview scheduled before office hours (before 7am)');
    }

    // Late afternoon warning (after 6pm)
    if (hour >= 18) {
      warnings.push('Interview scheduled after office hours (after 6pm)');
    }

    // Friday afternoon warning (dayOfWeek: 5 = Friday)
    if (dayOfWeek === 5 && hour >= 15) {
      warnings.push('Interview scheduled on Friday afternoon');
    }

    // Monday morning warning (dayOfWeek: 1 = Monday)
    if (dayOfWeek === 1 && hour < 10) {
      warnings.push('Interview scheduled early Monday morning');
    }

    console.log('[SOFT CONFLICTS] Generated warnings:', warnings);
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

      // Check hourly slots from 7am to 6pm (office hours)
      for (let hour = 7; hour < 18 && suggestions.length < maxSuggestions; hour++) {
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
   * Format conflict for display - uses Eastern Time (America/New_York)
   */
  formatConflictMessage(conflict: CalendarConflict): string {
    const timezone = 'America/New_York';

    // Format date and time in ET
    const startStr = timezoneService.formatInTimezone(conflict.start, timezone, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const endStr = timezoneService.formatInTimezone(conflict.end, timezone, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    switch (conflict.type) {
      case 'PTO':
        return `❌ ${conflict.attendees?.[0] || 'Participant'} is on PTO from ${startStr} to ${endStr} ET`;
      case 'INTERVIEW':
        return `❌ ${conflict.title} scheduled from ${startStr} to ${endStr} ET`;
      case 'MEETING':
        return `⚠️ ${conflict.title} scheduled from ${startStr} to ${endStr} ET`;
      default:
        return `⚠️ Calendar conflict from ${startStr} to ${endStr} ET`;
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
let initPromise: Promise<void> | null = null;

export async function getConflictDetector(storage: IStorage): Promise<CalendarConflictDetector> {
  if (!conflictDetector) {
    conflictDetector = new CalendarConflictDetector(storage);
    initPromise = conflictDetector.initialize();
  }
  // Always await initialization to prevent race conditions
  if (initPromise) {
    await initPromise;
  }
  return conflictDetector;
}
