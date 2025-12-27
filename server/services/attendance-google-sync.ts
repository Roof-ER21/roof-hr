import { storage } from '../storage';
import { format } from 'date-fns';
import { googleSheetsService } from './google-sheets-service';
import type { AttendanceSession, AttendanceCheckIn } from '../../shared/schema';

/**
 * AttendanceGoogleSync - Syncs attendance data to Google Sheets
 */
export class AttendanceGoogleSync {
  private spreadsheetId: string | null = null;
  private initialized = false;

  async initialize(spreadsheetId?: string) {
    try {
      await googleSheetsService.initialize();

      if (spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
      } else {
        // Create a new attendance spreadsheet
        const spreadsheet = await googleSheetsService.createSpreadsheet(
          `ROOF-ER Attendance - ${format(new Date(), 'yyyy')}`,
          ['Sessions', 'Check-Ins', 'Monthly Summary']
        );
        this.spreadsheetId = spreadsheet.spreadsheetId;
      }

      this.initialized = true;
      console.log('[Attendance Google Sync] Initialized with spreadsheet:', this.spreadsheetId);
      return this.spreadsheetId;
    } catch (error) {
      console.error('[Attendance Google Sync] Initialization failed:', error);
      this.initialized = false;
      return null;
    }
  }

  async syncAttendanceSession(session: AttendanceSession & { checkIns?: AttendanceCheckIn[] }) {
    if (!this.initialized || !this.spreadsheetId) {
      console.log('[Attendance Google Sync] Not initialized, skipping sync');
      return;
    }

    try {
      // Get the creator's name
      const creator = await storage.getUserById(session.createdByUserId);
      const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown';

      // Get check-ins for this session
      const checkIns = session.checkIns || await storage.getCheckInsBySessionId(session.id);

      // Prepare session data row
      const sessionRow = [
        session.id,
        session.name,
        session.location,
        format(new Date(session.startsAt), 'yyyy-MM-dd HH:mm'),
        format(new Date(session.expiresAt), 'yyyy-MM-dd HH:mm'),
        session.status,
        creatorName,
        checkIns.length.toString(),
        session.notes || ''
      ];

      // Get existing sessions data
      let existingSessions: any[][] = [];
      try {
        existingSessions = await googleSheetsService.getSheetData(this.spreadsheetId, 'Sessions!A2:I');
      } catch {
        // Sheet might be empty
      }

      // Check if session already exists
      const sessionIndex = existingSessions.findIndex(row => row[0] === session.id);

      if (sessionIndex >= 0) {
        // Update existing session
        await googleSheetsService.writeToSpreadsheet(
          this.spreadsheetId,
          `Sessions!A${sessionIndex + 2}:I${sessionIndex + 2}`,
          [sessionRow]
        );
      } else {
        // Add headers if this is the first entry
        if (existingSessions.length === 0) {
          await googleSheetsService.writeToSpreadsheet(
            this.spreadsheetId,
            'Sessions!A1:I1',
            [['Session ID', 'Name', 'Location', 'Starts At', 'Expires At', 'Status', 'Created By', 'Check-Ins', 'Notes']]
          );
        }
        // Append new session
        await googleSheetsService.appendToSpreadsheet(
          this.spreadsheetId,
          'Sessions!A:I',
          [sessionRow]
        );
      }

      // Sync check-ins
      await this.syncCheckIns(session, checkIns);

      console.log(`[Attendance Google Sync] Synced session ${session.name} with ${checkIns.length} check-ins`);
    } catch (error) {
      console.error('[Attendance Google Sync] Session sync error:', error);
    }
  }

