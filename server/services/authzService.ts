/**
 * Authorization service — DB-backed capability grants with a warm cache.
 *
 * Replaces the email-literal authority lists in shared/constants/roles.ts.
 * Reads are SYNCHRONOUS against an in-memory cache (refreshed at boot and
 * every 60s, plus immediately after any grant write), so existing call-sites
 * keep their shape and a slow query can never sit on the login path.
 *
 * SAFETY: until the cache has loaded successfully at least once, every check
 * falls back to the legacy constants — a DB outage degrades to exactly the
 * behavior the app has had all along, never to lockout.
 *
 * Capabilities in use (Phase A):
 *   pto.approve.core          — may approve/deny any PTO request
 *   pto.approve.department    — may approve for one department (metadata.department)
 *   pto.route.senior_manager  — this person's own requests route to senior approvers only
 *   pto.approve.senior        — receives/approves senior managers' requests
 *   notify.pto.reminders      — receives pending-PTO reminder emails
 *   notify.pto.daily_digest   — receives the daily "who's out" digest
 *   pto.policies.edit         — may edit PTO policies (client-enforced today)
 *   onboarding.checklist      — may access the onboarding checklist (client-enforced today)
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { authzGrants, AuthzGrant } from '../../shared/schema';
import {
  PTO_APPROVER_EMAILS,
  PTO_DEPARTMENT_APPROVERS,
  SENIOR_MANAGER_EMAILS,
  SENIOR_PTO_APPROVER_EMAILS,
  PTO_REMINDER_RECIPIENTS,
  PTO_DAILY_DIGEST_RECIPIENTS,
} from '../../shared/constants/roles';

const REFRESH_MS = 60_000;

type Cache = Map<string, AuthzGrant[]>; // capability -> enabled grants

let cache: Cache | null = null; // null = never loaded → legacy fallback
let refreshTimer: NodeJS.Timeout | null = null;

export async function refreshAuthzCache(): Promise<void> {
  const rows = await db.select().from(authzGrants).where(eq(authzGrants.enabled, true));
  const next: Cache = new Map();
  for (const row of rows) {
    const list = next.get(row.capability) || [];
    list.push(row);
    next.set(row.capability, list);
  }
  cache = next;
}

export function initAuthz(): void {
  refreshAuthzCache()
    .then(() => {
      let total = 0;
      cache!.forEach((rows) => { total += rows.length; });
      console.log(`[Authz] cache loaded: ${total} grants across ${cache!.size} capabilities`);
    })
    .catch((err: any) => {
      console.error('[Authz] initial load failed — using legacy constants fallback:', err?.message);
    });
  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      refreshAuthzCache().catch((err: any) =>
        console.warn('[Authz] cache refresh failed (keeping previous cache):', err?.message));
    }, REFRESH_MS);
    refreshTimer.unref?.();
  }
}

function norm(email?: string | null): string {
  return (email || '').toLowerCase().trim();
}

/** Lowercased emails granted a capability; null when cache never loaded. */
function grantedEmails(capability: string): string[] | null {
  if (!cache) return null;
  return (cache.get(capability) || [])
    .filter((g) => g.principalType === 'USER_EMAIL')
    .map((g) => norm(g.principal));
}

function hasEmailGrant(capability: string, email?: string | null, fallback?: string[]): boolean {
  const fromDb = grantedEmails(capability);
  const list = fromDb ?? (fallback || []).map(norm);
  return list.includes(norm(email));
}

// ---------------------------------------------------------------------------
// PTO authority — same semantics as the legacy shared/constants/roles helpers
// ---------------------------------------------------------------------------

export function canApprovePtoRequests(user: { email?: string } | null): boolean {
  if (!user) return false;
  return hasEmailGrant('pto.approve.core', user.email, PTO_APPROVER_EMAILS);
}

export function isCorePtoApprover(email?: string | null): boolean {
  return hasEmailGrant('pto.approve.core', email, PTO_APPROVER_EMAILS);
}

export function getDepartmentApproverEntry(email?: string | null): { email: string; department: string } | null {
  const e = norm(email);
  if (!e) return null;
  const fromDb = cache
    ? (cache.get('pto.approve.department') || [])
        .filter((g) => g.principalType === 'USER_EMAIL')
        .map((g) => ({
          email: norm(g.principal),
          department: String((g.metadata as any)?.department || ''),
        }))
        .filter((entry) => entry.department)
    : null;
  const entries = fromDb ?? PTO_DEPARTMENT_APPROVERS.map((x) => ({ email: norm(x.email), department: x.department }));
  return entries.find((entry) => entry.email === e) || null;
}

