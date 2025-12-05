import { google } from 'googleapis';
import { googleAuthService } from './google-auth';

class GoogleCalendarService {
  private calendar: any;

  async initialize() {
    try {
      await googleAuthService.initialize();
      const auth = googleAuthService.getAuthClient();
      this.calendar = google.calendar({ version: 'v3', auth });
      console.log('[Google Calendar] Service initialized with service account');
    } catch (error) {
      console.error('[Google Calendar] Failed to initialize:', error);
      throw error;
    }
  }

  async createEvent(options: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: Date;
    endDateTime: Date;
    attendees?: string[];
    sendNotifications?: boolean;
    reminders?: {
      useDefault: boolean;
      overrides?: Array<{ method: string; minutes: number }>;
    };
  }) {
    try {
      const event = {
        summary: options.summary,
        description: options.description,
        location: options.location,
        start: {
          dateTime: options.startDateTime.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: options.endDateTime.toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: options.attendees?.map(email => ({ email })),
        reminders: options.reminders || {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendNotifications: options.sendNotifications ?? true
      });

      console.log('[Google Calendar] Event created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('[Google Calendar] Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, updates: any) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: updates
      });
      return response.data;
    } catch (error) {
      console.error('[Google Calendar] Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });
      console.log('[Google Calendar] Event deleted:', eventId);
    } catch (error) {
      console.error('[Google Calendar] Error deleting event:', error);
      throw error;
    }
  }

  async getEvents(options: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    q?: string;
  } = {}) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: options.timeMin?.toISOString() || new Date().toISOString(),
        timeMax: options.timeMax?.toISOString(),
        maxResults: options.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime',
        q: options.q
      });

      return response.data.items;
    } catch (error) {
      console.error('[Google Calendar] Error fetching events:', error);
      throw error;
    }
  }
  
  async listCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('[Google Calendar] Error listing calendars:', error);
      throw error;
    }
  }
  
  async createCalendar(options: {
    summary: string;
    description?: string;
    timeZone?: string;
  }) {
    try {
      const response = await this.calendar.calendars.insert({
        resource: {
          summary: options.summary,
          description: options.description,
          timeZone: options.timeZone || 'America/New_York'
        }
      });
      
      console.log('[Google Calendar] Calendar created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('[Google Calendar] Error creating calendar:', error);
      throw error;
    }
  }
  
  async getEvent(calendarId: string, eventId: string) {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });
      return response.data;
    } catch (error) {
      console.error('[Google Calendar] Error getting event:', error);
      throw error;
    }
  }
  
  async updateEventWithId(calendarId: string, eventId: string, updates: any) {
    try {
      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        resource: updates
      });
      return response.data;
    } catch (error) {
      console.error('[Google Calendar] Error updating event:', error);
      throw error;
    }
  }
  
  async createEventWithId(calendarId: string, event: any) {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        resource: event,
        sendNotifications: true
      });
      
      console.log('[Google Calendar] Event created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('[Google Calendar] Error creating event:', error);
      throw error;
    }
  }

  async checkAvailability(options: {
    startTime: Date;
    endTime: Date;
    attendees?: string[];
  }) {
    try {
      const timeMin = options.startTime.toISOString();
      const timeMax = options.endTime.toISOString();
      
      const items = options.attendees?.map(email => ({ id: email })) || [{ id: 'primary' }];

      const response = await this.calendar.freebusy.query({
        resource: {
          timeMin,
          timeMax,
          items
        }
      });

      const busySlots = [];
      for (const [calendar, data] of Object.entries(response.data.calendars || {})) {
        const calendarData = data as any;
        if (calendarData.busy && calendarData.busy.length > 0) {
          busySlots.push({
            calendar,
            busy: calendarData.busy
          });
        }
      }

      return {
        isAvailable: busySlots.length === 0,
        busySlots
      };
    } catch (error) {
      console.error('[Google Calendar] Error checking availability:', error);
      throw error;
    }
  }

  // Create a Google Meet link without a full calendar event
  async createMeetingLink(options: {
    summary?: string;
    startDateTime?: Date;
    durationMinutes?: number;
  } = {}) {
    try {
      if (!this.calendar) {
        await this.initialize();
      }

      const startDateTime = options.startDateTime || new Date();
      const endDateTime = new Date(startDateTime.getTime() + (options.durationMinutes || 60) * 60000);

      const event = {
        summary: options.summary || 'Video Interview',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/New_York'
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1
      });

      const meetLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri;

      if (!meetLink) {
        throw new Error('Google Meet link was not generated. Check Google Workspace settings.');
      }

      console.log('[Google Calendar] Google Meet link created:', meetLink);
      return {
        meetingLink: meetLink,
        eventId: response.data.id,
        event: response.data
      };
    } catch (error: any) {
      console.error('[Google Calendar] Error creating Google Meet link:', error);
      throw error;
    }
  }

  // Create calendar event with Google Meet conferencing
  async createEventWithMeet(options: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: Date;
    endDateTime: Date;
    attendees?: string[];
    sendNotifications?: boolean;
  }) {
    try {
      if (!this.calendar) {
        await this.initialize();
      }

      const event = {
        summary: options.summary,
        description: options.description,
        location: options.location,
        start: {
          dateTime: options.startDateTime.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: options.endDateTime.toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: options.attendees?.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 }
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendNotifications: options.sendNotifications ?? true,
        conferenceDataVersion: 1
      });

      console.log('[Google Calendar] Event with Meet created:', response.data.id);
      return {
        ...response.data,
        meetLink: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri
      };
    } catch (error) {
      console.error('[Google Calendar] Error creating event with Meet:', error);
      throw error;
    }
  }

  async createInterviewEvent(candidate: any, interviewDetails: {
    date: Date;
    duration: number; // in minutes
    interviewers: string[];
    type: 'phone' | 'video' | 'in-person';
    location?: string;
    meetingLink?: string;
  }) {
    const startDateTime = new Date(interviewDetails.date);
    const endDateTime = new Date(startDateTime.getTime() + interviewDetails.duration * 60000);

    const description = `
Interview Type: ${interviewDetails.type}
Candidate: ${candidate.name}
Position: ${candidate.position}
Email: ${candidate.email}
Phone: ${candidate.phone || 'N/A'}
${interviewDetails.meetingLink ? `Meeting Link: ${interviewDetails.meetingLink}` : ''}

Notes:
- Please review the candidate's resume before the interview
- Prepare questions based on the position requirements
- Use the HR system to record interview feedback
    `.trim();

    return this.createEvent({
      summary: `Interview: ${candidate.name} - ${candidate.position}`,
      description,
      location: interviewDetails.location || (interviewDetails.meetingLink || 'TBD'),
      startDateTime,
      endDateTime,
      attendees: [candidate.email, ...interviewDetails.interviewers],
      sendNotifications: true,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'email', minutes: 60 }, // 1 hour before
          { method: 'popup', minutes: 15 } // 15 minutes before
        ]
      }
    });
  }
}

export const googleCalendarService = new GoogleCalendarService();
export default GoogleCalendarService;