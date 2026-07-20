-- Marketing brand kit ("the stylist" M3): one row holding the house look —
-- colors, contact block, serving areas, service chips — applied across poster
-- templates and QR styling. Single-row table keyed by a fixed id.
CREATE TABLE IF NOT EXISTS marketing_brand (
  id TEXT PRIMARY KEY DEFAULT 'default',
  tokens JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
