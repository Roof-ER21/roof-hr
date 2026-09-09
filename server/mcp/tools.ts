/**
 * MCP tools — pass one, reads only. Consolidated to 12 cohesive tools across
 * the 11 MCP areas (down from 59 micro-tools).
 *
 * Every tool wraps Roof HR's own GET routes over loopback (see loopback.ts).
 * The tools dispatch based on arguments (e.g. view, id, report type) to call
 * the exact underlying routes and forward only whitelisted query parameters.
 * What a tool returns is always the route's own answer for this person.
 * Descriptions are written for an LLM agent to accurately select and parameterize.
 */

import type { Mcp21Tool } from '@omj21/mcp21';
import { loopbackGet, segment } from './loopback';
import type { McpArea } from './areas';

type Args = Record<string, unknown>;
type Props = Record<string, unknown>;

const STRING = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const BOOL = (description: string) => ({ type: 'boolean', description });
const ENUM = (description: string, values: string[]) => ({ type: 'string', description, enum: values });
const ID = (what: string) => STRING(`The ${what} id as it appears in Roof HR.`, { minLength: 1, maxLength: 128 });
const DATE = (description: string) => STRING(`${description} (ISO date, e.g. 2026-09-08).`, { maxLength: 40 });

const badId = (what: string) => ({ isError: true, text: `The ${what} id is not a valid id.` });

/**
 * A list answer the agent can actually read: what matched, what came back, and
 * the rows. Roof HR's list routes return everything ever recorded, so an
 * unpaged answer either blows the context or — worse — arrives whole and gets
 * skimmed, and the agent reports two of the three people who are out this
 * month. Cutting is fine; cutting silently is not, hence `totalMatching`.
 */
function page<T>(list: T[], limit: unknown, key: string, fallback = 50): Record<string, unknown> {
  const n = typeof limit === 'number' ? Math.min(Math.max(1, limit), 500) : fallback;
  const rows = list.slice(0, n);
  return { totalMatching: list.length, countReturned: rows.length, [key]: rows };
}

/** Does a row's [startDate, endDate] overlap the requested window? Inclusive both ends. */
function inWindow(row: { startDate?: unknown; endDate?: unknown }, from?: string, to?: string): boolean {
  const start = String(row.startDate ?? '').slice(0, 10);
  if (!start) return false;
  const end = String(row.endDate ?? '').slice(0, 10) || start;
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
}

/** The window a caller asked for: `month` ("2026-09") or explicit start/end. Unbounded when unasked. */
function windowFrom(args: Args): { from?: string; to?: string; label?: string } {
  const month = typeof args.month === 'string' && /^\d{4}-\d{2}$/.test(args.month) ? args.month : null;
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, label: month };
  }
  const from = typeof args.startDate === 'string' ? args.startDate.slice(0, 10) : undefined;
  const to = typeof args.endDate === 'string' ? args.endDate.slice(0, 10) : undefined;
  return { from, to, label: from || to ? `${from ?? 'any'}..${to ?? 'any'}` : undefined };
}

const byStartDate = (a: { startDate?: unknown }, b: { startDate?: unknown }) =>
  String(a.startDate ?? '').localeCompare(String(b.startDate ?? ''));

const RANGE_PROPS: Props = {
  period: ENUM('Preset window: 7d, 30d, 90d, year or all. Omit for the route default.', ['7d', '30d', '90d', 'year', 'all']),
  startDate: DATE('Start of a custom window'),
  endDate: DATE('End of a custom window'),
  assigneeId: STRING('Only candidates assigned to this user id, or "unassigned".', { maxLength: 128 }),
};
const RANGE_QUERY = ['period', 'startDate', 'endDate', 'assigneeId'] as const;

