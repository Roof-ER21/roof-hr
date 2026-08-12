-- Authorization grants: moves email-literal authority lists out of source code
-- into data. Seeded to EXACTLY mirror shared/constants/roles.ts as of 2026-08-12,
-- so day-one behavior is identical. The server reads these through a cached
-- authzService with a fallback to the legacy constants.
--
-- principal_type USER_EMAIL: principal is a lowercase email.
-- principal_type AGENT: principal is an agent service-principal id (agent:*).
--   No agent grants are seeded — agent authority is always an explicit,
--   deliberate insert (see shared/constants/agents.ts).

CREATE TABLE IF NOT EXISTS authz_grants (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  principal_type TEXT NOT NULL DEFAULT 'USER_EMAIL',
  principal TEXT NOT NULL,
  metadata JSONB,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (capability, principal_type, principal)
);

CREATE INDEX IF NOT EXISTS idx_authz_grants_capability ON authz_grants (capability) WHERE enabled;

-- Seeds mirror the constants; idempotent via the unique constraint.
INSERT INTO authz_grants (id, capability, principal_type, principal, metadata, created_by) VALUES
  -- PTO core approvers (PTO_APPROVER_EMAILS)
  ('seed:pto.approve.core:ahmed.mahmoud@theroofdocs.com', 'pto.approve.core', 'USER_EMAIL', 'ahmed.mahmoud@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:pto.approve.core:ford.barsi@theroofdocs.com', 'pto.approve.core', 'USER_EMAIL', 'ford.barsi@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:pto.approve.core:reese.samala@theroofdocs.com', 'pto.approve.core', 'USER_EMAIL', 'reese.samala@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:pto.approve.core:oliver.brown@theroofdocs.com', 'pto.approve.core', 'USER_EMAIL', 'oliver.brown@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:pto.approve.core:greg.campbell@theroofdocs.com', 'pto.approve.core', 'USER_EMAIL', 'greg.campbell@theroofdocs.com', NULL, 'seed:0008'),
  -- Department approvers (PTO_DEPARTMENT_APPROVERS)
  ('seed:pto.approve.department:greg.campbell@theroofdocs.com', 'pto.approve.department', 'USER_EMAIL', 'greg.campbell@theroofdocs.com', '{"department":"Production"}', 'seed:0008'),
  -- Senior managers whose requests route only to senior approvers (SENIOR_MANAGER_EMAILS)
  ('seed:pto.route.senior_manager:ford.barsi@theroofdocs.com', 'pto.route.senior_manager', 'USER_EMAIL', 'ford.barsi@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:pto.route.senior_manager:reese.samala@theroofdocs.com', 'pto.route.senior_manager', 'USER_EMAIL', 'reese.samala@theroofdocs.com', NULL, 'seed:0008'),
  -- Senior approvers (SENIOR_PTO_APPROVER_EMAILS)
  ('seed:pto.approve.senior:ahmed.mahmoud@theroofdocs.com', 'pto.approve.senior', 'USER_EMAIL', 'ahmed.mahmoud@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:pto.approve.senior:oliver.brown@theroofdocs.com', 'pto.approve.senior', 'USER_EMAIL', 'oliver.brown@theroofdocs.com', NULL, 'seed:0008'),
  -- PTO reminder recipients (PTO_REMINDER_RECIPIENTS — was aliased to approvers; now independently editable)
  ('seed:notify.pto.reminders:ahmed.mahmoud@theroofdocs.com', 'notify.pto.reminders', 'USER_EMAIL', 'ahmed.mahmoud@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:notify.pto.reminders:ford.barsi@theroofdocs.com', 'notify.pto.reminders', 'USER_EMAIL', 'ford.barsi@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:notify.pto.reminders:reese.samala@theroofdocs.com', 'notify.pto.reminders', 'USER_EMAIL', 'reese.samala@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:notify.pto.reminders:oliver.brown@theroofdocs.com', 'notify.pto.reminders', 'USER_EMAIL', 'oliver.brown@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:notify.pto.reminders:greg.campbell@theroofdocs.com', 'notify.pto.reminders', 'USER_EMAIL', 'greg.campbell@theroofdocs.com', NULL, 'seed:0008'),
  -- Daily "who's out today" digest (PTO_DAILY_DIGEST_RECIPIENTS)
  ('seed:notify.pto.daily_digest:ford.barsi@theroofdocs.com', 'notify.pto.daily_digest', 'USER_EMAIL', 'ford.barsi@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:notify.pto.daily_digest:greg.campbell@theroofdocs.com', 'notify.pto.daily_digest', 'USER_EMAIL', 'greg.campbell@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:notify.pto.daily_digest:oliver.brown@theroofdocs.com', 'notify.pto.daily_digest', 'USER_EMAIL', 'oliver.brown@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:notify.pto.daily_digest:reese.samala@theroofdocs.com', 'notify.pto.daily_digest', 'USER_EMAIL', 'reese.samala@theroofdocs.com', NULL, 'seed:0008'),
  -- PTO policy editors (POLICY_ADMIN_EMAILS; enforced server-side in a later phase)
  ('seed:pto.policies.edit:ahmed.mahmoud@theroofdocs.com', 'pto.policies.edit', 'USER_EMAIL', 'ahmed.mahmoud@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:pto.policies.edit:ford.barsi@theroofdocs.com', 'pto.policies.edit', 'USER_EMAIL', 'ford.barsi@theroofdocs.com', NULL, 'seed:0008'),
  -- Onboarding checklist access (ONBOARDING_ADMIN_EMAILS; enforced server-side in a later phase)
  ('seed:onboarding.checklist:ahmed.mahmoud@theroofdocs.com', 'onboarding.checklist', 'USER_EMAIL', 'ahmed.mahmoud@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:onboarding.checklist:ford.barsi@theroofdocs.com', 'onboarding.checklist', 'USER_EMAIL', 'ford.barsi@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:onboarding.checklist:oliver.brown@theroofdocs.com', 'onboarding.checklist', 'USER_EMAIL', 'oliver.brown@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:onboarding.checklist:reese.samala@theroofdocs.com', 'onboarding.checklist', 'USER_EMAIL', 'reese.samala@theroofdocs.com', NULL, 'seed:0008'),
  ('seed:onboarding.checklist:careers@theroofdocs.com', 'onboarding.checklist', 'USER_EMAIL', 'careers@theroofdocs.com', NULL, 'seed:0008')
ON CONFLICT (capability, principal_type, principal) DO NOTHING;
