/**
 * MCP areas — the units a personal agent token is scoped to.
 *
 * A scope is "<area>:<access>" (e.g. "pto:read"). Pass one is READ ONLY by
 * construction: only ":read" scopes can be minted, every tool is a read, and
 * the loopback session the tools act through carries agent_scope 'mcp:read',
 * which the auth middleware refuses on any non-GET/HEAD request. Writes come
 * later.
 *
 * Who may mint which area: a person may only mint a scope for an area their
 * role already reaches in the app. Roof HR gates most reads with requireAuth
 * alone and narrows rows INSIDE the route (own PTO vs. everyone's, assigned
 * candidates vs. all, own contracts vs. direct reports'), so most areas are
 * open to every known role and the route's own answer is the ceiling. The
 * two exceptions carry a real gate: attendance (canAccessFacilities) and
 * analytics (requireManager on /api/analytics/metrics). An unknown role mints
 * nothing. The super admin email always may (shared/constants/roles.ts).
 *
 * This module has no dependency on @omj21/mcp21 so the UI-facing route and
 * the unit tests can import it cheaply.
 */

import {
  ALL_ROLES,
  MANAGER_ROLES,
  SUPER_ADMIN_EMAIL,
  canAccessFacilities,
} from '../../shared/constants/roles';

export const MCP_AREAS = [
  'me',
  'employees',
  'pto',
  'attendance',
  'onboarding',
  'documents',
  'recruiting',
  'meetings',
  'territories',
  'analytics',
  'workflows',
] as const;

export type McpArea = (typeof MCP_AREAS)[number];
export type McpAccess = 'read' | 'write';

/** The slice of a user row the gates need. */
export type McpPrincipal = { role?: string | null; email?: string | null };

function knownRole(user: McpPrincipal): boolean {
  return ALL_ROLES.includes(String(user.role ?? ''));
}

function isManagerOrSuper(user: McpPrincipal): boolean {
  if (norm(user.email) === SUPER_ADMIN_EMAIL) return true;
  return MANAGER_ROLES.includes(String(user.role ?? ''));
}

function norm(email?: string | null): string {
  return (email || '').toLowerCase().trim();
}

/**
 * Per-area mint gate. Each names the route guard it mirrors. `anyRole` means
 * the routes behind the area are requireAuth-only and scope their rows
 * themselves.
 */
const anyRole = (user: McpPrincipal) => knownRole(user);

export const MCP_AREA_GATES: Record<McpArea, (user: McpPrincipal) => boolean> = {
  // GET /api/auth/me, /api/employee-portal/* — the person's own data
  me: anyRole,
  // GET /api/users — every role gets the directory (managers/admins/lead
  // sourcers see full rows, everyone else name + role + position)
  employees: anyRole,
  // GET /api/pto (own requests; approvers and managers see all — the route
  // consults authzService.canApprovePtoRequests), /api/pto/calendar,
  // /api/pto/company-policy, /api/pto-policies/employee/:id (own or manager)
  pto: anyRole,
  // GET /api/attendance/sessions|analytics → requireFacilitiesAccess
  attendance: (user) => canAccessFacilities({ role: user.role ?? undefined, email: user.email ?? undefined }),
  // GET /api/onboarding-templates, /api/onboarding-instances — requireAuth
  onboarding: anyRole,
  // GET /api/documents (visibility by role inside), /api/contracts (own /
  // direct reports / all by role), /api/equipment-agreements; COI lists are
  // requireManager and answer 403 to everyone else
  documents: anyRole,
  // GET /api/job-postings, /api/candidates (assigned-only unless manager or
  // lead sourcer), /api/interviews — requireAuth
  recruiting: anyRole,
  // GET /api/meetings, /api/meeting-rooms — requireAuth
  meetings: anyRole,
  // GET /api/territories — requireAuth
  territories: anyRole,
  // GET /api/analytics/metrics → requireManager; /api/dashboard/metrics and
  // /api/recruiting-analytics/* ride along under the same gate
  analytics: isManagerOrSuper,
  // GET /api/workflows, /api/workflow-templates — requireAuth
  workflows: anyRole,
};

