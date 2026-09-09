-- 0010: Personal agent tokens for the MCP endpoint (reads first, 2026-09-08).
--
-- Any Roof HR person can mint a token under "Connected agents" and hand it to
-- an MCP client (Genie 21, Claude, ChatGPT, Cursor). The client connects to
-- /mcp with `Authorization: Bearer <token>` and acts AS that person: every
-- tool calls the app's own HTTP routes over loopback with a 5-minute session
-- row whose agent_scope is 'mcp:read', so what a tool returns is exactly what
-- that person can already see in the app. No new permission model.
--
-- sessions.agent_scope is the ceiling. NULL = a normal login session. 'mcp:read'
-- = a loopback session that requireAuth never sliding-renews and refuses on any
-- non-GET/HEAD request (server/middleware/auth.ts, server/routes.ts).
--
-- mcp_tokens stores the sha256 of the token, never the token. token_hint is the
-- last four characters, for the list in the UI. scopes holds "<area>:read"
-- strings (server/mcp/areas.ts); writes are refused at mint time in pass one.
--
-- mcp_audit_log gets one row per tools/call: argument KEYS only, never values.
-- No FK to mcp_tokens on purpose — the trail must outlive a deleted token.
--
-- Applied automatically at boot by server/migrationRunner.ts (see README.md).

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS agent_scope TEXT;

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  token_hint    TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user
  ON mcp_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL,
  token_id      TEXT NOT NULL,
  request_id    TEXT NOT NULL,
  tool          TEXT NOT NULL,
  area          TEXT NOT NULL,
  access        TEXT NOT NULL CHECK (access IN ('read', 'write')),
  argument_keys TEXT[] NOT NULL DEFAULT '{}',
  ok            BOOLEAN NOT NULL,
  error         TEXT,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_token
  ON mcp_audit_log (token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_user
  ON mcp_audit_log (user_id, created_at DESC);
