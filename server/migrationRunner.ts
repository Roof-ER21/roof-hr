/**
 * File-based SQL migration runner (pattern ported from CC24's migrationRunner).
 *
 * Applies any `migrations/NNNN_*.sql` not yet recorded in `_applied_migrations`,
 * in numeric order, each inside its own transaction guarded by a Postgres
 * advisory lock so two concurrently-booting instances can't double-apply.
 *
 * The existing migration files are IF NOT EXISTS-guarded, so first-run
 * adoption against the live database no-ops safely while establishing the
 * tracked history.
 *
 * This is the production schema path. `drizzle-kit push` diffs the live schema
 * with no history and can rewrite/drop on renames — it stays available as
 * `npm run db:push:dev` for local databases only.
 */
import fs from 'fs';
import path from 'path';
import { pool } from './db';
import { logger } from './middleware/logger';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

// Fixed app-specific key for pg_advisory_xact_lock (any stable int8 works).
const MIGRATION_LOCK_KEY = 727001;

const TRACKER_DDL = `
  CREATE TABLE IF NOT EXISTS _applied_migrations (
    filename TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER
  );
`;

interface MigrationFile {
  filename: string;
  number: number;
  fullPath: string;
}

function listMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const files: MigrationFile[] = [];
  for (const name of fs.readdirSync(MIGRATIONS_DIR)) {
    const m = name.match(/^(\d+)_.*\.sql$/);
    if (m) {
      files.push({ filename: name, number: parseInt(m[1], 10), fullPath: path.join(MIGRATIONS_DIR, name) });
    }
  }
  return files.sort((a, b) => a.number - b.number);
}

export interface MigrationRunResult {
  total: number;
  applied: number;
  skipped: number;
  failed: number;
}

/**
 * Apply pending migrations. Hard-stops on the first failure — the failed file
 * rolls back cleanly, stays untracked, and is retried on the next boot.
 */
export async function applyPendingMigrations(): Promise<MigrationRunResult> {
  const result: MigrationRunResult = { total: 0, applied: 0, skipped: 0, failed: 0 };

  await (pool as any).query(TRACKER_DDL);

  const files = listMigrationFiles();
  result.total = files.length;
  if (files.length === 0) return result;

  const appliedRows = await (pool as any).query('SELECT filename FROM _applied_migrations');
  const applied = new Set<string>(appliedRows.rows.map((r: { filename: string }) => r.filename));

  for (const m of files) {
    if (applied.has(m.filename)) {
      result.skipped++;
      continue;
    }

    const startedAt = Date.now();
    const sql = fs.readFileSync(m.fullPath, 'utf8');
    const client: any = await (pool as any).connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
      await client.query(sql);
      await client.query(
        `INSERT INTO _applied_migrations (filename, number, duration_ms)
         VALUES ($1, $2, $3)
         ON CONFLICT (filename) DO NOTHING`,
        [m.filename, m.number, Date.now() - startedAt],
      );
      await client.query('COMMIT');
      result.applied++;
      logger.info(`[Migrations] ✅ Applied ${m.filename} in ${Date.now() - startedAt}ms`);
    } catch (err: any) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      result.failed++;
      logger.error(`[Migrations] ❌ ${m.filename} failed (rolled back, will retry next boot): ${err?.message || err}`);
      break;
    } finally {
      client.release?.();
    }
  }

  return result;
}
