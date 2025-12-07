import { storage } from '../../storage';
import type { AttendanceSession, AttendanceCheckIn } from '../../../shared/schema';
import { format, differenceInMinutes, startOfWeek, endOfWeek } from 'date-fns';

export class AttendanceManager {
  async getAttendanceData(params?: {
    sessionId?: string;
    location?: 'RICHMOND' | 'PHILLY' | 'DMV';
    dateRange?: { start: Date; end: Date };
  }) {
    try {
      if (params?.sessionId) {
        // Get specific session with details
        const session = await storage.getAttendanceSessionById(params.sessionId);
        if (!session) {
          return { error: 'Session not found' };
        }
        
        const checkIns = await storage.getCheckInsBySessionId(params.sessionId);
        const creator = await storage.getUserById(session.createdByUserId);
        
        return {
          session: {
            ...session,
            creatorName: creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown',
            checkIns,
            totalAttendance: checkIns.length,
            duration: differenceInMinutes(new Date(session.expiresAt), new Date(session.startsAt))
          }
        };
      }

      // Get sessions with optional filters
      let sessions = await storage.getAllAttendanceSessions();
      
      if (params?.location) {
        sessions = sessions.filter(s => s.location === params.location);
      }
      
      if (params?.dateRange) {
        sessions = sessions.filter(s => {
          const sessionDate = new Date(s.createdAt);
          return sessionDate >= params.dateRange!.start && sessionDate <= params.dateRange!.end;
        });
      }

      // Enrich sessions with attendance counts
      const enrichedSessions = await Promise.all(
        sessions.map(async (session) => {
          const checkIns = await storage.getCheckInsBySessionId(session.id);
          return {
            ...session,
            totalAttendance: checkIns.length
          };
        })
      );

      return { sessions: enrichedSessions };
    } catch (error) {
      console.error('[Susan AI - Attendance] Error fetching data:', error);
      return { error: 'Failed to fetch attendance data' };
    }
  }

  async getAttendanceStats(location?: 'RICHMOND' | 'PHILLY' | 'DMV') {
    try {
      const allSessions = await storage.getAllAttendanceSessions();
      const sessions = location 
        ? allSessions.filter(s => s.location === location)
        : allSessions;

      // Calculate statistics
      const totalSessions = sessions.length;
      const activeSessions = sessions.filter(s => s.status === 'ACTIVE').length;
      
      // Get total attendance across all sessions
      const attendanceCounts = await Promise.all(
        sessions.map(async (session) => {
          const checkIns = await storage.getCheckInsBySessionId(session.id);
          return checkIns.length;
        })
      );
      
      const totalAttendance = attendanceCounts.reduce((sum, count) => sum + count, 0);
      const avgAttendance = totalSessions > 0 ? Math.round(totalAttendance / totalSessions) : 0;
      
      // This week's stats
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      const weekSessions = sessions.filter(s => {
        const sessionDate = new Date(s.createdAt);
        return sessionDate >= weekStart && sessionDate <= weekEnd;
      });

      return {
        totalSessions,
        activeSessions,
        totalAttendance,
        avgAttendancePerSession: avgAttendance,
        thisWeekSessions: weekSessions.length,
        locationBreakdown: {
          RICHMOND: sessions.filter(s => s.location === 'RICHMOND').length,
          PHILLY: sessions.filter(s => s.location === 'PHILLY').length,
          DMV: sessions.filter(s => s.location === 'DMV').length
        }
      };
    } catch (error) {
      console.error('[Susan AI - Attendance] Error calculating stats:', error);
      return null;
    }
  }

  async searchAttendee(name: string) {
    try {
      // Search for an attendee across all sessions
      // Get all sessions first, then get all check-ins
      const allSessions = await storage.getAllAttendanceSessions();
      const allCheckInsArrays = await Promise.all(
        allSessions.map(session => storage.getCheckInsBySessionId(session.id))
      );
      const allCheckIns = allCheckInsArrays.flat();

      const matches = allCheckIns.filter((checkIn: AttendanceCheckIn) =>
        checkIn.name.toLowerCase().includes(name.toLowerCase())
      );

      if (matches.length === 0) {
        return { message: `No attendance records found for "${name}"` };
      }

      // Get session details for each check-in
      const attendanceHistory = await Promise.all(
        matches.map(async (checkIn: AttendanceCheckIn) => {
          const session = await storage.getAttendanceSessionById(checkIn.sessionId);
          return {
            sessionName: session?.name || 'Unknown Session',
            location: checkIn.location,
            checkedInAt: format(new Date(checkIn.checkedInAt), 'MMM dd, yyyy h:mm a'),
            sessionDate: session?.startsAt ? format(new Date(session.startsAt), 'MMM dd, yyyy') : 'Unknown'
          };
        })
      );

      return {
        attendeeName: matches[0].name,
        email: matches[0].email,
        totalSessions: matches.length,
        history: attendanceHistory
      };
    } catch (error) {
      console.error('[Susan AI - Attendance] Error searching attendee:', error);
      return { error: 'Failed to search attendee' };
    }
  }