  async syncCheckIns(session: AttendanceSession, checkIns: AttendanceCheckIn[]) {
    if (!this.initialized || !this.spreadsheetId || checkIns.length === 0) {
      return;
    }

    try {
      // Get existing check-ins data
      let existingCheckIns: any[][] = [];
      try {
        existingCheckIns = await googleSheetsService.getSheetData(this.spreadsheetId, 'Check-Ins!A2:G');
      } catch {
        // Sheet might be empty
      }

      // Add headers if this is the first entry
      if (existingCheckIns.length === 0) {
        await googleSheetsService.writeToSpreadsheet(
          this.spreadsheetId,
          'Check-Ins!A1:G1',
          [['Check-In ID', 'Session ID', 'Session Name', 'Name', 'Email', 'Location', 'Checked In At']]
        );
      }

      // Prepare check-in rows
      const checkInRows = checkIns.map((checkIn) => [
        checkIn.id,
        session.id,
        session.name,
        checkIn.name,
        checkIn.email || '',
        checkIn.location,
        format(new Date(checkIn.checkedInAt), 'yyyy-MM-dd HH:mm:ss')
      ]);

      // Filter out already synced check-ins
      const existingIds = new Set(existingCheckIns.map(row => row[0]));
      const newCheckIns = checkInRows.filter(row => !existingIds.has(row[0]));

      if (newCheckIns.length > 0) {
        await googleSheetsService.appendToSpreadsheet(
          this.spreadsheetId,
          'Check-Ins!A:G',
          newCheckIns
        );
        console.log(`[Attendance Google Sync] Added ${newCheckIns.length} new check-ins`);
      }
    } catch (error) {
      console.error('[Attendance Google Sync] Check-ins sync error:', error);
    }
  }

  async generateMonthlySummary() {
    if (!this.initialized || !this.spreadsheetId) {
      return;
    }

    try {
      const currentMonth = format(new Date(), 'MMMM yyyy');
      const sessions = await storage.getAllAttendanceSessions();

      // Filter sessions for current month
      const monthlySessions = sessions.filter((session) => {
        const sessionDate = new Date(session.createdAt);
        return format(sessionDate, 'MMMM yyyy') === currentMonth;
      });

      // Calculate summary statistics per person (by name since userId can be null)
      const personStats: Map<string, { sessions: number; totalCheckIns: number }> = new Map();

      for (const session of monthlySessions) {
        const checkIns = await storage.getCheckInsBySessionId(session.id);

        for (const checkIn of checkIns) {
          const personKey = checkIn.name;

          if (!personStats.has(personKey)) {
            personStats.set(personKey, { sessions: 0, totalCheckIns: 0 });
          }

          const stats = personStats.get(personKey)!;
          stats.totalCheckIns++;
        }
      }

      // Count unique sessions per person
      for (const session of monthlySessions) {
        const checkIns = await storage.getCheckInsBySessionId(session.id);
        const uniqueNames = new Set(checkIns.map(c => c.name));

        uniqueNames.forEach(name => {
          const stats = personStats.get(name);
          if (stats) {
            stats.sessions++;
          }
        });
      }

      // Prepare summary data
      const summaryHeaders = [
        ['Monthly Attendance Summary', '', ''],
        ['Month:', currentMonth, ''],
        ['Total Sessions:', monthlySessions.length.toString(), ''],
        ['', '', ''],
        ['Name', 'Sessions Attended', 'Total Check-Ins']
      ];

      const personRows = Array.from(personStats.entries()).map(([name, stats]) => [
        name,
        stats.sessions.toString(),
        stats.totalCheckIns.toString()
      ]);

      // Write to Monthly Summary sheet
      await googleSheetsService.updateSheet(
        this.spreadsheetId,
        'Monthly Summary!A1',
        [...summaryHeaders, ...personRows]
      );

      console.log(`[Attendance Google Sync] Generated monthly summary for ${currentMonth}`);
      console.log(`  Total Sessions: ${monthlySessions.length}`);
      console.log(`  Unique Attendees: ${personStats.size}`);
    } catch (error) {
      console.error('[Attendance Google Sync] Monthly summary error:', error);
    }
  }

  getSpreadsheetId(): string | null {
    return this.spreadsheetId;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const attendanceGoogleSync = new AttendanceGoogleSync();
