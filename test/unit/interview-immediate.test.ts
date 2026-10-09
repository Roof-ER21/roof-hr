import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the actual HTTP handlers without a database, calendar or outbound email.
const mocks = vi.hoisted(() => ({
  candidate: { id: 'candidate', firstName: 'Test', lastName: 'Candidate', email: 'candidate@example.test', assignedTo: 'recruiter' },
  createInterview: vi.fn(),
  updateInterview: vi.fn(),
  sendEmail: vi.fn(),
  checkConflicts: vi.fn(),
  existing: { id: 'interview', candidateId: 'candidate', type: 'PHONE', scheduledDate: '2026-10-09T21:00:00.000Z', duration: 30 },
}));
vi.mock('../../server/storage', () => ({ storage: {
  getCandidateById: vi.fn(async () => mocks.candidate),
  createInterview: mocks.createInterview,
  updateInterview: mocks.updateInterview,
  getInterviewById: vi.fn(async () => mocks.existing),
  updateCandidate: vi.fn(),
  createCandidateNote: vi.fn(),
  createInterviewReminder: vi.fn(),
} }));
vi.mock('../../server/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'recruiter', role: req.headers['x-test-role'] || 'HR_ADMIN', email: 'hr@example.test' };
    next();
  },
  requireManager: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../server/services/calendar-conflict-detector', () => ({
  getConflictDetector: async () => ({ checkConflicts: mocks.checkConflicts, sendConflictAlerts: vi.fn() }),
}));
vi.mock('../../server/services/timezone-service', () => ({
  timezoneService: { getUserTimezoneByEmail: async () => 'America/New_York' },
}));
vi.mock('../../server/email-service', () => ({
  emailService: { sendEmail: mocks.sendEmail },
  EmailService: class { initialize = async () => {}; sendEmail = mocks.sendEmail; },
}));
import router from '../../server/routes/interviews';
const app = express();
app.use(express.json());
app.use('/api/interviews', router);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T19:00:45.000Z')); // 3:00:45 PM Eastern
  mocks.createInterview.mockImplementation(async data => ({ id: 'interview', ...data }));
  mocks.updateInterview.mockImplementation(async (_id, data) => ({ ...mocks.existing, ...data }));
  mocks.sendEmail.mockResolvedValue(true);
  mocks.checkConflicts.mockResolvedValue({ conflicts: [], warnings: [] });
});
afterEach(() => vi.useRealTimers());

const times = [
  ['current minute', '2026-10-09T19:00:00.000Z'],
  ['time selected five minutes before submitting', '2026-10-09T18:55:00.000Z'],
  ['fifteen minutes away', '2026-10-09T19:15:00.000Z'],
];
for (const [path, role] of [['schedule', 'HR_ADMIN'], ['sourcer-schedule', 'SOURCER']]) {
  describe(path, () => {
    it.each(times)('accepts %s and requests confirmation email', async (_label, scheduledDate) => {
      const res = await request(app).post(`/api/interviews/${path}`).set('x-test-role', role).send({
        candidateId: 'candidate', customInterviewerName: 'Test Interviewer', scheduledDate,
        type: 'PHONE', duration: 30, sendReminders: true, sendCalendarInvite: false,
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect((path === 'sourcer-schedule' ? res.body.interview : res.body).scheduledDate).toBe(scheduledDate);
      expect(mocks.checkConflicts).toHaveBeenCalled();
      expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: mocks.candidate.email }));
    });
  });
}
describe('rescheduling', () => {
  it.each(times)('accepts %s and requests notification email', async (_label, scheduledDate) => {
    const res = await request(app).post('/api/interviews/interview/reschedule').send({
      scheduledDate, sendCalendarInvite: false,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.interview.scheduledDate).toBe(scheduledDate);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: mocks.candidate.email }));
  });
});
