-- Welcome email content, editable from inside the app.
--
-- Until now the two PDFs on the new-hire welcome email were files committed at
-- public/documents/ and the body was a hardcoded template literal in
-- server/email-service.ts, so swapping either one meant a deploy.
--
-- These tables move both into data. Railway containers have an ephemeral
-- filesystem -- a redeploy wipes anything written to disk -- so the PDF bytes
-- live in Postgres, not on disk. The committed files stay as the first-boot
-- seed and as the fallback if the table is empty.
--
-- Attachments are SOFT-deleted (deleted_at) so version history survives a
-- delete and a delete stays undoable.
-- Templates absent => the built-in email in email-service.ts is used, so
-- day-one behavior is identical to before this migration.

CREATE TABLE IF NOT EXISTS welcome_email_attachments (
  id              TEXT PRIMARY KEY,
  slot            TEXT,                    -- stable key for the two seeded docs; NULL for admin-added
  label           TEXT NOT NULL,           -- name shown in the email's attachment list and in the UI
  filename        TEXT NOT NULL,           -- filename the recipient sees
  description     TEXT,
  content_type    TEXT NOT NULL DEFAULT 'application/pdf',
  file_size       INTEGER NOT NULL,
  content_base64  TEXT NOT NULL,
  checksum        TEXT NOT NULL,           -- sha256 of the bytes, for dedupe/verification
  version         INTEGER NOT NULL DEFAULT 1,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_by      TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per slot among the live rows; admin-added rows (slot NULL) are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS welcome_email_attachments_slot_key
  ON welcome_email_attachments (slot)
  WHERE slot IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS welcome_email_attachments_live_idx
  ON welcome_email_attachments (sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS welcome_email_attachment_versions (
  id              TEXT PRIMARY KEY,
  attachment_id   TEXT NOT NULL,
  version         INTEGER NOT NULL,
  label           TEXT NOT NULL,
  filename        TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  content_base64  TEXT NOT NULL,
  checksum        TEXT NOT NULL,
  change_log      TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS welcome_email_attachment_versions_key
  ON welcome_email_attachment_versions (attachment_id, version);

CREATE TABLE IF NOT EXISTS welcome_email_templates (
  id          TEXT PRIMARY KEY,
  variant     TEXT NOT NULL,               -- 'insurance' | 'retail'
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE => fall back to the built-in email
  version     INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS welcome_email_templates_variant_key
  ON welcome_email_templates (variant);

CREATE TABLE IF NOT EXISTS welcome_email_template_versions (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  variant     TEXT NOT NULL,
  version     INTEGER NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  change_log  TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS welcome_email_template_versions_key
  ON welcome_email_template_versions (template_id, version);
