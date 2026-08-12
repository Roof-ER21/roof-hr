-- PTO triage agent (recommendation-only V1): structured triage verdict written
-- by the agent service principal, surfaced to human approvers. The agent never
-- approves or denies — authority stays with PTO_APPROVER_EMAILS until the
-- email-literal authorization model is refactored to roles.

ALTER TABLE pto_requests ADD COLUMN IF NOT EXISTS agent_triage JSONB;
ALTER TABLE pto_requests ADD COLUMN IF NOT EXISTS agent_triaged_at TIMESTAMP;
