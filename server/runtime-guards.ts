/**
 * Guards that make the safe path the default when running this app locally.
 *
 * Two things bit during the 2026-09-12 hardening pass:
 *
 * 1. `.env` points DATABASE_URL at the PRODUCTION Railway database, and
 *    server/index.ts runs ALTER TABLE at boot. So `npm run dev` — the command
 *    documented in CLAUDE.md — migrates production.
 *
 * 2. Booting at all creates real Google Drive folders and registers cron agents
 *    that send email, whatever database it points at, because those credentials
 *    come from `.env` and are not scoped to the database. Pointing at a local
 *    test database isolates the database and nothing else: a test database is
 *    not a test environment.
 *
 * Neither guard removes any capability. Both are opt-out with one env var, and
 * both are inert in production.
 */
import { logger } from './utils/logger';

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'postgres', 'db']);

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  const host = hostOf(url);
  return host !== null && LOCAL_DB_HOSTS.has(host);
}

/**
 * Refuse to boot a development server against a remote database.
 *
 * Bypass deliberately, when you actually mean it:
 *   ALLOW_PROD_DB=1 npm run dev
 */
export function assertSafeDatabase(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.ALLOW_PROD_DB === '1') {
    logger.warn('[guard] ALLOW_PROD_DB=1 — running against a REMOTE database. Migrations WILL apply to it.');
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url || isLocalDatabase(url)) return;

  const host = hostOf(url) ?? 'unknown host';
  logger.error(
    `[guard] Refusing to start in ${process.env.NODE_ENV || 'development'} against a remote database (${host}).\n` +
    '        This server applies ALTER TABLE migrations at boot, so starting it here would\n' +
    '        migrate that database.\n\n' +
    '        Point DATABASE_URL at a local Postgres, or set ALLOW_PROD_DB=1 if you mean it.',
  );
  process.exit(1);
}

/**
 * Whether this process may talk to third-party services — Google Drive/Calendar
 * folder provisioning, the sync jobs, and the cron agents that send email.
 *
 * On in production. Off locally unless asked for:
 *   ENABLE_INTEGRATIONS=1 npm run dev
 */
export function integrationsEnabled(): boolean {
  // Explicit wins, in both directions.
  if (process.env.ENABLE_INTEGRATIONS === '1') return true;
  if (process.env.ENABLE_INTEGRATIONS === '0') return false;

  // A production BUILD pointed at a local database is somebody testing the
  // production bundle locally, not production. Keying this on NODE_ENV alone
  // was not enough: it was tripped within an hour of being written, by running
  // `NODE_ENV=production node dist/index.js` against the local test database to
  // check static file headers. That created five real Drive folders.
  //
  // Real production never has a localhost DATABASE_URL, so this costs nothing
  // there and closes the obvious local case.
  if (isLocalDatabase(process.env.DATABASE_URL)) return false;

  return process.env.NODE_ENV === 'production';
}

let announced = false;

/** Log once, so it is obvious in a local run why nothing is syncing. */
export function announceIntegrationMode(): void {
  if (announced) return;
  announced = true;
  if (integrationsEnabled()) {
    logger.warn('[guard] ENABLE_INTEGRATIONS=1 — Google sync and cron agents are LIVE against real accounts.');
  } else {
    logger.info('[guard] Local run: Google sync and cron agents are OFF. Set ENABLE_INTEGRATIONS=1 to enable them.');
  }
}
