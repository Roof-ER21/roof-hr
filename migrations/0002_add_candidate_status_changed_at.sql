-- Migration: Add status_changed_at to candidates table
-- Date: 2026-04-21
-- Description: Tracks the timestamp of the last status (stage) change for each candidate.
--              Used by the recruiting kanban to sort cards "most recently moved first"
--              so a newly-moved card lands at the top of its destination column.
--
--              Nullable with no default by design: existing rows remain NULL and
--              the client falls back to created_at for them. Only rows updated
--              after this deploy will receive a non-NULL value. This keeps the
--              change zero-risk — no table rewrite, no backfill, no disruption
--              to existing ordering until a card is actually moved.

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP;

COMMENT ON COLUMN candidates.status_changed_at IS
  'Timestamp of the most recent status transition. Nullable; kanban falls back to created_at.';
