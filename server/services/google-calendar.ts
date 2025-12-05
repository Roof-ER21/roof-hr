import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../middleware/logger';

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  attendees?: { email: string }[];
  sendNotifications?: boolean;
}

class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  private isInitialized: boolean = false;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URL || 'http://localhost:5000/api/auth/google/callback'
    );

    // Set credentials if refresh token is available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      this.isInitialized = true;
    }
  }

  async createEvent(event: CalendarEvent) {
    if (!this.isInitialized) {
      throw new Error('Google Calendar service not initialized. Please authenticate first.');
    }

    try {
      const eventData = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startTime,
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: event.endTime,
          timeZone: 'America/New_York'
        },
        attendees: event.attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        },
        sendNotifications: event.sendNotifications !== false
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventData,
        sendNotifications: true
      });

      logger.info(`Calendar event created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>) {
    if (!this.isInitialized) {
      throw new Error('Google Calendar service not initialized. Please authenticate first.');
    }

    try {
      const eventData: any = {};
      
      if (updates.summary) eventData.summary = updates.summary;
      if (updates.description) eventData.description = updates.description;
      if (updates.location) eventData.location = updates.location;
      if (updates.startTime) {
        eventData.start = {
          dateTime: updates.startTime,
          timeZone: 'America/New_York'
        };
      }
      if (updates.endTime) {
        eventData.end = {
          dateTime: updates.endTime,
          timeZone: 'America/New_York'
        };
      }
      if (updates.attendees) eventData.attendees = updates.attendees;

      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: eventData,
        sendNotifications: true
      });

      logger.info(`Calendar event updated: ${eventId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to update calendar event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string) {
    if (!this.isInitialized) {
      throw new Error('Google Calendar service not initialized. Please authenticate first.');
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendNotifications: true
      });

      logger.info(`Calendar event deleted: ${eventId}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete calendar event:', error);
      throw error;
    }
  }

  async listEvents(timeMin?: string, timeMax?: string) {
    if (!this.isInitialized) {
      throw new Error('Google Calendar service not initialized. Please authenticate first.');
    }

    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items;
    } catch (error) {
      logger.error('Failed to list calendar events:', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }
}

export const googleCalendarService = new GoogleCalendarService();