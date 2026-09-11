-- 0011: Offices as data, not code (2026-09-10).
--
-- Ryan (HR) asked for a Pittsburgh welcome email and a Pittsburgh interview
-- location. Both were the same gap: the office list lived as constants in four
-- files (email-service.ts, hire-candidate-modal.tsx, send-welcome-dialog.tsx,
-- interview-scheduler.tsx), so every new office was a developer request.
--
-- One row per office. `key` is the stable id the hire/send routes already pass
-- as officeLocation ('DMV', 'PA', 'RICHMOND'), so existing callers keep working.
-- `meet_person` fills {{meetPerson}} in the welcome email; `address` fills
-- {{officeAddress}} and the in-person interview location.
--
-- Deletes are soft (deleted_at) so an interview or hire that references an old
-- office still resolves.
--
-- Applied automatically at boot by server/migrationRunner.ts (see README.md).

CREATE TABLE IF NOT EXISTS offices (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL,
  label        TEXT NOT NULL,
  address      TEXT NOT NULL,
  meet_person  TEXT NOT NULL DEFAULT 'the team',
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 100,
  updated_by   TEXT,
  deleted_at   TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS offices_key_key ON offices (key);

-- Seed the three offices the code used to hard-code, plus Pittsburgh (Ryan, 9/9).
INSERT INTO offices (id, key, label, address, meet_person, sort_order) VALUES
  ('office-dmv',      'DMV',      'DMV (Vienna, VA)',          '8100 Boone Blvd Suite 400, Vienna, VA 22182',        'Reese Samala',                 10),
  ('office-pa',       'PA',       'PHI (Chesterbrook, PA)',    '851 Duportail Rd, Chesterbrook, PA 19087',           'the team',                     20),
  ('office-richmond', 'RICHMOND', 'Richmond (Glen Allen, VA)', '2400 Old Brick Rd, Suite 105, Glen Allen, VA 23060', 'the team',                     30),
  ('office-pitt',     'PITT',     'PITT (Warrendale, PA)',     '50 Pennwood Pl Suite 329, Warrendale, PA 15086',     'Josh Morris and Jay Waseem',   40)
ON CONFLICT (key) DO NOTHING;