export function getDepartmentApproverForDepartment(department?: string | null): string[] {
  if (!department) return [];
  const wanted = department.toLowerCase();
  const fromDb = cache
    ? (cache.get('pto.approve.department') || [])
        .filter((g) => g.principalType === 'USER_EMAIL')
        .filter((g) => String((g.metadata as any)?.department || '').toLowerCase() === wanted)
        .map((g) => norm(g.principal))
    : null;
  if (fromDb) return fromDb;
  return PTO_DEPARTMENT_APPROVERS
    .filter((entry) => entry.department.toLowerCase() === wanted)
    .map((entry) => norm(entry.email));
}

export function isSeniorManager(email?: string | null): boolean {
  return hasEmailGrant('pto.route.senior_manager', email, SENIOR_MANAGER_EMAILS);
}

export function getSeniorPtoApprovers(): string[] {
  return grantedEmails('pto.approve.senior') ?? SENIOR_PTO_APPROVER_EMAILS.map(norm);
}

export function getCorePtoApprovers(): string[] {
  return grantedEmails('pto.approve.core') ?? PTO_APPROVER_EMAILS.map(norm);
}

/** Ford/Reese-style routing preserved: senior managers' requests go only to senior approvers. */
export function getPTOApproversForEmployee(employeeEmail: string, employeeDepartment?: string | null): string[] {
  if (isSeniorManager(employeeEmail)) {
    return getSeniorPtoApprovers();
  }
  const all = [...getCorePtoApprovers(), ...getDepartmentApproverForDepartment(employeeDepartment)];
  return Array.from(new Set(all));
}

// ---------------------------------------------------------------------------
// Notification recipients
// ---------------------------------------------------------------------------

export function getPtoReminderRecipients(): string[] {
  return grantedEmails('notify.pto.reminders') ?? PTO_REMINDER_RECIPIENTS.map(norm);
}

export function getPtoDailyDigestRecipients(): string[] {
  return grantedEmails('notify.pto.daily_digest') ?? PTO_DAILY_DIGEST_RECIPIENTS.map(norm);
}

// ---------------------------------------------------------------------------
// Agent authority — explicit grants only, never seeded
// ---------------------------------------------------------------------------

export function agentHasCapability(agentId: string, capability: string): boolean {
  if (!cache) return false; // no fallback: agents have no legacy authority
  return (cache.get(capability) || []).some(
    (g) => g.principalType === 'AGENT' && g.principal === agentId,
  );
}

// ---------------------------------------------------------------------------
// Grant administration (used by /api/authz routes)
// ---------------------------------------------------------------------------

export const KNOWN_CAPABILITIES: Record<string, string> = {
  'pto.approve.core': 'Approve or deny any PTO request',
  'pto.approve.department': 'Approve PTO for one department (metadata.department)',
  'pto.route.senior_manager': "This person's own PTO requests route to senior approvers only",
  'pto.approve.senior': "Receives and approves senior managers' PTO requests",
  'notify.pto.reminders': 'Receives pending-PTO reminder emails',
  'notify.pto.daily_digest': 'Receives the daily who-is-out digest',
  'pto.policies.edit': 'May edit PTO policies',
  'onboarding.checklist': 'May access the onboarding checklist',
};

export async function listGrants(capability?: string): Promise<AuthzGrant[]> {
  if (capability) {
    return db.select().from(authzGrants).where(eq(authzGrants.capability, capability));
  }
  return db.select().from(authzGrants);
}

export async function addGrant(input: {
  capability: string;
  principal: string;
  principalType?: 'USER_EMAIL' | 'AGENT';
  metadata?: Record<string, unknown> | null;
  createdBy: string;
}): Promise<AuthzGrant> {
  const principalType = input.principalType || 'USER_EMAIL';
  const principal = principalType === 'USER_EMAIL' ? norm(input.principal) : input.principal.trim();
  const id = `grant:${input.capability}:${principalType}:${principal}`;
  const [row] = await db
    .insert(authzGrants)
    .values({
      id,
      capability: input.capability,
      principalType,
      principal,
      metadata: input.metadata ?? null,
      enabled: true,
      createdBy: input.createdBy,
    })
    .onConflictDoUpdate({
      target: [authzGrants.capability, authzGrants.principalType, authzGrants.principal],
      set: { enabled: true, metadata: input.metadata ?? null, updatedAt: new Date() },
    })
    .returning();
  await refreshAuthzCache();
  return row;
}

export async function removeGrant(id: string): Promise<boolean> {
  const result = await db.delete(authzGrants).where(eq(authzGrants.id, id)).returning();
  await refreshAuthzCache();
  return result.length > 0;
}
