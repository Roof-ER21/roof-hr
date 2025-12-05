/**
 * Susan AI Personalization Engine
 * Personalizes responses based on user preferences and behavior
 */

import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { SusanContext } from './core';

export interface UserPreferences {
  userId: string;
  dailyBriefing: boolean;
  proactiveAssistance: boolean;
  communicationStyle: 'formal' | 'casual' | 'friendly';
  preferredGreeting: string;
  autoSuggestions: boolean;
  notificationFrequency: 'realtime' | 'hourly' | 'daily' | 'off';
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  focusAreas: string[];
}

export class PersonalizationEngine {
  private userPreferences: Map<string, UserPreferences> = new Map();
  private greetings = {
    formal: {
      morning: ['Good morning', 'Good morning, I hope you are well'],
      afternoon: ['Good afternoon', 'Good afternoon, I trust your day is going well'],
      evening: ['Good evening', 'Good evening, I hope you had a productive day']
    },
    casual: {
      morning: ['Morning!', 'Hey there, morning!'],
      afternoon: ['Hey!', 'Afternoon!'],
      evening: ['Evening!', 'Hey, hope your day was good!']
    },
    friendly: {
      morning: ['Good morning! Ready for a great day?', 'Morning! How can I help you today?'],
      afternoon: ['Good afternoon! How\'s your day going?', 'Hey there! What can I do for you?'],
      evening: ['Good evening! Wrapping up for the day?', 'Evening! How was your day?']
    }
  };