  async createSessionSummary(sessionId: string) {
    try {
      const session = await storage.getAttendanceSessionById(sessionId);
      if (!session) {
        return { error: 'Session not found' };
      }

      const checkIns = await storage.getCheckInsBySessionId(sessionId);
      const creator = await storage.getUserById(session.createdByUserId);

      // Generate summary text
      const summary = {
        sessionName: session.name,
        location: session.location,
        date: format(new Date(session.startsAt), 'MMMM dd, yyyy'),
        startTime: format(new Date(session.startsAt), 'h:mm a'),
        endTime: format(new Date(session.expiresAt), 'h:mm a'),
        duration: `${differenceInMinutes(new Date(session.expiresAt), new Date(session.startsAt))} minutes`,
        hostName: creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown',
        totalAttendance: checkIns.length,
        attendees: checkIns.map(c => ({
          name: c.name,
          email: c.email,
          checkInTime: format(new Date(c.checkedInAt), 'h:mm a')
        })),
        notes: session.notes || 'No notes recorded',
        status: session.status
      };

      return summary;
    } catch (error) {
      console.error('[Susan AI - Attendance] Error creating summary:', error);
      return { error: 'Failed to create session summary' };
    }
  }

  async getRecentSessions(limit: number = 5) {
    try {
      const sessions = await storage.getAllAttendanceSessions();
      const sortedSessions = sessions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      const recentSessions = await Promise.all(
        sortedSessions.map(async (session) => {
          const checkIns = await storage.getCheckInsBySessionId(session.id);
          return {
            id: session.id,
            name: session.name,
            location: session.location,
            status: session.status,
            date: format(new Date(session.startsAt), 'MMM dd, yyyy'),
            time: format(new Date(session.startsAt), 'h:mm a'),
            attendance: checkIns.length,
            notes: session.notes ? 'Has notes' : 'No notes'
          };
        })
      );

      return recentSessions;
    } catch (error) {
      console.error('[Susan AI - Attendance] Error fetching recent sessions:', error);
      return [];
    }
  }

  // Susan can provide insights about attendance patterns
  async analyzeAttendancePatterns() {
    try {
      const sessions = await storage.getAllAttendanceSessions();
      // Get all check-ins by getting them for each session
      const allCheckInsArrays = await Promise.all(
        sessions.map(session => storage.getCheckInsBySessionId(session.id))
      );
      const allCheckIns = allCheckInsArrays.flat();

      // Analyze patterns
      const patterns = {
        busiestLocation: this.getMostPopularLocation(sessions),
        peakAttendanceTimes: await this.getPeakAttendanceTimes(sessions),
        averageSessionDuration: this.getAverageDuration(sessions),
        totalUniqueAttendees: this.getUniqueAttendees(allCheckIns),
        sessionTrends: this.getSessionTrends(sessions)
      };

      return patterns;
    } catch (error) {
      console.error('[Susan AI - Attendance] Error analyzing patterns:', error);
      return null;
    }
  }

  private getMostPopularLocation(sessions: AttendanceSession[]) {
    const locationCounts = sessions.reduce((acc, session) => {
      acc[session.location] = (acc[session.location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const [location, count] = Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)[0] || ['Unknown', 0];

    return { location, sessionCount: count };
  }

  private async getPeakAttendanceTimes(sessions: AttendanceSession[]) {
    const hourCounts: Record<number, number> = {};
    
    sessions.forEach(session => {
      const hour = new Date(session.startsAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const sortedHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        timeRange: `${hour}:00 - ${parseInt(hour) + 1}:00`,
        sessionCount: count
      }));

    return sortedHours;
  }

  private getAverageDuration(sessions: AttendanceSession[]) {
    if (sessions.length === 0) return 0;
    
    const totalMinutes = sessions.reduce((sum, session) => {
      return sum + differenceInMinutes(new Date(session.expiresAt), new Date(session.startsAt));
    }, 0);

    return Math.round(totalMinutes / sessions.length);
  }

  private getUniqueAttendees(checkIns: AttendanceCheckIn[]) {
    const uniqueEmails = new Set(checkIns.filter(c => c.email).map(c => c.email));
    const uniqueNames = new Set(checkIns.map(c => c.name));
    
    return {
      byEmail: uniqueEmails.size,
      byName: uniqueNames.size
    };
  }

  private getSessionTrends(sessions: AttendanceSession[]) {
    // Group sessions by month
    const monthlyData: Record<string, number> = {};
    
    sessions.forEach(session => {
      const monthKey = format(new Date(session.createdAt), 'yyyy-MM');
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    // Calculate trend (increasing/decreasing)
    const months = Object.keys(monthlyData).sort();
    if (months.length < 2) {
      return { trend: 'insufficient data', monthlyData };
    }

    const lastMonth = monthlyData[months[months.length - 1]];
    const previousMonth = monthlyData[months[months.length - 2]];
    
    let trend = 'stable';
    if (lastMonth > previousMonth) trend = 'increasing';
    else if (lastMonth < previousMonth) trend = 'decreasing';

    return { trend, monthlyData, changePercent: previousMonth ? Math.round(((lastMonth - previousMonth) / previousMonth) * 100) : 0 };
  }
}