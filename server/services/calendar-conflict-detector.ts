import { google } from 'googleapis';
import { addMinutes, parseISO } from 'date-fns';
import { DEFAULT_INTERVIEW_DURATION_MINUTES } from '@shared/interview-constants';
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

interface BusyBlock {
  start: Date;
  end: Date;
  source: 'google' | 'pto' | 'interview';
  title?: string;
  email?: string;
}

// Simple in-memory cache for FreeBusy results (5 min TTL)
const freeBusyCache = new Map<string, { data: BusyBlock[]; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class CalendarConflictDetector {
  private storage: IStorage;
  private isInitialized: boolean = false;
  private initWarningLogged: boolean = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async initialize() {
    if (serviceAccountAuth.isConfigured()) {
      this.isInitialized = true;
      const serviceEmail = serviceAccountAuth.getServiceAccountEmail();
      console.log('[CalendarConflictDetector] ✅ Initialized with Service Account:', serviceEmail);
      console.log('[CalendarConflictDetector] 📅 Google Calendar conflict detection ENABLED (FreeBusy API)');
    } else {
      console.warn('[CalendarConflictDetector] ⚠️ Service account not configured - Google Calendar checks disabled');
    }
  }

  // ─── PUBLIC API (same contract as before) ─────────────────────────

  /**
   * Check for calendar conflicts for multiple participants.
   * Uses FreeBusy API (1 call) + batch DB queries instead of per-slot checking.
   */
  async checkConflicts(
    participants: string[],
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<ConflictCheckResult> {
    const conflicts: CalendarConflict[] = [];
    const warnings: string[] = [];

    try {
      // 1. Gather ALL busy blocks in parallel (3 queries total, not N×M)
      const busyBlocks = await this.getAllBusyBlocks(participants, startTime, endTime, excludeEventId);

      // 2. Find which busy blocks overlap with the requested time
      for (const block of busyBlocks) {
        if (this.datesOverlap(startTime, endTime, block.start, block.end)) {
          conflicts.push({
            type: block.source === 'pto' ? 'PTO' : block.source === 'interview' ? 'INTERVIEW' : 'MEETING',
            title: block.title || 'Busy',
            start: block.start,
            end: block.end,
            attendees: block.email ? [block.email] : undefined,
            severity: 'hard',
          });
        }
      }

      // 3. Soft conflict warnings (pure math, no API calls)
      const softConflicts = this.checkSoftConflicts(startTime, endTime);
      warnings.push(...softConflicts);

      // 4. If conflicts found, suggest alternatives using the SAME busy blocks (no new API calls)
      let suggestedTimes: Date[] = [];
      if (conflicts.length > 0) {
        suggestedTimes = this.findGapsInBusyBlocks(busyBlocks, startTime, endTime, 5);
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts: this.deduplicateConflicts(conflicts),
        suggestedTimes,
        warnings,
      };
    } catch (error) {
      console.error('[CalendarConflictDetector] Error checking conflicts:', error);
      return {
        hasConflicts: false,
        conflicts: [],
        warnings: ['Unable to perform complete conflict check. Please verify availability manually.'],
      };
    }
  }

  // ─── DATA GATHERING (3 queries total) ─────────────────────────────

  /**
   * Gather all busy blocks from Google Calendar (FreeBusy), PTO, and interviews.
   * This is the single data-fetch layer — everything else is pure math.
   */
  private async getAllBusyBlocks(
    participants: string[],
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<BusyBlock[]> {
    // Expand the window for suggestion finding (check 5 business days ahead)
    const windowEnd = new Date(startTime);
    windowEnd.setDate(windowEnd.getDate() + 7);
    const rangeEnd = endTime > windowEnd ? endTime : windowEnd;

    // Run all 3 data sources in parallel
    const [googleBlocks, ptoBlocks, interviewBlocks] = await Promise.all([
      this.getGoogleFreeBusy(participants, startTime, rangeEnd),
      this.getPTOBusyBlocks(participants, startTime, rangeEnd),
      this.getInterviewBusyBlocks(participants, startTime, rangeEnd, excludeEventId),
    ]);

    return [...googleBlocks, ...ptoBlocks, ...interviewBlocks];
  }

  /**
   * Google FreeBusy API — 1 call for ALL participants across the full range.
   */
  private async getGoogleFreeBusy(
    participants: string[],
    startTime: Date,
    endTime: Date
  ): Promise<BusyBlock[]> {
    if (!this.isInitialized) return [];

    // Only check @theroofdocs.com emails
    const domainEmails = participants.filter(e => e.endsWith('@theroofdocs.com'));
    if (domainEmails.length === 0) return [];

    // Check cache
    const cacheKey = `${domainEmails.sort().join(',')}-${startTime.toISOString()}-${endTime.toISOString()}`;
    const cached = freeBusyCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      console.log(`[CalendarConflictDetector] 📦 Using cached FreeBusy data (${cached.data.length} blocks)`);
      return cached.data;
    }

    try {
      // Use the first participant's impersonated client for the FreeBusy call
      const calendar = await serviceAccountAuth.getCalendarForUser(domainEmails[0]);

      console.log(`[CalendarConflictDetector] 📅 FreeBusy query for ${domainEmails.length} participants: ${startTime.toISOString()} → ${endTime.toISOString()}`);

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          items: domainEmails.map(id => ({ id })),
        },
      });

      const blocks: BusyBlock[] = [];
      const calendars = response.data.calendars || {};

      for (const email of domainEmails) {
        const calendarData = calendars[email];
        if (calendarData?.errors?.length) {
          console.warn(`[CalendarConflictDetector] ⚠️ FreeBusy error for ${email}:`, calendarData.errors);
          continue;
        }

        const busyPeriods = calendarData?.busy || [];
        for (const period of busyPeriods) {
          if (period.start && period.end) {
            blocks.push({
              start: new Date(period.start),
              end: new Date(period.end),
              source: 'google',
              title: 'Calendar Busy',
              email,
            });
          }
        }
      }

      console.log(`[CalendarConflictDetector] ✅ FreeBusy returned ${blocks.length} busy blocks for ${domainEmails.length} participants`);

      // Cache the result
      freeBusyCache.set(cacheKey, { data: blocks, expires: Date.now() + CACHE_TTL_MS });

      return blocks;
    } catch (error: any) {
      console.error(`[CalendarConflictDetector] ❌ FreeBusy API error:`, error?.message || error);
      return [];
    }
  }

  /**
   * Batch PTO lookup — 1 query per participant (could optimize further with batch query).
   */
  private async getPTOBusyBlocks(
    participants: string[],
    startTime: Date,
    endTime: Date
  ): Promise<BusyBlock[]> {
    const blocks: BusyBlock[] = [];

    try {
      for (const email of participants) {
        const users = await this.storage.getUserByEmail(email);
        const user = Array.isArray(users) ? users[0] : users;
        if (!user) continue;

        const ptoRequests = await this.storage.getPtoRequestsByEmployee(user.id);

        for (const pto of ptoRequests) {
          if (pto.status !== 'APPROVED') continue;

          const ptoStart = parseISO(pto.startDate);
          const ptoEnd = parseISO(pto.endDate);

          // Only include PTO that overlaps our window
          if (this.datesOverlap(startTime, endTime, ptoStart, ptoEnd)) {
            blocks.push({
              start: ptoStart,
              end: ptoEnd,
              source: 'pto',
              title: `${user.firstName} ${user.lastName} - Time Off`,
              email,
            });
          }
        }
      }
    } catch (error) {
      console.error('[CalendarConflictDetector] Error fetching PTO blocks:', error);
    }

    return blocks;
  }

  /**
   * Batch interview lookup — 1 query per participant.
   */
  private async getInterviewBusyBlocks(
    participants: string[],
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<BusyBlock[]> {
    const blocks: BusyBlock[] = [];

    try {
      for (const email of participants) {
        const users = await this.storage.getUserByEmail(email);
        const user = Array.isArray(users) ? users[0] : users;
        if (!user) continue;

        const [primaryInterviews, panelInterviews] = await Promise.all([
          this.storage.getInterviewsByInterviewer(user.id),
          this.storage.getInterviewsByPanelMember(user.id),
        ]);

        const interviewsById = new Map<string, any>();
        for (const interview of [...primaryInterviews, ...panelInterviews]) {
          interviewsById.set(interview.id, interview);
        }

        for (const interview of interviewsById.values()) {
          if (interview.status !== 'SCHEDULED') continue;
          if (excludeEventId && interview.id === excludeEventId) continue;
          if (!interview.scheduledDate) continue;

          const intStart = new Date(interview.scheduledDate);
          const intEnd = addMinutes(intStart, interview.duration || DEFAULT_INTERVIEW_DURATION_MINUTES);

          if (this.datesOverlap(startTime, endTime, intStart, intEnd)) {
            const candidate = await this.storage.getCandidateById(interview.candidateId);
            blocks.push({
              start: intStart,
              end: intEnd,
              source: 'interview',
              title: `Interview: ${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim(),
              email,
            });
          }
        }
      }
    } catch (error) {
      console.error('[CalendarConflictDetector] Error fetching interview blocks:', error);
    }

    return blocks;
  }

  // ─── GAP FINDING (pure math, zero API calls) ─────────────────────

  /**
   * Find available time slots by inverting busy blocks.
   * No API calls — works entirely from the already-fetched busy data.
   */
  private findGapsInBusyBlocks(
    busyBlocks: BusyBlock[],
    preferredDate: Date,
    _endTime: Date,
    maxSuggestions: number
  ): Date[] {
    const suggestions: Date[] = [];
    const checkDate = new Date(preferredDate);

    for (let day = 0; day < 5 && suggestions.length < maxSuggestions; day++) {
      // Skip weekends
      if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
        checkDate.setDate(checkDate.getDate() + 1);
        continue;
      }

      // Check default interview-length slots from 9am to 5pm
      for (let hour = 9; hour < 17 && suggestions.length < maxSuggestions; hour++) {
        const slotStart = new Date(checkDate);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(checkDate);
        slotEnd.setTime(slotStart.getTime() + DEFAULT_INTERVIEW_DURATION_MINUTES * 60 * 1000);

        // Check if ANY busy block overlaps this slot
        const hasConflict = busyBlocks.some(block =>
          this.datesOverlap(slotStart, slotEnd, block.start, block.end)
        );

        if (!hasConflict) {
          suggestions.push(slotStart);
        }
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }

    return suggestions;
  }

  // Keep public for external callers (though currently only internal)
  async findAvailableSlots(
    participants: string[],
    preferredDate: Date,
    maxSuggestions: number = 5
  ): Promise<Date[]> {
    const windowEnd = new Date(preferredDate);
    windowEnd.setDate(windowEnd.getDate() + 7);
    const busyBlocks = await this.getAllBusyBlocks(participants, preferredDate, windowEnd);
    return this.findGapsInBusyBlocks(busyBlocks, preferredDate, windowEnd, maxSuggestions);
  }

  // ─── SOFT CONFLICTS (pure logic, no API calls) ────────────────────

  private checkSoftConflicts(startTime: Date, endTime: Date): string[] {
    const warnings: string[] = [];
    const timezone = 'America/New_York';

    const hour = timezoneService.getHourInTimezone(startTime, timezone);
    const endHour = timezoneService.getHourInTimezone(endTime, timezone);
    const dayOfWeek = timezoneService.getDayOfWeekInTimezone(startTime, timezone);

    if (hour === 12 || (hour < 12 && endHour > 12)) {
      warnings.push('Interview scheduled during typical lunch hours (12pm-1pm)');
    }
    if (hour < 7) {
      warnings.push('Interview scheduled before office hours (before 7am)');
    }
    if (hour >= 18) {
      warnings.push('Interview scheduled after office hours (after 6pm)');
    }
    if (dayOfWeek === 5 && hour >= 15) {
      warnings.push('Interview scheduled on Friday afternoon');
    }
    if (dayOfWeek === 1 && hour < 10) {
      warnings.push('Interview scheduled early Monday morning');
    }

    return warnings;
  }

  // ─── UTILITIES ────────────────────────────────────────────────────

  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  private deduplicateConflicts(conflicts: CalendarConflict[]): CalendarConflict[] {
    const seen = new Set<string>();
    return conflicts.filter(conflict => {
      const key = `${conflict.type}-${conflict.start.toISOString()}-${conflict.end.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  formatConflictMessage(conflict: CalendarConflict): string {
    const timezone = 'America/New_York';
    const startStr = timezoneService.formatInTimezone(conflict.start, timezone, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const endStr = timezoneService.formatInTimezone(conflict.end, timezone, {
      hour: 'numeric', minute: '2-digit', hour12: true,
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

  async sendConflictAlerts(
    conflicts: CalendarConflict[],
    interviewDetails: any,
    forcedSchedule: boolean = false,
    scheduledByUserEmail?: string
  ): Promise<void> {
    try {
      const { getConflictNotifier } = await import('./interview-conflict-notifier');
      const notifier = getConflictNotifier(this.storage);
      await notifier.sendConflictAlerts(conflicts, interviewDetails, forcedSchedule, scheduledByUserEmail);
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
  if (initPromise) {
    await initPromise;
  }
  return conflictDetector;
}
