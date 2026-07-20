-- Migration: Create marketing_campaigns + campaign_scans
-- Date: 2026-07-20
-- Description: Non-rep marketing QR codes (yard signs, print, truck wraps, etc.).
--              Each campaign has a short `code` used in the public /m/:code redirect,
--              which logs a scan and 302s to `destination_url` (with UTM appended).
--              Rep QR codes stay read-through to Susan AI-21; these campaigns are
--              net-new marketing data with no sa21 equivalent, so Roof HR owns them.
--              Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, no rewrite/backfill.

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  channel         TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_campaigns_code
  ON marketing_campaigns (code);

CREATE TABLE IF NOT EXISTS campaign_scans (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  scanned_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_hash     TEXT,
  user_agent  TEXT
);

-- Analytics are always grouped by campaign and windowed by time.
CREATE INDEX IF NOT EXISTS idx_campaign_scans_campaign
  ON campaign_scans (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_scans_scanned_at
  ON campaign_scans (scanned_at);
