/**
 * Agent actor identity — the service-principal layer for executing agents.
 *
 * Every autonomous mutation must be attributable to a marked, non-human actor:
 * agent ids carry the `agent:` prefix so audit rows, reviewedBy fields, and
 * UI can distinguish agent activity from human activity at a glance.
 *
 * Agents do NOT inherit human authority. An agent id will never pass the
 * email-literal approver checks (PTO_APPROVER_EMAILS et al.) — by design.
 * Granting an agent real decision authority requires an explicit grant here
 * plus a deliberate check at the call site, never impersonation of a human.
 */

export const AGENT_ACTOR_PREFIX = 'agent:';

export interface AgentActor {
  /** Stable id, always `agent:`-prefixed. Goes in userId/reviewedBy fields. */
  id: string;
  /** Synthetic address on the reserved system.roofhr domain — never routable. */
  email: string;
  /** Human-readable display name. */
  name: string;
}

export const PTO_TRIAGE_AGENT: AgentActor = {
  id: 'agent:pto-triage',
  email: 'pto-triage-agent@system.roofhr',
  name: 'PTO Triage Agent',
};

export function isAgentActor(actorId?: string | null): boolean {
  return !!actorId && actorId.startsWith(AGENT_ACTOR_PREFIX);
}