  /**
   * Load user preferences from database
   */
  async loadUserPreferences(): Promise<void> {
    console.log('[SUSAN-AI] Loading user personalization preferences...');
    // In production, load from database
    // For now, set default preferences
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string): UserPreferences {
    if (!this.userPreferences.has(userId)) {
      // Return default preferences
      this.userPreferences.set(userId, {
        userId,
        dailyBriefing: true,
        proactiveAssistance: true,
        communicationStyle: 'friendly',
        preferredGreeting: '',
        autoSuggestions: true,
        notificationFrequency: 'hourly',
        workingHours: {
          start: '09:00',
          end: '17:00',
          timezone: 'America/New_York'
        },
        focusAreas: []
      });
    }
    return this.userPreferences.get(userId)!;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<void> {
    const current = this.getUserPreferences(userId);
    const updated = { ...current, ...updates };
    this.userPreferences.set(userId, updated);
    
    // Save to database
    console.log(`[SUSAN-AI] Updated preferences for user ${userId}`);
  }

  /**
   * Personalize a response based on user preferences
   */
  async personalizeResponse(
    response: string,
    context: SusanContext
  ): Promise<string> {
    const prefs = this.getUserPreferences(context.userId);
    
    // Add personalized greeting if at the beginning of conversation
    if (context.sessionHistory.length <= 1) {
      const greeting = this.getPersonalizedGreeting(prefs, context);
      response = `${greeting} ${response}`;
    }

    // Adjust tone based on communication style
    response = this.adjustTone(response, prefs.communicationStyle);

    // Add proactive suggestions if enabled
    if (prefs.proactiveAssistance) {
      response = this.addProactiveSuggestions(response, context);
    }

    return response;
  }

  /**
   * Get personalized greeting based on time and preferences
   */
  private getPersonalizedGreeting(
    prefs: UserPreferences,
    context: SusanContext & { userName?: string }
  ): string {
    const hour = new Date().getHours();
    let timeOfDay: 'morning' | 'afternoon' | 'evening';
    
    if (hour < 12) {
      timeOfDay = 'morning';
    } else if (hour < 17) {
      timeOfDay = 'afternoon';
    } else {
      timeOfDay = 'evening';
    }

    const greetingOptions = this.greetings[prefs.communicationStyle][timeOfDay];
    const greeting = greetingOptions[Math.floor(Math.random() * greetingOptions.length)];

    // Add user name if available
    const userName = (context as any).userName || '';
    if (userName) {
      return `${greeting}, ${userName}!`;
    }

    return `${greeting}!`;
  }

  /**
   * Adjust response tone based on communication style
   */
  private adjustTone(response: string, style: string): string {
    switch (style) {
      case 'formal':
        // Make response more formal
        response = response
          .replace(/\bcan't\b/g, 'cannot')
          .replace(/\bwon't\b/g, 'will not')
          .replace(/\bI'll\b/g, 'I will')
          .replace(/\byou're\b/g, 'you are')
          .replace(/\bit's\b/g, 'it is');
        break;
      
      case 'casual':
        // Make response more casual
        response = response
          .replace(/\bHello\b/g, 'Hey')
          .replace(/\bGood day\b/g, 'Hey there');
        break;
      
      case 'friendly':
        // Already friendly by default
        break;
    }
    
    return response;
  }

  /**
   * Add proactive suggestions to response
   */
  private addProactiveSuggestions(
    response: string,
    context: SusanContext
  ): string {
    const suggestions: string[] = [];

    // Add role-based suggestions
    if (context.userRole === 'HR_MANAGER' || context.userRole === 'ADMIN') {
      // Only suggest scheduling interview for specific candidate-related actions
      if (response.toLowerCase().includes('new candidate') || 
          response.toLowerCase().includes('candidate created') ||
          response.toLowerCase().includes('candidate added') ||
          (response.toLowerCase().includes('candidate') && response.toLowerCase().includes('screening'))) {
        // More specific context - only when actually dealing with candidate creation or screening
        suggestions.push('Would you like me to schedule an interview?');
      }
      if (response.toLowerCase().includes('pto') && response.toLowerCase().includes('pending')) {
        suggestions.push('Should I review other pending PTO requests?');
      }
    }

    if (context.userRole === 'MANAGER') {
      if (response.toLowerCase().includes('team')) {
        suggestions.push('Would you like to see team performance metrics?');
      }
    }

    // Add suggestions to response if any
    if (suggestions.length > 0) {
      response += '\n\n' + suggestions.join(' ');
    }

    return response;
  }

  /**
   * Generate personalized daily briefing
   */
  generatePersonalizedBriefing(
    context: SusanContext,
    data: any
  ): string {
    const prefs = this.getUserPreferences(context.userId);
    const greeting = this.getPersonalizedGreeting(prefs, context);
    
    let briefing = `${greeting}\n\n📊 **Your Daily Briefing**\n\n`;

    // Add role-specific information
    if (context.userRole === 'HR_MANAGER' || context.userRole === 'ADMIN') {
      if (data.pendingPTO > 0) {
        briefing += `• **PTO Requests**: ${data.pendingPTO} pending approval\n`;
      }
      if (data.newCandidates > 0) {
        briefing += `• **New Candidates**: ${data.newCandidates} applications received\n`;
      }
      if (data.expiringSoon > 0) {
        briefing += `• **COI Expiring**: ${data.expiringSoon} documents expiring within 30 days\n`;
      }
    }

    if (context.userRole === 'MANAGER') {
      if (data.teamSize) {
        briefing += `• **Team Status**: ${data.teamSize} team members\n`;
      }
      if (data.pendingReviews > 0) {
        briefing += `• **Performance Reviews**: ${data.pendingReviews} pending\n`;
      }
    }

    // Common information for all users
    if (data.ptoBalance !== undefined) {
      briefing += `• **Your PTO Balance**: ${data.ptoBalance} days remaining\n`;
    }
    if (data.upcomingHolidays) {
      briefing += `• **Next Holiday**: ${data.upcomingHolidays}\n`;
    }

    // Add personalized focus areas
    if (prefs.focusAreas.length > 0) {
      briefing += `\n**Your Focus Areas**: ${prefs.focusAreas.join(', ')}\n`;
    }

    // Add motivational message based on style
    if (prefs.communicationStyle === 'friendly') {
      briefing += '\nLet me know if you need help with anything today! 🚀';
    } else if (prefs.communicationStyle === 'casual') {
      briefing += '\nReady to help whenever you need!';
    } else {
      briefing += '\nI am available to assist you throughout the day.';
    }

    return briefing;
  }

  /**
   * Check if user is within working hours
   */
  isWithinWorkingHours(userId: string): boolean {
    const prefs = this.getUserPreferences(userId);
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(prefs.workingHours.start.split(':')[0]);
    const endHour = parseInt(prefs.workingHours.end.split(':')[0]);
    
    return currentHour >= startHour && currentHour < endHour;
  }

  /**
   * Should show daily briefing
   */
  shouldShowDailyBriefing(userId: string): boolean {
    const prefs = this.getUserPreferences(userId);
    if (!prefs.dailyBriefing) return false;
    
    // Check if it's the start of the working day
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(prefs.workingHours.start.split(':')[0]);
    
    // Show briefing within first hour of work day
    return currentHour >= startHour && currentHour < startHour + 1;
  }

  /**
   * Get notification preference
   */
  getNotificationPreference(userId: string): string {
    return this.getUserPreferences(userId).notificationFrequency;
  }
}