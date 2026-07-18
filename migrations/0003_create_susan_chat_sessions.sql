-- Migration: Create susan_chat_sessions table
-- Date: 2026-07-17
-- Description: The susan_chat_sessions table is defined in shared/schema.ts and used
--              by the storage layer (createSusanChatSession/getActive/update...) and the
--              POST /api/susan-ai/chat/session route, but the table was never created in
--              production — so Susan's conversations could not be persisted and she had no
--              memory across sessions. This creates it (idempotent) matching the schema
--              exactly. Zero risk: CREATE TABLE IF NOT EXISTS, no rewrite of any existing
--              table, no backfill.

CREATE TABLE IF NOT EXISTS susan_chat_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  messages   TEXT NOT NULL DEFAULT '[]',
  title      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Lookups are always by user_id (list a user's sessions) and by (user_id, is_active)
-- (fetch the active session on each chat turn).
CREATE INDEX IF NOT EXISTS idx_susan_chat_sessions_user
  ON susan_chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_susan_chat_sessions_user_active
  ON susan_chat_sessions (user_id, is_active);
