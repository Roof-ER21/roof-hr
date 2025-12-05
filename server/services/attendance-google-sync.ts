import { GoogleSyncEnhanced } from './google-sync-enhanced';
import { storage } from '../storage';
import { format } from 'date-fns';
import type { AttendanceSession, AttendanceCheckIn } from '../../shared/schema';

export class AttendanceGoogleSync {
  private googleSync: GoogleSyncEnhanced;
  private spreadsheetId: string | null = null;

  constructor(googleSync: GoogleSyncEnhanced) {
    this.googleSync = googleSync;
  }

  async initialize() {
    try {
      // Create attendance tracking spreadsheet
      const spreadsheetId = await this.googleSync.getOrCreateSpreadsheet('Attendance Tracking');
      this.spreadsheetId = spreadsheetId;

      // Create sheets for different views
      await this.googleSync.ensureSheetExists(spreadsheetId, 'Sessions');
      await this.googleSync.ensureSheetExists(spreadsheetId, 'Check-ins');
      await this.googleSync.ensureSheetExists(spreadsheetId, 'Monthly Summary');

      // Set up headers for Sessions sheet
      const sessionsHeaders = [
        ['Session ID', 'Session Name', 'Location', 'Created By', 'Status', 'Start Time', 'End Time', 'Total Check-ins', 'Notes', 'Created At', 'Updated At']
      ];
      await this.googleSync.updateSheetData(spreadsheetId, 'Sessions!A1:K1', sessionsHeaders);

      // Set up headers for Check-ins sheet
      const checkInsHeaders = [
        ['Check-in ID', 'Session Name', 'Attendee Name', 'Email', 'Location', 'Check-in Time', 'User Agent', 'IP Hash']
      ];
      await this.googleSync.updateSheetData(spreadsheetId, 'Check-ins!A1:H1', checkInsHeaders);

      console.log('[Attendance Google Sync] Initialized successfully');
    } catch (error) {
      console.error('[Attendance Google Sync] Initialization error:', error);
    }
  }

  async syncAttendanceSession(session: AttendanceSession & { checkIns?: AttendanceCheckIn[] }) {
    if (!this.spreadsheetId) {
      console.error('[Attendance Google Sync] Not initialized');
      return;
    }

    try {
      // Get the creator's name
      const creator = await storage.getUserById(session.createdByUserId);
      const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown';

      // Prepare session data
      const sessionRow = [
        session.id,
        session.name,
        session.location,
        creatorName,
        session.status,
        session.startsAt ? format(new Date(session.startsAt), 'yyyy-MM-dd HH:mm:ss') : '',
        session.expiresAt ? format(new Date(session.expiresAt), 'yyyy-MM-dd HH:mm:ss') : '',
        session.checkIns?.length || 0,
        session.notes || '',
        session.createdAt ? format(new Date(session.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
        session.updatedAt ? format(new Date(session.updatedAt), 'yyyy-MM-dd HH:mm:ss') : ''
      ];

      // Find or add the session row
      const sessionsData = await this.googleSync.getSheetData(this.spreadsheetId, 'Sessions!A:K');
      let rowIndex = sessionsData.findIndex(row => row[0] === session.id);

      if (rowIndex === -1) {
        // Add new row
        await this.googleSync.appendSheetData(this.spreadsheetId, 'Sessions!A:K', [sessionRow]);
      } else {
        // Update existing row
        const range = `Sessions!A${rowIndex + 1}:K${rowIndex + 1}`;
        await this.googleSync.updateSheetData(this.spreadsheetId, range, [sessionRow]);
      }

      // Sync check-ins if available
      if (session.checkIns && session.checkIns.length > 0) {
        await this.syncCheckIns(session);
      }

      console.log(`[Attendance Google Sync] Session ${session.name} synced to Google Sheets`);
    } catch (error) {
      console.error('[Attendance Google Sync] Session sync error:', error);
    }
  }

  async syncCheckIns(session: AttendanceSession & { checkIns?: AttendanceCheckIn[] }) {
    if (!this.spreadsheetId || !session.checkIns) {
      return;
    }

    try {
      const checkInRows = session.checkIns.map(checkIn => [
        checkIn.id,
        session.name,
        checkIn.name,
        checkIn.email || '',
        checkIn.location,
        checkIn.checkedInAt ? format(new Date(checkIn.checkedInAt), 'yyyy-MM-dd HH:mm:ss') : '',
        checkIn.userAgent || '',
        checkIn.ipHash || ''
      ]);

      // Append check-ins to the sheet
      for (const row of checkInRows) {
        // Check if check-in already exists
        const checkInsData = await this.googleSync.getSheetData(this.spreadsheetId, 'Check-ins!A:H');
        const exists = checkInsData.some(existingRow => existingRow[0] === row[0]);
        
        if (!exists) {
          await this.googleSync.appendSheetData(this.spreadsheetId, 'Check-ins!A:H', [row]);
        }
      }

      console.log(`[Attendance Google Sync] ${checkInRows.length} check-ins synced`);
    } catch (error) {
      console.error('[Attendance Google Sync] Check-ins sync error:', error);
    }
  }

  async generateMonthlySummary() {
    if (!this.spreadsheetId) {
      return;
    }

    try {
      const currentMonth = format(new Date(), 'MMMM yyyy');
      const sessions = await storage.getAllAttendanceSessions();
      
      // Filter sessions for current month
      const monthlySessions = sessions.filter(session => {
        const sessionDate = new Date(session.createdAt);
        return format(sessionDate, 'MMMM yyyy') === currentMonth;
      });

      // Calculate summary statistics
      const totalSessions = monthlySessions.length;
      const totalCheckIns = await Promise.all(
        monthlySessions.map(async (session) => {
          const checkIns = await storage.getCheckInsBySessionId(session.id);
          return checkIns.length;
        })
      );
      const totalAttendance = totalCheckIns.reduce((sum, count) => sum + count, 0);
      
      // Location breakdown
      const locationStats = {
        RICHMOND: monthlySessions.filter(s => s.location === 'RICHMOND').length,
        PHILLY: monthlySessions.filter(s => s.location === 'PHILLY').length,
        DMV: monthlySessions.filter(s => s.location === 'DMV').length
      };

      // Update monthly summary sheet
      const summaryData = [
        ['Monthly Attendance Summary - ' + currentMonth],
        [''],
        ['Total Sessions:', totalSessions],
        ['Total Attendance:', totalAttendance],
        ['Average Attendance per Session:', totalSessions ? Math.round(totalAttendance / totalSessions) : 0],
        [''],
        ['Sessions by Location:'],
        ['Richmond:', locationStats.RICHMOND],
        ['Philadelphia:', locationStats.PHILLY],
        ['DMV:', locationStats.DMV],
        [''],
        ['Last Updated:', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]
      ];

      // Clear existing summary and write new one
      await this.googleSync.clearSheetRange(this.spreadsheetId, 'Monthly Summary!A:B');
      await this.googleSync.updateSheetData(this.spreadsheetId, 'Monthly Summary!A1:B12', summaryData);

      console.log('[Attendance Google Sync] Monthly summary generated');
    } catch (error) {
      console.error('[Attendance Google Sync] Monthly summary error:', error);
    }
  }
}