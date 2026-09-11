/**
 * test/global-setup.ts — vitest globalSetup for the integration suite.
 *
 *   1. Points at a LOCAL throwaway Postgres database (default
 *      postgresql://<you>@127.0.0.1:5432/roofhr_test_mcp21; create it once
 *      with `createdb roofhr_test_mcp21`). Every table is dropped and the
 *      schema is re-pushed on each run, so runs never bleed into each other.
 *   2. Bootstraps the base schema the way local dev does (`drizzle-kit push`,
 *      see migrations/README.md), then DROPS the three objects migration
 *      0010 creates so the server's own migration runner has to apply it at
 *      boot — that is how migrations reach prod on this app.
 *   3. Spawns the server from the working tree (tsx server/index.ts) on a
 *      free port with NODE_ENV=development and waits for /api/health.
 *   4. Seeds one admin and one employee, each with a login session row, and
 *      publishes ids, tokens and the base URL to the workers via process.env.
 *
 * Overrides:
 *   TEST_DATABASE_URL — use this (local) Postgres URL instead of the default.
 *
 * The spawned server's combined stdout/stderr is written to
 * $TEST_SERVER_LOG (default /tmp/roofhr-test-server.log).
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_LOG = process.env.TEST_SERVER_LOG || '/tmp/roofhr-test-server.log';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

function defaultTestDbUrl(): string {
  const user = process.env.PGUSER || os.userInfo().username;
  return `postgresql://${encodeURIComponent(user)}@127.0.0.1:5432/roofhr_test_mcp21`;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function waitFor(url: string, ms: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`[global-setup] server exited early (${child.exitCode}); see ${SERVER_LOG}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`[global-setup] server did not answer ${url} within ${ms}ms; see ${SERVER_LOG}`);
}

let child: ChildProcess | null = null;

export async function setup(): Promise<void> {
  const dbUrl = process.env.TEST_DATABASE_URL || defaultTestDbUrl();
  const host = new URL(dbUrl).hostname;
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`[global-setup] Refusing non-local test database host "${host}" — this runner drops every table.`);
  }

  // 1. Wipe and re-push the base schema (drizzle-kit push = local/dev only, per migrations/README.md).
  const admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await admin.end();
  execFileSync(path.join(ROOT, 'node_modules', '.bin', 'drizzle-kit'), ['push', '--force'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl, USE_PG_DRIVER: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // 2. Make migrations 0010 and 0011 do real work at boot: drop what drizzle-kit just
  //    created from shared/schema.ts so the runner has to create it.
  //    Pre-existing hazard, not ours: shared/schema.ts's authz_grants lacks the
  //    UNIQUE (capability, principal_type, principal) that 0008 declares, so on
  //    a push-then-boot database 0008's ON CONFLICT fails and the runner stops
  //    the chain there (0009, 0010 never apply). Prod created the table through
  //    0008 itself, so prod is fine; here we let 0008 create it too.
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  await db.query(`
    DROP TABLE IF EXISTS mcp_audit_log;
    DROP TABLE IF EXISTS mcp_tokens;
    ALTER TABLE sessions DROP COLUMN IF EXISTS agent_scope;
    DROP TABLE IF EXISTS authz_grants;
    DROP TABLE IF EXISTS offices;
  `);

  // 3. Boot the server from the working tree.
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const log = fs.openSync(SERVER_LOG, 'w');
  child = spawn(path.join(ROOT, 'node_modules', '.bin', 'tsx'), ['server/index.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      DATABASE_URL: dbUrl,
      USE_PG_DRIVER: 'true',
      SESSION_SECRET: 'roofhr-test-session-secret',
      PUBLIC_URL: baseUrl,
      AGENTS_ENABLED: 'false',
      ADMIN_EMAIL: 'bootstrap-admin@roofhr.test',
      ADMIN_TEMP_PASSWORD: 'Bootstrap2026!',
      MCP_ACCESS_DISABLED: 'false',
    },
    stdio: ['ignore', log, log],
  });
  await waitFor(`${baseUrl}/api/health`, 90_000, child);

  // Boot must have applied 0010 through migrations/ — prove it before seeding.
  const applied = await db.query("SELECT filename FROM _applied_migrations WHERE filename = '0010_mcp_tokens.sql'");
  if (applied.rowCount !== 1) throw new Error('[global-setup] 0010_mcp_tokens.sql was not applied at boot');
  const col = await db.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'agent_scope'");
  if (col.rowCount !== 1) throw new Error('[global-setup] sessions.agent_scope missing after boot');

  // 4. Seed one admin and one employee, each with a session row.
  const hash = await bcrypt.hash('RoofHrTest2026!', 10);
  const people = [
    { id: crypto.randomUUID(), email: 'admin@roofhr.test', first: 'Ada', last: 'Admin', role: 'SYSTEM_ADMIN', dept: 'Administration', pos: 'System Administrator' },
    { id: crypto.randomUUID(), email: 'emp@roofhr.test', first: 'Eli', last: 'Employee', role: 'EMPLOYEE', dept: 'Production', pos: 'Technician' },
  ];
  const tokens: Record<string, string> = {};
  for (const p of people) {
    await db.query(
      `INSERT INTO users (id, email, first_name, last_name, role, employment_type, department, position, hire_date, is_active, password_hash, must_change_password)
       VALUES ($1, $2, $3, $4, $5, 'W2', $6, $7, '2026-01-05', true, $8, false)`,
      [p.id, p.email, p.first, p.last, p.role, p.dept, p.pos, hash],
    );
    const token = `${crypto.randomUUID()}-${Date.now()}`;
    await db.query(
      `INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 day')`,
      [crypto.randomUUID(), p.id, token],
    );
    tokens[p.role] = token;
  }
  await db.end();

  process.env.TEST_BASE_URL = baseUrl;
  process.env.TEST_DATABASE_URL = dbUrl;
  process.env.DATABASE_URL = dbUrl;
  process.env.USE_PG_DRIVER = 'true';
  process.env.PORT = String(port);
  process.env.TEST_ADMIN_ID = people[0].id;
  process.env.TEST_ADMIN_EMAIL = people[0].email;
  process.env.TEST_ADMIN_TOKEN = tokens.SYSTEM_ADMIN;
  process.env.TEST_EMPLOYEE_ID = people[1].id;
  process.env.TEST_EMPLOYEE_TOKEN = tokens.EMPLOYEE;
  console.log(`[global-setup] server up at ${baseUrl} (log: ${SERVER_LOG}), db ${dbUrl}`);
}

export async function teardown(): Promise<void> {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
