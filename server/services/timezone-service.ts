/**
 * Timezone Service
 *
 * Provides utilities for working with timezones, converting dates,
 * and formatting times in user-specific timezones.
 */

import { storage } from '../storage';

/**
 * List of common timezones for US-based operations
 * Can be extended to include more international timezones as needed
 */
export const COMMON_TIMEZONES = [
  // US Timezones
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
  { value: 'America/Phoenix', label: 'Arizona (MST, no DST)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9/-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },

  // Additional US territories
  { value: 'America/Puerto_Rico', label: 'Puerto Rico (AST)', offset: 'UTC-4' },
  { value: 'Pacific/Guam', label: 'Guam (ChST)', offset: 'UTC+10' },

  // Common international timezones (if needed)
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: 'UTC+1/+2' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)', offset: 'UTC+10/+11' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 'UTC+0' },
];

class TimezoneService {
  /**
   * Get a user's timezone from the database
   * Returns 'America/New_York' as default if user not found or timezone not set
   */
  async getUserTimezone(userId: string): Promise<string> {
    try {
      const user = await storage.getUserById(userId);
      return user?.timezone || 'America/New_York';
    } catch (error) {
      console.error(`[Timezone] Error fetching timezone for user ${userId}:`, error);
      return 'America/New_York'; // Fallback to Eastern time
    }
  }

  /**
   * Get a user's timezone by email
   * Returns 'America/New_York' as default if user not found or timezone not set
   */
  async getUserTimezoneByEmail(email: string): Promise<string> {
    try {
      const user = await storage.getUserByEmail(email);
      return user?.timezone || 'America/New_York';
    } catch (error) {
      console.error(`[Timezone] Error fetching timezone for user ${email}:`, error);
      return 'America/New_York'; // Fallback to Eastern time
    }
  }

  /**
   * Convert a date to a specific timezone
   * Returns the date formatted as ISO string but in the target timezone context
   */
  convertToTimezone(date: Date, timezone: string): Date {
    // Create a formatter for the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Format the date in the target timezone
    const parts = formatter.formatToParts(date);
    const values: { [key: string]: string } = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        values[part.type] = part.value;
      }
    });

    // Construct a new date from the timezone-specific parts
    return new Date(
      `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
    );
  }

  /**
   * Format a date in a user's timezone
   * Returns a human-readable date/time string
   */
  formatInTimezone(date: Date, timezone: string, options?: Intl.DateTimeFormatOptions): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      ...options,
    };

    return date.toLocaleString('en-US', defaultOptions);
  }

  /**
   * Format a date for a specific user (by ID)
   * Automatically fetches the user's timezone
   */
  async formatForUser(date: Date, userId: string, options?: Intl.DateTimeFormatOptions): Promise<string> {
    const timezone = await this.getUserTimezone(userId);
    return this.formatInTimezone(date, timezone, options);
  }

  /**
   * Format a date for a specific user (by email)
   * Automatically fetches the user's timezone
   */
  async formatForUserByEmail(date: Date, email: string, options?: Intl.DateTimeFormatOptions): Promise<string> {
    const timezone = await this.getUserTimezoneByEmail(email);
    return this.formatInTimezone(date, timezone, options);
  }

  /**
   * Format just the date (no time) in a user's timezone
   */
  formatDateOnly(date: Date, timezone: string): string {
    return this.formatInTimezone(date, timezone, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZoneName: undefined,
      hour: undefined,
      minute: undefined,
    });
  }

  /**
   * Format just the time (no date) in a user's timezone
   */
  formatTimeOnly(date: Date, timezone: string): string {
    return this.formatInTimezone(date, timezone, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      weekday: undefined,
      year: undefined,
      month: undefined,
      day: undefined,
    });
  }

  /**
   * Get timezone abbreviation (e.g., "EST", "PST")
   */
  getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || timezone;
  }

  /**
   * Check if a timezone is valid
   */
  isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all available timezones (returns the common list)
   */
  getAvailableTimezones() {
    return COMMON_TIMEZONES;
  }

  /**
   * Convert a date from one timezone to another
   * Useful for displaying the same moment in time across different timezones
   */
  convertBetweenTimezones(date: Date, fromTimezone: string, toTimezone: string): Date {
    // The date object already represents a moment in time
    // We just need to return it as-is since Date objects are timezone-agnostic
    // The formatting will handle the timezone display
    return date;
  }

  /**
   * Get offset hours between two timezones at a specific date
   */
  getTimezoneOffset(timezone: string, date: Date = new Date()): number {
    // Get the UTC offset for the timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });

    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');

    if (offsetPart && offsetPart.value.includes('GMT')) {
      const match = offsetPart.value.match(/GMT([+-]\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    // Fallback: calculate offset manually
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  }
}

export const timezoneService = new TimezoneService();
export default TimezoneService;
