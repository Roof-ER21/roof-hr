/**
 * MCP tools — pass one, reads only.
 *
 * Every tool wraps ONE of Roof HR's own GET routes over loopback (see
 * loopback.ts). The comment on each names the route file and handler it wraps
 * and the query params that route actually reads; nothing else is forwarded.
 * What a tool returns is always the route's own answer for this person.
 * Descriptions are written for a model to act on.
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

/** A read tool over a fixed path with an optional query whitelist. */
function get(
  name: string,
  area: McpArea,
  description: string,
  path: string,
  properties: Props = {},
  query: readonly string[] = [],
  required: string[] = [],
): Mcp21Tool<Args> {
  return {
    name, area, description, access: 'read',
    inputSchema: { type: 'object', properties, ...(required.length ? { required } : {}) },
    run: (ctx, args) => loopbackGet(ctx, { path, args, query }),
  };
}

/** A read tool whose path takes ONE id argument (`idArg`), plus an optional query whitelist. */
function getById(
  name: string,
  area: McpArea,
  description: string,
  idArg: string,
  what: string,
  pathFor: (id: string) => string,
  properties: Props = {},
  query: readonly string[] = [],
  extraRequired: string[] = [],
): Mcp21Tool<Args> {
  return {
    name, area, description, access: 'read',
    inputSchema: {
      type: 'object',
      properties: { [idArg]: ID(what), ...properties },
      required: [idArg, ...extraRequired],
    },
    run: (ctx, args) => {
      const id = segment(args[idArg]);
      if (!id) return Promise.resolve(badId(what));
      return loopbackGet(ctx, { path: pathFor(id), args, query });
    },
  };
}

const RANGE_PROPS: Props = {
  period: ENUM('Preset window: 7d, 30d, 90d, year or all. Omit for the route default.', ['7d', '30d', '90d', 'year', 'all']),
  startDate: DATE('Start of a custom window'),
  endDate: DATE('End of a custom window'),
  assigneeId: STRING('Only candidates assigned to this user id, or "unassigned".', { maxLength: 128 }),
};
const RANGE_QUERY = ['period', 'startDate', 'endDate', 'assigneeId'] as const;