export const MCP_TOOLS: readonly Mcp21Tool<Args>[] = [
  // ── me (2 tools) ────────────────────────────────────────────────────────
  {
    name: 'me',
    area: 'me',
    access: 'read',
    description:
      'Who this token acts as: id, name, email, role, employment type, department, position and timezone. ' +
      'Call this first to learn the caller\'s own identity and user id for other tools.',
    inputSchema: { type: 'object', properties: {} },
    run: (ctx) => loopbackGet(ctx, { path: '/api/auth/me', args: {} }),
  },
  {
    name: 'my_portal',
    area: 'me',
    access: 'read',
    description:
      'This person\'s employee portal: dashboard summary, PTO balance, own PTO requests, team roster, ' +
      'upcoming events, pending actionable items, onboarding progress, or in-app notifications.',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM(
          'Portal section: "dashboard" (overview), "pto_balance", "pto_requests", "team", "upcoming_events", ' +
          '"pending_items", "onboarding", or "notifications". Defaults to "dashboard".',
          ['dashboard', 'pto_balance', 'pto_requests', 'team', 'upcoming_events', 'pending_items', 'onboarding', 'notifications'],
        ),
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? 'dashboard';
      switch (view) {
        case 'pto_balance':
          return loopbackGet(ctx, { path: '/api/employee-portal/pto-balance', args });
        case 'pto_requests':
          return loopbackGet(ctx, { path: '/api/employee-portal/my-pto', args });
        case 'team':
          return loopbackGet(ctx, { path: '/api/employee-portal/team', args });
        case 'upcoming_events':
          return loopbackGet(ctx, { path: '/api/employee-portal/upcoming-events', args });
        case 'pending_items':
          return loopbackGet(ctx, { path: '/api/employee-portal/pending-items', args });
        case 'onboarding':
          return loopbackGet(ctx, { path: '/api/employee-portal/onboarding', args });
        case 'notifications':
          return loopbackGet(ctx, { path: '/api/notifications', args });
        case 'dashboard':
        default:
          return loopbackGet(ctx, { path: '/api/employee-portal/dashboard', args });
      }
    },
  },

  // ── employees (1 tool) ──────────────────────────────────────────────────
  {
    name: 'employees',
    area: 'employees',
    access: 'read',
    description:
      'Employee directory, one employee, or HR notes on an employee. ' +
      'Pass `search` to find a person by name or email — that is how you turn a name someone said out loud into ' +
      'the employeeId every other tool asks for (do this first when the question names a person). ' +
      'With no arguments this is the whole company and comes back paged; narrow it with search, department or activeOnly.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: ID('employee'),
        view: ENUM('View to retrieve: "directory" (default; one employee when employeeId is given) or "notes" (HR notes on record, requires employeeId).', ['directory', 'notes']),
        search: STRING('Find a person by first name, last name, full name or email (case-insensitive substring).', { maxLength: 120 }),
        department: STRING('Only this department (case-insensitive exact match).', { maxLength: 80 }),
        activeOnly: BOOL('true = only currently active employees.'),
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Max employees to return (defaults to 50).' },
      },
    },
    run: (ctx, args) => {
      if (args.view === 'notes') {
        const id = segment(args.employeeId);
        if (!id) return Promise.resolve(badId('employee'));
        return loopbackGet(ctx, { path: `/api/employees/${id}/notes`, args });
      }
      const wantedId = args.employeeId ? String(args.employeeId).trim() : '';
      return loopbackGet(ctx, {
        path: '/api/users',
        args,
        pick: (json: unknown) => {
          if (!Array.isArray(json)) return json;
          let list = json as any[];
          if (wantedId) list = list.filter((u: any) => u.id === wantedId);
          const q = typeof args.search === 'string' ? args.search.trim().toLowerCase() : '';
          if (q) {
            list = list.filter((u: any) =>
              `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q));
          }
          const dept = typeof args.department === 'string' ? args.department.trim().toLowerCase() : '';
          if (dept) list = list.filter((u: any) => String(u.department ?? '').toLowerCase() === dept);
          if (args.activeOnly === true) list = list.filter((u: any) => u.isActive !== false);

          const rows = list.map((u: any) => ({
            id: u.id,
            name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
            email: u.email,
            role: u.role,
            department: u.department,
            position: u.position,
            employmentType: u.employmentType,
            hireDate: u.hireDate,
            isActive: u.isActive,
            phone: u.phone,
          }));
          if (wantedId) {
            return rows[0] ?? { employeeId: wantedId, notFound: 'No employee with that id is visible to this person.' };
          }
          return page(rows, args.limit, 'employees');
        },
      });
    },
  },

  // ── pto (1 tool) ────────────────────────────────────────────────────────
  {
    name: 'pto',
    area: 'pto',
    access: 'read',
    description:
      'Time off: who is out and when, how many days one person has left, and the policies behind both. ' +
      'view="calendar" answers "who is out this month" — pass `month` (or startDate/endDate), because the calendar ' +
      'holds every approved request the company has ever recorded and an unfiltered answer will miss people. ' +
      'view="balance" answers "how many PTO days does X have left"; look X up with the employees tool first to get their employeeId.',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM(
          'View to retrieve: "requests" (default, PTO requests visible to caller), "calendar" (company-wide approved time off), ' +
          '"balance" (days allocated, used and remaining for one person — employeeId, or omit for yourself), ' +
          '"company_policy" (default rules), "department_settings" (department policy overrides), ' +
          '"policies" (every individual policy row, managers only), "employee_policy" (same as "balance").',
          ['requests', 'calendar', 'balance', 'company_policy', 'department_settings', 'policies', 'employee_policy'],
        ),
        employeeId: ID('employee'),
        month: STRING('Restrict to one calendar month, as YYYY-MM (e.g. 2026-09). Use this for "this month" / "next month" questions.', { maxLength: 7 }),
        startDate: DATE('Window start — keeps time off that ends on or after this date'),
        endDate: DATE('Window end — keeps time off that starts on or before this date'),
        status: STRING('Only requests with this status, e.g. PENDING, APPROVED, DENIED (when view is "requests").', { maxLength: 40 }),
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Max rows to return (defaults to 100).' },
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? 'requests';
      const { from, to, label } = windowFrom(args);
      switch (view) {
        case 'calendar':
          return loopbackGet(ctx, {
            path: '/api/pto/calendar',
            args,
            pick: (json: unknown) => {
              if (!Array.isArray(json)) return json;
              const rows = (json as any[]).filter((p) => inWindow(p, from, to)).sort(byStartDate);
              return { window: label ?? 'all dates on record', ...page(rows, args.limit, 'timeOff', 100) };
            },
          });
        case 'company_policy':
          return loopbackGet(ctx, { path: '/api/pto/company-policy', args });
        case 'department_settings':
          return loopbackGet(ctx, { path: '/api/pto/department-settings', args });
        case 'policies':
          return loopbackGet(ctx, {
            path: '/api/pto-policies',
            args,
            pick: (json: unknown) => {
              if (!Array.isArray(json)) return json;
              const rows = (json as any[]).map((p: any) => ({
                employeeId: p.employeeId,
                policyLevel: p.policyLevel,
                totalDays: p.totalDays,
                usedDays: p.usedDays,
                remainingDays: p.remainingDays,
              }));
              return page(rows, args.limit, 'policies', 100);
            },
          });
        case 'balance':
        case 'employee_policy': {
          const wanted = args.employeeId ? String(args.employeeId).trim() : '';
          if (!wanted || wanted === ctx.auth.principal.id) {
            return loopbackGet(ctx, { path: '/api/employee-portal/pto-balance', args });
          }
          if (!segment(wanted)) return Promise.resolve(badId('employee'));
          // Deliberately NOT /api/pto-policies/employee/:id: that route CREATES a
          // default policy row when the employee has none (pto-policies.ts), and a
          // read tool must not leave a row behind. The manager-scoped list is the
          // same data without the write.
          return loopbackGet(ctx, {
            path: '/api/pto-policies',
            args,
            pick: (json: unknown) => {
              if (!Array.isArray(json)) return json;
              const row = (json as any[]).find((p: any) => p.employeeId === wanted);
              if (!row) {
                return {
                  employeeId: wanted,
                  notFound: 'No individual PTO policy is on file for that employee; the department or company default applies to them.',
                };
              }
              return {
                employeeId: row.employeeId,
                policyLevel: row.policyLevel,
                totalDays: row.totalDays,
                usedDays: row.usedDays,
                remainingDays: row.remainingDays,
                vacationDays: row.vacationDays,
                sickDays: row.sickDays,
                personalDays: row.personalDays,
                notes: row.notes,
              };
            },
          });
        }
        case 'requests':
        default:
          return loopbackGet(ctx, {
            path: '/api/pto',
            args,
            pick: (json: unknown) => {
              if (!Array.isArray(json)) return json;
              let list = json as any[];
              const wanted = args.employeeId ? String(args.employeeId).trim() : '';
              if (wanted) list = list.filter((p: any) => p.employeeId === wanted);
              const status = typeof args.status === 'string' ? args.status.trim().toUpperCase() : '';
              if (status) list = list.filter((p: any) => String(p.status ?? '').toUpperCase() === status);
              const rows = list
                .filter((p) => inWindow(p, from, to))
                .sort(byStartDate)
                .map((p: any) => ({
                  id: p.id,
                  employeeId: p.employeeId,
                  employeeName: p.employeeName,
                  type: p.type,
                  status: p.status,
                  startDate: p.startDate,
                  endDate: p.endDate,
                  days: p.days,
                  reason: p.reason,
                }));
              return { window: label ?? 'all dates on record', ...page(rows, args.limit, 'requests', 100) };
            },
          });
      }
    },
  },

  // ── attendance (1 tool) ─────────────────────────────────────────────────
  {
    name: 'attendance',
    area: 'attendance',
    access: 'read',
    description:
      'Attendance (QR check-in) sessions, individual session check-ins, and aggregate analytics. ' +
      'Requires facilities access. Omit arguments to list sessions (active=true filters open sessions).',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM('View to retrieve: "sessions" (default, list sessions), "session_detail" (requires sessionId), or "analytics".', ['sessions', 'session_detail', 'analytics']),
        sessionId: ID('attendance session'),
        active: BOOL('true = only sessions currently open (when view is "sessions").'),
        from: DATE('Start date for attendance analytics (ISO date)'),
        to: DATE('End date for attendance analytics (ISO date)'),
        location: STRING('Exact location name for attendance analytics.', { maxLength: 200 }),
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? (args.sessionId ? 'session_detail' : 'sessions');
      if (view === 'session_detail') {
        const id = segment(args.sessionId);
        if (!id) return Promise.resolve(badId('attendance session'));
        return loopbackGet(ctx, { path: `/api/attendance/sessions/${id}`, args });
      }
      if (view === 'analytics') {
        return loopbackGet(ctx, { path: '/api/attendance/analytics', args, query: ['from', 'to', 'location'] });
      }
      return loopbackGet(ctx, { path: '/api/attendance/sessions', args, query: ['active'] });
    },
  },

  // ── onboarding (1 tool) ─────────────────────────────────────────────────
  {
    name: 'onboarding',
    area: 'onboarding',
    access: 'read',
    description:
      'Onboarding workflows and task templates. By default lists onboarding instances in progress or completed. ' +
      'Can filter by employeeId or status, view instance steps, or view templates and template details.',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM(
          'View to retrieve: "instances" (default, workflows), "instance_detail" (requires id), "instance_steps" (requires id), ' +
          '"templates" (templates list), or "template_detail" (requires id).',
          ['instances', 'instance_detail', 'instance_steps', 'templates', 'template_detail'],
        ),
        id: ID('onboarding instance or template'),
        employeeId: ID('employee to filter workflows'),
        status: STRING('Workflow status, e.g. NOT_STARTED, IN_PROGRESS, COMPLETED.', { maxLength: 40 }),
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? (args.id ? 'instance_detail' : 'instances');
      switch (view) {
        case 'template_detail': {
          const id = segment(args.id);
          if (!id) return Promise.resolve(badId('onboarding template'));
          return loopbackGet(ctx, { path: `/api/onboarding-templates/${id}`, args });
        }
        case 'templates':
          return loopbackGet(ctx, { path: '/api/onboarding-templates', args });
        case 'instance_detail': {
          const id = segment(args.id);
          if (!id) return Promise.resolve(badId('onboarding instance'));
          return loopbackGet(ctx, { path: `/api/onboarding-instances/${id}`, args });
        }
        case 'instance_steps': {
          const id = segment(args.id);
          if (!id) return Promise.resolve(badId('onboarding instance'));
          return loopbackGet(ctx, { path: `/api/onboarding-instances/${id}/steps`, args });
        }
        case 'instances':
        default:
          return loopbackGet(ctx, { path: '/api/onboarding-instances', args, query: ['employeeId', 'status'] });
      }
    },
  },

  // ── documents (1 tool) ──────────────────────────────────────────────────
  {
    name: 'documents',
    area: 'documents',
    access: 'read',
    description:
      'Company documents, employee contracts, certificates of insurance (COI), and equipment agreements. ' +
      'Metadata only, no file bytes. Select type and optional id or employeeId.',
    inputSchema: {
      type: 'object',
      properties: {
        type: ENUM('Document category: "documents" (default, company docs), "contracts" (employee contracts), "coi" (certificates of insurance), or "equipment" (equipment agreements).', ['documents', 'contracts', 'coi', 'equipment']),
        id: ID('document, contract, or equipment agreement'),
        employeeId: ID('employee to filter COI records'),
      },
    },
    run: (ctx, args) => {
      const type = args.type ?? 'documents';
      switch (type) {
        case 'contracts': {
          if (args.id) {
            const id = segment(args.id);
            if (!id) return Promise.resolve(badId('contract'));
            return loopbackGet(ctx, { path: `/api/employee-contracts/${id}`, args });
          }
          return loopbackGet(ctx, { path: '/api/contracts', args });
        }
        case 'coi': {
          if (args.employeeId) {
            const id = segment(args.employeeId);
            if (!id) return Promise.resolve(badId('employee'));
            return loopbackGet(ctx, { path: `/api/coi-documents/employee/${id}`, args });
          }
          return loopbackGet(ctx, { path: '/api/coi-documents', args });
        }
        case 'equipment': {
          if (args.id) {
            const id = segment(args.id);
            if (!id) return Promise.resolve(badId('equipment agreement'));
            return loopbackGet(ctx, { path: `/api/equipment-agreements/${id}`, args });
          }
          return loopbackGet(ctx, { path: '/api/equipment-agreements', args });
        }
        case 'documents':
        default: {
          if (args.id) {
            const id = segment(args.id);
            if (!id) return Promise.resolve(badId('document'));
            return loopbackGet(ctx, { path: `/api/documents/${id}`, args });
          }
          return loopbackGet(ctx, { path: '/api/documents', args });
        }
      }
    },
  },

  // ── recruiting (1 tool) ─────────────────────────────────────────────────
  {
    name: 'recruiting',
    area: 'recruiting',
    access: 'read',
    description:
      'Recruiting pipeline: candidate roster, candidate notes/interviews, job postings, scheduled interviews, ' +
      'or interviewer availability slots.',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM(
          'Resource to query: "candidates" (default, pipeline), "candidate_detail" (one candidate, requires candidateId), ' +
          '"candidate_notes" (recruiter notes and interview write-ups on one candidate, requires candidateId), ' +
          '"candidate_interviews" (requires candidateId), "jobs" (job postings), "job_detail" (requires jobId), ' +
          '"interviews" (all interviews), "interview_detail" (requires interviewId), or "interviewer_availability" (requires interviewerId).',
          ['candidates', 'candidate_detail', 'candidate_notes', 'candidate_interviews', 'jobs', 'job_detail', 'interviews', 'interview_detail', 'interviewer_availability'],
        ),
        candidateId: ID('candidate'),
        jobId: ID('job posting'),
        interviewId: ID('interview'),
        interviewerId: ID('interviewer user'),
        includeArchived: BOOL('true = include archived candidates (when view is "candidates").'),
        status: STRING(
          'Filter by stage or status as shown in UI: "Phone Screening", "Called", "Interview Scheduled", ' +
          '"Decision Pending", "Hired", "Dead", or DB keys (APPLIED, SCREENING, INTERVIEW, OFFER, HIRED).',
          { maxLength: 60 },
        ),
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Max candidates to return (defaults to 50).' },
      },
    },
    run: (ctx, args) => {
      // A candidateId with no view used to fall through to the whole pipeline, which
      // answered a question about one person with a list starting at somebody else.
      const view = args.view ?? (args.candidateId ? 'candidate_detail' : 'candidates');
      switch (view) {
        case 'candidate_notes': {
          const id = segment(args.candidateId);
          if (!id) return Promise.resolve(badId('candidate'));
          return loopbackGet(ctx, { path: `/api/candidates/${id}/notes`, args });
        }
        case 'candidate_interviews': {
          const id = segment(args.candidateId);
          if (!id) return Promise.resolve(badId('candidate'));
          return loopbackGet(ctx, { path: `/api/interviews/candidate/${id}`, args });
        }
        case 'jobs':
          return loopbackGet(ctx, { path: '/api/job-postings', args });
        case 'job_detail': {
          const id = segment(args.jobId);
          if (!id) return Promise.resolve(badId('job posting'));
          return loopbackGet(ctx, { path: `/api/job-postings/${id}`, args });
        }
        case 'interviews':
          return loopbackGet(ctx, { path: '/api/interviews', args });
        case 'interview_detail': {
          const id = segment(args.interviewId);
          if (!id) return Promise.resolve(badId('interview'));
          return loopbackGet(ctx, { path: `/api/interviews/${id}`, args });
        }
        case 'interviewer_availability': {
          const id = segment(args.interviewerId);
          if (!id) return Promise.resolve(badId('interviewer'));
          return loopbackGet(ctx, { path: `/api/interview-availability/${id}`, args });
        }
        case 'candidate_detail':
        case 'candidates':
        default:
          return loopbackGet(ctx, {
            path: '/api/candidates',
            args,
            query: ['includeArchived'],
            pick: (json: unknown) => {
              if (!Array.isArray(json)) return json;
              let list = json as any[];
              const wantedId = view === 'candidate_detail' ? String(args.candidateId ?? '').trim() : '';
              if (wantedId) list = list.filter((c: any) => c.id === wantedId);

              const STAGE_TO_DB: Record<string, string[]> = {
                'phone screening': ['SCREENING'],
                'screening': ['SCREENING'],
                'called': ['APPLIED'],
                'applied': ['APPLIED'],
                'interview scheduled': ['INTERVIEW'],
                'interview': ['INTERVIEW'],
                'decision pending': ['OFFER'],
                'offer': ['OFFER'],
                'hired': ['HIRED'],
                'dead': ['DEAD', 'DEAD_BY_US', 'DEAD_BY_CANDIDATE', 'NO_SHOW'],
                'dead_by_us': ['DEAD_BY_US'],
                'dead_by_candidate': ['DEAD_BY_CANDIDATE'],
                'no_show': ['NO_SHOW'],
              };

              const DB_TO_STAGE: Record<string, string> = {
                SCREENING: 'Phone Screening',
                APPLIED: 'Called',
                INTERVIEW: 'Interview Scheduled',
                OFFER: 'Decision Pending',
                HIRED: 'Hired',
                DEAD_BY_US: 'Dead',
                DEAD_BY_CANDIDATE: 'Dead',
                NO_SHOW: 'Dead',
              };

              if (args.status) {
                const s = String(args.status).trim().toLowerCase();
                const dbStatuses = STAGE_TO_DB[s] || [s.toUpperCase()];
                list = list.filter((c: any) => dbStatuses.includes(c.status?.toUpperCase()));
              }
              const limit = typeof args.limit === 'number' ? Math.min(Math.max(1, args.limit), 500) : 50;
              const totalMatching = list.length;
              const sliced = list.slice(0, limit).map((c: any) => ({
                id: c.id,
                name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                position: c.position,
                stage: DB_TO_STAGE[c.status?.toUpperCase()] || c.stage || c.status,
                rawStatus: c.status,
                appliedDate: c.appliedDate,
                email: c.email,
                phone: c.phone,
                territory: c.territory?.name,
                sourcer: c.sourcer ? `${c.sourcer.firstName || ''} ${c.sourcer.lastName || ''}`.trim() : null,
              }));
              if (wantedId) {
                return sliced[0] ?? { candidateId: wantedId, notFound: 'No candidate with that id is visible to this person.' };
              }
              return { totalMatching, countReturned: sliced.length, candidates: sliced };
            },
          });
      }
    },
  },

  // ── meetings (1 tool) ───────────────────────────────────────────────────
  {
    name: 'meetings',
    area: 'meetings',
    access: 'read',
    description:
      'Scheduled meetings, personal invites, meeting rooms, and room availability checks. ' +
      'Default lists meetings with optional filters (organizerId, roomId, type, startDate, endDate, attendeeId).',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM(
          'Resource: "meetings" (default, list meetings), "my_meetings" (caller invited/organizes), ' +
          '"meeting_detail" (requires meetingId), "rooms" (meeting room list), or "room_availability" (requires roomId, startDate, endDate).',
          ['meetings', 'my_meetings', 'meeting_detail', 'rooms', 'room_availability'],
        ),
        meetingId: ID('meeting'),
        roomId: ID('meeting room'),
        organizerId: ID('organizer (user)'),
        attendeeId: ID('attendee (user)'),
        type: STRING('Meeting type.', { maxLength: 40 }),
        startDate: STRING('Window start (ISO date or date-time).', { maxLength: 40 }),
        endDate: STRING('Window end (ISO date or date-time).', { maxLength: 40 }),
        isActive: BOOL('true = only active meeting rooms (when view is "rooms").'),
        minCapacity: { type: 'integer', minimum: 1, maximum: 10000, description: 'Minimum seats for meeting rooms.' },
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? (args.meetingId ? 'meeting_detail' : 'meetings');
      switch (view) {
        case 'my_meetings':
          return loopbackGet(ctx, { path: '/api/meetings/my-meetings', args });
        case 'meeting_detail': {
          const id = segment(args.meetingId);
          if (!id) return Promise.resolve(badId('meeting'));
          return loopbackGet(ctx, { path: `/api/meetings/${id}`, args });
        }
        case 'rooms':
          return loopbackGet(ctx, { path: '/api/meeting-rooms', args, query: ['isActive', 'minCapacity'] });
        case 'room_availability': {
          const id = segment(args.roomId);
          if (!id) return Promise.resolve(badId('meeting room'));
          return loopbackGet(ctx, { path: `/api/meeting-rooms/${id}/availability`, args, query: ['startDate', 'endDate'] });
        }
        case 'meetings':
        default:
          return loopbackGet(ctx, {
            path: '/api/meetings',
            args,
            query: ['organizerId', 'roomId', 'type', 'startDate', 'endDate', 'attendeeId'],
          });
      }
    },
  },

  // ── territories (1 tool) ────────────────────────────────────────────────
  {
    name: 'territories',
    area: 'territories',
    access: 'read',
    description:
      'Sales territories: name, code, region, manager and active flag. ' +
      'Omit territoryId to list all territories, or provide territoryId for one specific territory.',
    inputSchema: {
      type: 'object',
      properties: {
        territoryId: ID('territory'),
      },
    },
    run: (ctx, args) => {
      if (args.territoryId) {
        const id = segment(args.territoryId);
        if (!id) return Promise.resolve(badId('territory'));
        return loopbackGet(ctx, { path: `/api/territories/${id}`, args });
      }
      return loopbackGet(ctx, { path: '/api/territories', args });
    },
  },

  // ── analytics (1 tool) ──────────────────────────────────────────────────
  {
    name: 'analytics',
    area: 'analytics',
    access: 'read',
    description:
      'HR and recruiting analytics for managers: dashboard summary (headcount/openings), HR trends (turnover/PTO), ' +
      'or recruiting funnel, pipeline, sources, and time-to-hire statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        report: ENUM(
          'Report: "dashboard" (default, HR dashboard summary), "hr_metrics" (headcount/PTO/turnover), ' +
          '"recruiting_overview" (candidates/offers/hires), "recruiting_pipeline" (pipeline stages), ' +
          '"recruiting_sources" (lead sources), or "recruiting_time_to_hire" (duration to hire).',
          ['dashboard', 'hr_metrics', 'recruiting_overview', 'recruiting_pipeline', 'recruiting_sources', 'recruiting_time_to_hire'],
        ),
        timeRange: ENUM('Window for hr_metrics: last7days, last30days (default), last90days or lastyear.', ['last7days', 'last30days', 'last90days', 'lastyear']),
        department: STRING('Department name for hr_metrics, or "all".', { maxLength: 80 }),
        ...RANGE_PROPS,
      },
    },
    run: (ctx, args) => {
      const report = args.report ?? 'dashboard';
      switch (report) {
        case 'hr_metrics':
          return loopbackGet(ctx, { path: '/api/analytics/metrics', args, query: ['timeRange', 'department'] });
        case 'recruiting_overview':
          return loopbackGet(ctx, { path: '/api/recruiting-analytics/overview', args, query: RANGE_QUERY });
        case 'recruiting_pipeline':
          return loopbackGet(ctx, { path: '/api/recruiting-analytics/pipeline', args, query: RANGE_QUERY });
        case 'recruiting_sources':
          return loopbackGet(ctx, { path: '/api/recruiting-analytics/sources', args, query: RANGE_QUERY });
        case 'recruiting_time_to_hire':
          return loopbackGet(ctx, { path: '/api/recruiting-analytics/time-to-hire', args, query: RANGE_QUERY });
        case 'dashboard':
        default:
          return loopbackGet(ctx, { path: '/api/dashboard/metrics', args });
      }
    },
  },

  // ── workflows (1 tool) ──────────────────────────────────────────────────
  {
    name: 'workflows',
    area: 'workflows',
    access: 'read',
    description:
      'Automation workflows, templates, steps, and past executions. By default lists workflows. ' +
      'Provide workflowId to view one workflow, its steps, or execution history.',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM(
          'View to retrieve: "workflows" (default, list workflows), "workflow_detail" (requires workflowId), ' +
          '"steps" (requires workflowId), "executions" (requires workflowId), or "templates" (workflow templates).',
          ['workflows', 'workflow_detail', 'steps', 'executions', 'templates'],
        ),
        workflowId: ID('workflow'),
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? (args.workflowId ? 'workflow_detail' : 'workflows');
      switch (view) {
        case 'templates':
          return loopbackGet(ctx, { path: '/api/workflow-templates', args });
        case 'workflow_detail': {
          const id = segment(args.workflowId);
          if (!id) return Promise.resolve(badId('workflow'));
          return loopbackGet(ctx, { path: `/api/workflows/${id}`, args });
        }
        case 'steps': {
          const id = segment(args.workflowId);
          if (!id) return Promise.resolve(badId('workflow'));
          return loopbackGet(ctx, { path: `/api/workflows/${id}/steps`, args });
        }
        case 'executions': {
          const id = segment(args.workflowId);
          if (!id) return Promise.resolve(badId('workflow'));
          return loopbackGet(ctx, { path: `/api/workflows/${id}/executions`, args });
        }
        case 'workflows':
        default:
          return loopbackGet(ctx, { path: '/api/workflows', args });
      }
    },
  },
];