/** Human labels for the Connected agents panel. */
export const MCP_AREA_LABELS: Record<McpArea, { label: string; description: string }> = {
  me: { label: 'Me', description: 'Your own profile, portal dashboard, PTO balance, team, pending items and notifications' },
  employees: { label: 'Employees', description: 'The employee directory as your role sees it' },
  pto: { label: 'PTO', description: 'PTO requests you can see, the company calendar, policies and balances' },
  attendance: { label: 'Attendance', description: 'Attendance sessions, check-ins and analytics (Facilities access)' },
  onboarding: { label: 'Onboarding', description: 'Onboarding templates, instances and step progress' },
  documents: { label: 'Documents', description: 'Company documents, contracts, COI and equipment agreements (metadata, no file contents)' },
  recruiting: { label: 'Recruiting', description: 'Job postings, candidates, interviews and interviewer availability' },
  meetings: { label: 'Meetings', description: 'Meetings, your meetings, rooms and room availability' },
  territories: { label: 'Territories', description: 'Territories and their managers' },
  analytics: { label: 'Analytics', description: 'HR analytics, dashboard metrics and recruiting analytics (managers)' },
  workflows: { label: 'Workflows', description: 'Automation workflows, steps, executions and templates' },
};

export function isMcpArea(value: unknown): value is McpArea {
  return typeof value === 'string' && (MCP_AREAS as readonly string[]).includes(value);
}

/** True when this person may mint a scope for the area (see the header). */
export function userCanMintArea(user: McpPrincipal | null | undefined, area: McpArea): boolean {
  if (!user) return false;
  if (norm(user.email) === SUPER_ADMIN_EMAIL) return true;
  if (!knownRole(user)) return false;
  return MCP_AREA_GATES[area](user);
}

/** The areas a person may mint, in canonical order. */
export function mintableAreasForUser(user: McpPrincipal | null | undefined): McpArea[] {
  return MCP_AREAS.filter((area) => userCanMintArea(user, area));
}

/** `ok` with the accepted scopes, or `ok: false` with one plain sentence in `error`. */
export type ScopeValidation = { ok: boolean; scopes: string[]; error?: string };

/**
 * Validate the scopes a person asks for at mint time. Pass one: ":read" only.
 * Returns one plain sentence on refusal, naming what was refused.
 */
export function validateRequestedScopes(user: McpPrincipal | null | undefined, requested: unknown): ScopeValidation {
  if (!Array.isArray(requested) || requested.length === 0) {
    return { ok: false, scopes: [], error: 'Pick at least one scope, such as "pto:read".' };
  }
  if (requested.length > 50) {
    return { ok: false, scopes: [], error: 'Too many scopes in one token.' };
  }
  const accepted: string[] = [];
  const writes: string[] = [];
  const outsideRole: string[] = [];
  const malformed: string[] = [];
  for (const raw of requested) {
    if (typeof raw !== 'string') { malformed.push(String(raw)); continue; }
    const parts = raw.trim().split(':');
    if (parts.length !== 2) { malformed.push(raw); continue; }
    const [area, access] = parts;
    if (!isMcpArea(area)) { malformed.push(raw); continue; }
    if (access === 'write') { writes.push(area); continue; }
    if (access !== 'read') { malformed.push(raw); continue; }
    if (!userCanMintArea(user, area)) { outsideRole.push(area); continue; }
    if (!accepted.includes(`${area}:read`)) accepted.push(`${area}:read`);
  }
  if (writes.length > 0) {
    return { ok: false, scopes: [], error: `Writes are not enabled yet; agent tokens can only read (${uniq(writes).join(', ')}).` };
  }
  if (outsideRole.length > 0) {
    return { ok: false, scopes: [], error: `Your role does not have access to: ${uniq(outsideRole).join(', ')}.` };
  }
  if (malformed.length > 0) {
    return { ok: false, scopes: [], error: `Unknown scope: ${uniq(malformed).join(', ')}. Use "<area>:read" with an area from ${MCP_AREAS.join(', ')}.` };
  }
  return { ok: true, scopes: accepted };
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items));
}