export const MCP_TOOLS: readonly Mcp21Tool<Args>[] = [
  // ── me ──────────────────────────────────────────────────────────────────
  // server/routes.ts → router.get('/api/auth/me') — no params
  get('me', 'me',
    'Who this token acts as: id, name, email, role, employment type, department, position and timezone. ' +
    'Call this first to learn the person\'s own user id for other tools.',
    '/api/auth/me'),
  // server/routes/employee-portal.ts → router.get('/api/employee-portal/dashboard') — no params
  get('my_dashboard', 'me',
    'This person\'s portal dashboard in one call: PTO balance and pending requests, upcoming approved time off, ' +
    'onboarding progress, pending documents and recent activity.',
    '/api/employee-portal/dashboard'),
  // server/routes/employee-portal.ts → router.get('/api/employee-portal/pto-balance') — no params
  get('my_pto_balance', 'me',
    'This person\'s PTO balance using the same policy hierarchy as the PTO page (individual, then department, then company): ' +
    'vacation, sick and personal days allotted, used and remaining.',
    '/api/employee-portal/pto-balance'),
  // server/routes/employee-portal.ts → router.get('/api/employee-portal/my-pto') — no params
  get('my_pto_requests', 'me',
    'This person\'s own PTO requests, newest first, with type, dates, status and reason.',
    '/api/employee-portal/my-pto'),
  // server/routes/employee-portal.ts → router.get('/api/employee-portal/team') — no params
  get('my_team', 'me',
    'Active teammates in this person\'s department (name, position, email, phone) and their manager.',
    '/api/employee-portal/team'),
  // server/routes/employee-portal.ts → router.get('/api/employee-portal/upcoming-events') — no params
  get('my_upcoming_events', 'me',
    'This person\'s upcoming events: approved time off, scheduled interviews they are on, and meetings.',
    '/api/employee-portal/upcoming-events'),
  // server/routes/employee-portal.ts → router.get('/api/employee-portal/pending-items') — no params
  get('my_pending_items', 'me',
    'What is waiting on this person: pending PTO requests, unsigned contracts, unacknowledged documents and open onboarding steps.',
    '/api/employee-portal/pending-items'),
  // server/routes/onboarding-templates.ts → router.get('/api/employee-portal/onboarding') — no params
  get('my_onboarding', 'me',
    'This person\'s own onboarding: each workflow or instance with its template, steps and completion state.',
    '/api/employee-portal/onboarding'),
  // server/routes.ts → app.get('/api/notifications') — no params
  get('my_notifications', 'me',
    'This person\'s in-app notifications with read/unread state, newest first.',
    '/api/notifications'),

  // ── employees ───────────────────────────────────────────────────────────
  // server/routes.ts → router.get('/api/users') — no params. Managers, admins and
  // lead sourcers get full rows (email, department, hire date, phone…); everyone
  // else gets name, role and position only. The route decides, not this tool.
  get('employees_list', 'employees',
    'The employee directory as this person\'s role sees it: id, name, role, department, position, employment type, ' +
    'hire date, phone and active flag for managers; name, role and position for everyone else. Use the id with other tools.',
    '/api/users'),
  // server/routes.ts → router.get('/api/employees/:employeeId/notes') — own notes or manager/admin
  getById('employee_notes', 'employees',
    'Notes on an employee\'s record (managers and admins, or the person\'s own). Author, category, text and date.',
    'employeeId', 'employee', (id) => `/api/employees/${id}/notes`),

  // ── pto ─────────────────────────────────────────────────────────────────
  // server/routes.ts → router.get('/api/pto') — no params. Admins, managers and
  // core PTO approvers (authzService.canApprovePtoRequests) get everyone's
  // requests; a department approver gets that department; everyone else their own.
  get('pto_requests', 'pto',
    'PTO requests this person can see (all of them for managers and PTO approvers, their department for a department ' +
    'approver, otherwise only their own): employee, type, dates, days, status, reason, approver and timestamps.',
    '/api/pto'),
  // server/routes.ts → router.get('/api/pto/calendar') — no params
  get('pto_calendar', 'pto',
    'Company-wide APPROVED time off for the calendar: who is out and when (name and dates; approvers also see type and reason).',
    '/api/pto/calendar'),
  // server/routes/pto-policies.ts → router.get('/api/pto/company-policy') — no params
  get('pto_company_policy', 'pto',
    'The company PTO policy: default vacation, sick and personal days, accrual and carry-over rules.',
    '/api/pto/company-policy'),
  // server/routes/pto-policies.ts → router.get('/api/pto/department-settings') — no params
  get('pto_department_settings', 'pto',
    'Per-department PTO settings that override the company policy (days per type, exemptions).',
    '/api/pto/department-settings'),
  // server/routes/pto-policies.ts → router.get('/api/pto-policies') — requireManager, no params
  get('pto_policies', 'pto',
    'Every employee\'s individual PTO policy row: allotted and used days per type and the year (managers only; others get a refusal).',
    '/api/pto-policies'),
  // server/routes/pto-policies.ts → router.get('/api/pto-policies/employee/:employeeId') — own, or manager for anyone
  getById('pto_employee_policy', 'pto',
    'One employee\'s PTO policy and balance (own, or any employee for managers). Falls back to the department/company default when none is set.',
    'employeeId', 'employee', (id) => `/api/pto-policies/employee/${id}`),

  // ── attendance ──────────────────────────────────────────────────────────
  // server/routes/attendance.ts → router.get('/sessions') (mounted at /api/attendance) — requireFacilitiesAccess
  // reads: active ("true" = only active sessions)
  get('attendance_sessions', 'attendance',
    'Attendance (QR check-in) sessions: name, location, date, active flag and check-in URL. active=true for only the open ones.',
    '/api/attendance/sessions',
    { active: BOOL('true = only sessions that are currently open.') }, ['active']),
  // server/routes/attendance.ts → router.get('/sessions/:id') — requireAuth
  getById('attendance_session', 'attendance',
    'One attendance session with every check-in (who, when, method).',
    'id', 'attendance session', (id) => `/api/attendance/sessions/${id}`),
  // server/routes/attendance.ts → router.get('/analytics') — requireFacilitiesAccess
  // reads: from, to (dates on session createdAt), location
  get('attendance_analytics', 'attendance',
    'Attendance analytics: sessions, check-in totals and trends, optionally within a date window or for one location.',
    '/api/attendance/analytics',
    { from: DATE('Only sessions created on/after this date'), to: DATE('Only sessions created on/before this date'), location: STRING('Exact location name.', { maxLength: 200 }) },
    ['from', 'to', 'location']),

  // ── onboarding ──────────────────────────────────────────────────────────
  // server/routes/onboarding-templates.ts → router.get('/api/onboarding-templates') — no params
  get('onboarding_templates', 'onboarding',
    'Onboarding templates: name, description, target role/department and their task list.',
    '/api/onboarding-templates'),
  // server/routes/onboarding-templates.ts → router.get('/api/onboarding-templates/:id')
  getById('onboarding_template', 'onboarding',
    'One onboarding template with its ordered tasks.',
    'id', 'onboarding template', (id) => `/api/onboarding-templates/${id}`),
  // server/routes/onboarding-templates.ts → router.get('/api/onboarding-instances')
  // reads: employeeId, status
  get('onboarding_instances', 'onboarding',
    'Onboarding workflows in progress or done: employee, template, status, start and due dates. Filter by employeeId or status.',
    '/api/onboarding-instances',
    { employeeId: ID('employee'), status: STRING('Workflow status, e.g. NOT_STARTED, IN_PROGRESS, COMPLETED.', { maxLength: 40 }) },
    ['employeeId', 'status']),
  // server/routes/onboarding-templates.ts → router.get('/api/onboarding-instances/:id')
  getById('onboarding_instance', 'onboarding',
    'One onboarding workflow/instance with its progress summary.',
    'id', 'onboarding instance', (id) => `/api/onboarding-instances/${id}`),
  // server/routes/onboarding-templates.ts → router.get('/api/onboarding-instances/:id/steps')
  getById('onboarding_instance_steps', 'onboarding',
    'The steps of one onboarding workflow/instance with each step\'s status, assignee and completion date.',
    'id', 'onboarding instance', (id) => `/api/onboarding-instances/${id}/steps`),

  // ── documents ───────────────────────────────────────────────────────────
  // server/routes.ts → router.get('/api/documents') — no params; admins see all,
  // managers/employees see what their role may (visibility inside the route)
  get('documents_list', 'documents',
    'Company documents this person may see: title, category, visibility, version, file name and acknowledgement requirement. Metadata only, no file contents.',
    '/api/documents'),
  // server/routes/documents.ts → router.get('/:id') (mounted at /api/documents) — hasDocumentAccess by role
  getById('document', 'documents',
    'One company document\'s metadata (no file contents).',
    'id', 'document', (id) => `/api/documents/${id}`),
  // server/routes/contracts.ts → router.get('/api/contracts') — own; managers add direct reports and ones they created; admins all
  get('contracts_list', 'documents',
    'Employee contracts this person may see (own; managers also their direct reports\' and ones they sent; HR admins all): ' +
    'recipient, title, status (DRAFT, SENT, VIEWED, SIGNED, REJECTED…), sent/viewed/signed dates. No document bytes.',
    '/api/contracts'),
  // server/routes/contracts.ts → router.get('/api/employee-contracts/:id') — own / creator / direct report / admin
  getById('contract', 'documents',
    'One employee contract\'s record: recipient, template, status, dates, field values and signature metadata (no PDF).',
    'id', 'contract', (id) => `/api/employee-contracts/${id}`),
  // server/routes/coi-documents.ts → router.get('/api/coi-documents') — requireManager, no params
  get('coi_documents', 'documents',
    'Certificates of insurance on file (managers): contractor, carrier, policy type, effective and expiry dates and computed status.',
    '/api/coi-documents'),
  // server/routes/coi-documents.ts → router.get('/api/coi-documents/employee/:employeeId') — own or manager
  getById('coi_documents_for_employee', 'documents',
    'Certificates of insurance for one employee/contractor (own, or anyone for managers).',
    'employeeId', 'employee', (id) => `/api/coi-documents/employee/${id}`),
  // server/routes/equipment-agreements.ts → router.get('/api/equipment-agreements') — req.user only
  get('equipment_agreements', 'documents',
    'Equipment agreements: employee, items issued, status (PENDING, SIGNED, RETURNED…), sent and signed dates.',
    '/api/equipment-agreements'),
  // server/routes/equipment-agreements.ts → router.get('/api/equipment-agreements/:id')
  getById('equipment_agreement', 'documents',
    'One equipment agreement with its items and signature metadata.',
    'id', 'equipment agreement', (id) => `/api/equipment-agreements/${id}`),

  // ── recruiting ──────────────────────────────────────────────────────────
  // server/routes/job-postings.ts → router.get('/api/job-postings') — no params
  get('job_postings', 'recruiting',
    'Open and past job postings: title, department, location, status, description and Indeed publish state.',
    '/api/job-postings'),
  // server/routes/job-postings.ts → router.get('/api/job-postings/:id')
  getById('job_posting', 'recruiting',
    'One job posting in full: title, department, location, status, description and Indeed publish state.',
    'id', 'job posting', (id) => `/api/job-postings/${id}`),
  // server/routes.ts → router.get('/api/candidates') — reads: includeArchived ("true").
  // Managers and lead sourcers see all; everyone else only candidates assigned to them.
  get('candidates_list', 'recruiting',
    'Candidates this person can see (all for managers and lead recruiters, otherwise only ones assigned to them): ' +
    'name, contact, position, source, pipeline status, screening data, assignee and dates. includeArchived=true adds archived ones.',
    '/api/candidates',
    { includeArchived: BOOL('true = include archived candidates.') }, ['includeArchived']),
  // server/routes.ts → router.get('/api/candidates/:candidateId/notes') — manager/lead sourcer, or assigned
  getById('candidate_notes', 'recruiting',
    'Recruiter notes on one candidate (managers, lead recruiters, or the assigned sourcer).',
    'candidateId', 'candidate', (id) => `/api/candidates/${id}/notes`),
  // server/routes/interviews.ts → router.get('/') (mounted at /api/interviews) — no params
  get('interviews_list', 'recruiting',
    'All interviews with candidate, interviewer, type, scheduled date/time, status, and isOverdue/daysOverdue for scheduled ones in the past.',
    '/api/interviews'),
  // server/routes/interviews.ts → router.get('/:id')
  getById('interview', 'recruiting',
    'One interview with candidate, interviewer, schedule, status, feedback and panel members.',
    'id', 'interview', (id) => `/api/interviews/${id}`),
  // server/routes/interviews.ts → router.get('/candidate/:candidateId')
  getById('candidate_interviews', 'recruiting',
    'Every interview for one candidate.',
    'candidateId', 'candidate', (id) => `/api/interviews/candidate/${id}`),
  // server/routes/interview-scheduling.ts → router.get('/interview-availability/:interviewerId') (mounted at /api)
  getById('interviewer_availability', 'recruiting',
    'An interviewer\'s availability slots (weekday, start/end time, timezone) used for interview scheduling.',
    'interviewerId', 'interviewer (user)', (id) => `/api/interview-availability/${id}`),

  // ── meetings ────────────────────────────────────────────────────────────
  // server/routes/meetings.ts → router.get('/') (mounted at /api/meetings)
  // reads: organizerId, roomId, type, startDate, endDate, attendeeId
  get('meetings_list', 'meetings',
    'Meetings with organizer and room. Filter by organizerId, roomId, type, a startDate/endDate window or attendeeId.',
    '/api/meetings',
    {
      organizerId: ID('organizer (user)'), roomId: ID('meeting room'), type: STRING('Meeting type.', { maxLength: 40 }),
      startDate: DATE('Only meetings starting on/after'), endDate: DATE('Only meetings ending on/before'), attendeeId: ID('attendee (user)'),
    },
    ['organizerId', 'roomId', 'type', 'startDate', 'endDate', 'attendeeId']),
  // server/routes/meetings.ts → router.get('/my-meetings') — no params
  get('my_meetings', 'meetings',
    'Meetings this person organizes or is invited to, with their RSVP status.',
    '/api/meetings/my-meetings'),
  // server/routes/meetings.ts → router.get('/:id')
  getById('meeting', 'meetings',
    'One meeting with organizer, room, time window and attendees with their RSVP status.',
    'id', 'meeting', (id) => `/api/meetings/${id}`),
  // server/routes/meeting-rooms.ts → router.get('/') (mounted at /api/meeting-rooms) — reads: isActive, minCapacity
  get('meeting_rooms', 'meetings',
    'Meeting rooms: name, location, capacity, amenities and active flag. Filter with isActive and minCapacity.',
    '/api/meeting-rooms',
    { isActive: BOOL('true = only active rooms.'), minCapacity: { type: 'integer', minimum: 1, maximum: 10000, description: 'Minimum seats.' } },
    ['isActive', 'minCapacity']),
  // server/routes/meeting-rooms.ts → router.get('/:id/availability') — reads: startDate, endDate (both required)
  getById('meeting_room_availability', 'meetings',
    'Whether a room is free between startDate and endDate, with the meetings that conflict.',
    'id', 'meeting room', (id) => `/api/meeting-rooms/${id}/availability`,
    { startDate: STRING('Window start (ISO date-time).', { maxLength: 40 }), endDate: STRING('Window end (ISO date-time).', { maxLength: 40 }) },
    ['startDate', 'endDate'], ['startDate', 'endDate']),

  // ── territories ─────────────────────────────────────────────────────────
  // server/routes/territories.ts → router.get('/api/territories') — no params
  get('territories_list', 'territories',
    'Sales territories: name, code, region, manager and active flag.',
    '/api/territories'),
  // server/routes/territories.ts → router.get('/api/territories/:id')
  getById('territory', 'territories',
    'One territory in full: name, code, region, manager and active flag.',
    'id', 'territory', (id) => `/api/territories/${id}`),

  // ── analytics ───────────────────────────────────────────────────────────
  // server/routes.ts → router.get('/api/dashboard/metrics') — no params
  get('dashboard_metrics', 'analytics',
    'The HR dashboard numbers: headcount, active employees, pending PTO, open candidates, upcoming interviews and recent hires.',
    '/api/dashboard/metrics'),
  // server/routes/analytics.ts → router.get('/metrics') (mounted at /api/analytics) — requireManager
  // reads: timeRange (last7days|last30days|last90days|lastyear), department
  get('hr_analytics', 'analytics',
    'HR analytics for managers: hiring funnel, headcount by department, PTO usage and turnover over a time range, optionally for one department.',
    '/api/analytics/metrics',
    { timeRange: ENUM('Window: last7days, last30days (default), last90days or lastyear.', ['last7days', 'last30days', 'last90days', 'lastyear']), department: STRING('Department name, or "all".', { maxLength: 80 }) },
    ['timeRange', 'department']),
  // server/routes/recruiting-analytics.ts → router.get('/overview') (mounted at /api/recruiting-analytics)
  // reads: period, startDate, endDate, assigneeId (dateRangeSchema)
  get('recruiting_overview', 'analytics',
    'Recruiting analytics overview: candidates added, interviews held, offers and hires in the window, with conversion rates.',
    '/api/recruiting-analytics/overview', RANGE_PROPS, RANGE_QUERY),
  // server/routes/recruiting-analytics.ts → router.get('/pipeline') — same params
  get('recruiting_pipeline', 'analytics',
    'Recruiting pipeline counts per stage in the window.',
    '/api/recruiting-analytics/pipeline', RANGE_PROPS, RANGE_QUERY),
  // server/routes/recruiting-analytics.ts → router.get('/sources') — same params
  get('recruiting_sources', 'analytics',
    'Where candidates came from (Indeed, referral, website…) and how each source converts, in the window.',
    '/api/recruiting-analytics/sources', RANGE_PROPS, RANGE_QUERY),
  // server/routes/recruiting-analytics.ts → router.get('/time-to-hire') — same params
  get('recruiting_time_to_hire', 'analytics',
    'Time-to-hire statistics (average, median, by position) for hires in the window.',
    '/api/recruiting-analytics/time-to-hire', RANGE_PROPS, RANGE_QUERY),

  // ── workflows ───────────────────────────────────────────────────────────
  // server/routes/workflows.ts → router.get('/api/workflows') — no params
  get('workflows_list', 'workflows',
    'Automation workflows: name, trigger, status and creator.',
    '/api/workflows'),
  // server/routes/workflows.ts → router.get('/api/workflows/:id')
  getById('workflow', 'workflows',
    'One workflow in full: name, trigger, status, configuration and creator.',
    'id', 'workflow', (id) => `/api/workflows/${id}`),
  // server/routes/workflows.ts → router.get('/api/workflows/:id/steps')
  getById('workflow_steps', 'workflows',
    'The ordered steps of one workflow with their action types and configuration.',
    'id', 'workflow', (id) => `/api/workflows/${id}/steps`),
  // server/routes/workflows.ts → router.get('/api/workflows/:id/executions')
  getById('workflow_executions', 'workflows',
    'Past executions of one workflow: when it ran, status and result.',
    'id', 'workflow', (id) => `/api/workflows/${id}/executions`),
  // server/routes/workflows.ts → router.get('/api/workflow-templates') — no params
  get('workflow_templates', 'workflows',
    'Reusable workflow templates a workflow can be created from.',
    '/api/workflow-templates'),
];
