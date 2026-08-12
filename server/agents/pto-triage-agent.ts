/**
 * PTO Triage Agent — the Athena-pattern pilot: an agent that EXECUTES against
 * the existing Postgres, not a chatbot.
 *
 * V1 is deliberately recommendation-only. For every PENDING PTO request it
 * evaluates deterministic signals (balance, department overlap, notice period,
 * duration) and writes a structured verdict to pto_requests.agent_triage for
 * human approvers. It never approves and never denies: approval authority
 * stays with the email-literal approver lists until that model is refactored
 * to roles and an explicit authority grant exists (see shared/constants/agents.ts).
 *
 * Deterministic rules, not an LLM: every input signal is already structured
 * (departmentOverlapWarning, overlappingEmployees, PTO policy balances), so a
 * rules pass is auditable, testable, and cannot hallucinate a verdict.
 */
import { BaseAgent, AgentConfig, AgentContext, AgentResult } from './base-agent';
import { storage } from '../storage';
import { PTO_TRIAGE_AGENT } from '../../shared/constants/agents';

export type TriageRecommendation = 'CLEAR_TO_APPROVE' | 'NEEDS_HUMAN_REVIEW';

export interface TriageSignal {
  code:
    | 'insufficient_balance'
    | 'no_pto_policy'
    | 'department_overlap'
    | 'short_notice'
    | 'starts_in_past'
    | 'long_duration';
  detail: string;
}

export interface PtoTriageVerdict {
  version: 'roofhr.pto-triage.v1';
  agent: string;
  recommendation: TriageRecommendation;
  signals: TriageSignal[];
  summary: string;
  balance?: { requestedDays: number; remainingDays: number };
  triagedAt: string;
}

const SHORT_NOTICE_DAYS = 7;   // vacation/personal requested < 7 days out
const LONG_DURATION_DAYS = 5;  // > 5 days off warrants a human look

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  return Math.floor((target - Date.now()) / (24 * 60 * 60 * 1000));
}

export async function triagePtoRequest(requestId: string): Promise<PtoTriageVerdict | null> {
  const request = await storage.getPtoRequestById(requestId);
  if (!request || request.status !== 'PENDING') return null;

  const signals: TriageSignal[] = [];
  let balance: PtoTriageVerdict['balance'];

  // Exempt PTO (admin-created) doesn't draw from balance — skip balance checks
  if (!request.isExempt) {
    const policy = await storage.getPtoPolicyByEmployee(request.employeeId);
    if (!policy) {
      signals.push({ code: 'no_pto_policy', detail: 'Employee has no PTO policy on file' });
    } else {
      balance = { requestedDays: request.days, remainingDays: policy.remainingDays };
      if (policy.remainingDays < request.days) {
        signals.push({
          code: 'insufficient_balance',
          detail: `Requested ${request.days} day(s) but only ${policy.remainingDays} remaining`,
        });
      }
    }
  }

  if (request.departmentOverlapWarning) {
    const others = (request.overlappingEmployees || []).filter(Boolean);
    signals.push({
      code: 'department_overlap',
      detail: others.length
        ? `Overlaps PTO for: ${others.join(', ')}`
        : 'Overlaps other PTO in the same department',
    });
  }

  const notice = daysUntil(request.startDate);
  if (notice < 0) {
    // Started already — common for sick time logged after the fact; humans decide
    signals.push({ code: 'starts_in_past', detail: `Start date ${request.startDate} has passed` });
  } else if (request.type !== 'SICK' && notice < SHORT_NOTICE_DAYS) {
    signals.push({
      code: 'short_notice',
      detail: `${request.type} request starts in ${notice} day(s) (< ${SHORT_NOTICE_DAYS}-day notice)`,
    });
  }

  if (request.days > LONG_DURATION_DAYS) {
    signals.push({ code: 'long_duration', detail: `${request.days} days requested (> ${LONG_DURATION_DAYS})` });
  }

  const recommendation: TriageRecommendation =
    signals.length === 0 ? 'CLEAR_TO_APPROVE' : 'NEEDS_HUMAN_REVIEW';

  const verdict: PtoTriageVerdict = {
    version: 'roofhr.pto-triage.v1',
    agent: PTO_TRIAGE_AGENT.id,
    recommendation,
    signals,
    summary:
      recommendation === 'CLEAR_TO_APPROVE'
        ? 'No blocking signals: balance covers it, no department overlap, adequate notice.'
        : `Review needed: ${signals.map(s => s.code).join(', ')}`,
    balance,
    triagedAt: new Date().toISOString(),
  };

  await storage.updatePtoRequest(request.id, {
    agentTriage: verdict,
    agentTriagedAt: new Date(),
  } as any);

  return verdict;
}

/**
 * Triage every pending request that hasn't been triaged since it last changed.
 * Shared entrypoint for the scheduled agent AND WorkflowExecutor's TRIAGE_PTO.
 */
export async function triagePendingPtoRequests(): Promise<{
  triaged: number;
  skipped: number;
  clear: number;
  needsHuman: number;
}> {
  const pending = await storage.getPendingPtoRequests();
  let triaged = 0, skipped = 0, clear = 0, needsHuman = 0;

  for (const request of pending) {
    const alreadyCurrent =
      request.agentTriagedAt &&
      new Date(request.agentTriagedAt) >= new Date(request.updatedAt);
    if (alreadyCurrent) {
      skipped++;
      continue;
    }

    try {
      const verdict = await triagePtoRequest(request.id);
      if (!verdict) { skipped++; continue; }
      triaged++;
      if (verdict.recommendation === 'CLEAR_TO_APPROVE') clear++;
      else needsHuman++;
    } catch (err: any) {
      console.error(`[PTO Triage] Failed to triage ${request.id}:`, err?.message);
    }
  }

  // Attributed, marked agent activity — the audit trail knows a robot did this
  if (triaged > 0) {
    storage.createAuditLog({
      userId: PTO_TRIAGE_AGENT.id,
      userEmail: PTO_TRIAGE_AGENT.email,
      action: 'EXECUTE',
      resourceType: 'pto/triage',
      resourceName: 'PTO triage sweep',
      newValue: JSON.stringify({ triaged, skipped, clear, needsHuman }),
    }).catch((err: any) => console.warn('[PTO Triage] audit write failed:', err?.message));
  }

  return { triaged, skipped, clear, needsHuman };
}

export class PtoTriageAgent extends BaseAgent {
  constructor(context: AgentContext = {}) {
    const config: AgentConfig = {
      name: 'PTO Triage',
      description:
        'Reviews pending PTO requests against balance, overlap, and notice signals; ' +
        'writes a recommendation for human approvers (never approves or denies itself)',
      enabled: true,
      schedule: '0 * * * *', // hourly — requests get a verdict before approvers look
      priority: 'medium',
      retryAttempts: 2,
      timeout: 60000,
    };
    super(config, context);
  }

  async execute(): Promise<AgentResult> {
    try {
      const stats = await triagePendingPtoRequests();
      return {
        success: true,
        message: `Triaged ${stats.triaged} pending PTO request(s) (${stats.clear} clear, ${stats.needsHuman} need review, ${stats.skipped} already current)`,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: 'PTO triage sweep failed',
        errors: [(error as Error).message],
      };
    }
  }
}
