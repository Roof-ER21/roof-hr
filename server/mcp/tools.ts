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
      'Employee directory and notes. Omit arguments for the full employee directory (id, name, role, department, ' +
      'position, employment type, hire date, phone, active status). Or provide employeeId with view="notes" for HR notes.',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: ID('employee'),
        view: ENUM('View to retrieve: "directory" (default, employee list) or "notes" (notes on record, requires employeeId).', ['directory', 'notes']),
      },
    },
    run: (ctx, args) => {
      if (args.view === 'notes') {
        const id = segment(args.employeeId);
        if (!id) return Promise.resolve(badId('employee'));
        return loopbackGet(ctx, { path: `/api/employees/${id}/notes`, args });
      }
      return loopbackGet(ctx, { path: '/api/users', args });
    },
  },

  // ── pto (1 tool) ────────────────────────────────────────────────────────
  {
    name: 'pto',
    area: 'pto',
    access: 'read',
    description:
      'PTO requests, calendar, and policies. By default lists PTO requests visible to caller. ' +
      'Can also retrieve company-wide calendar, company policy, department settings, all policies (managers), or individual policy.',
    inputSchema: {
      type: 'object',
      properties: {
        view: ENUM(
          'View to retrieve: "requests" (default, PTO requests visible to caller), "calendar" (company-wide approved time off), ' +
          '"company_policy" (default rules), "department_settings" (department policy overrides), ' +
          '"policies" (all employee individual policy rows, managers only), "employee_policy" (one employee policy, requires employeeId).',
          ['requests', 'calendar', 'company_policy', 'department_settings', 'policies', 'employee_policy'],
        ),
        employeeId: ID('employee'),
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? 'requests';
      switch (view) {
        case 'calendar':
          return loopbackGet(ctx, { path: '/api/pto/calendar', args });
        case 'company_policy':
          return loopbackGet(ctx, { path: '/api/pto/company-policy', args });
        case 'department_settings':
          return loopbackGet(ctx, { path: '/api/pto/department-settings', args });
        case 'policies':
          return loopbackGet(ctx, { path: '/api/pto-policies', args });
        case 'employee_policy': {
          const id = segment(args.employeeId);
          if (!id) return Promise.resolve(badId('employee'));
          return loopbackGet(ctx, { path: `/api/pto-policies/employee/${id}`, args });
        }
        case 'requests':
        default:
          return loopbackGet(ctx, { path: '/api/pto', args });
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
      const view = args.view ?? 'sessions';
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
      const view = args.view ?? 'instances';
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
          'Resource to query: "candidates" (default, pipeline), "candidate_notes" (requires candidateId), ' +
          '"candidate_interviews" (requires candidateId), "jobs" (job postings), "job_detail" (requires jobId), ' +
          '"interviews" (all interviews), "interview_detail" (requires interviewId), or "interviewer_availability" (requires interviewerId).',
          ['candidates', 'candidate_notes', 'candidate_interviews', 'jobs', 'job_detail', 'interviews', 'interview_detail', 'interviewer_availability'],
        ),
        candidateId: ID('candidate'),
        jobId: ID('job posting'),
        interviewId: ID('interview'),
        interviewerId: ID('interviewer user'),
        includeArchived: BOOL('true = include archived candidates (when view is "candidates").'),
      },
    },
    run: (ctx, args) => {
      const view = args.view ?? 'candidates';
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
        case 'candidates':
        default:
          return loopbackGet(ctx, { path: '/api/candidates', args, query: ['includeArchived'] });
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
      const view = args.view ?? 'meetings';
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
      const view = args.view ?? 'workflows';
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
