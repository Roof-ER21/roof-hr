/**
 * The boot guards, which exist because booting this app has real-world side
 * effects that a test database does not isolate.
 *
 * These are tested because the first version of `integrationsEnabled` was
 * tripped within an hour of being written: running the production bundle
 * locally to check static file headers (`NODE_ENV=production node
 * dist/index.js` against the local test DB) satisfied the NODE_ENV check and
 * created five real Google Drive folders.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isLocalDatabase, integrationsEnabled } from '../../server/runtime-guards';

const PROD_DB = 'postgresql://user:pw@hopper.proxy.rlwy.net:18847/railway';
const LOCAL_DB = 'postgresql://a21@127.0.0.1:5432/roofhr_test_mcp21';

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    ENABLE_INTEGRATIONS: process.env.ENABLE_INTEGRATIONS,
  };
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('isLocalDatabase', () => {
  it('recognises the local hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0', 'postgres', 'db']) {
      expect(isLocalDatabase(`postgresql://u:p@${host}:5432/x`)).toBe(true);
    }
  });

  it('does not mistake the production host for a local one', () => {
    expect(isLocalDatabase(PROD_DB)).toBe(false);
  });

  it('is false for missing or unparseable values rather than throwing', () => {
    expect(isLocalDatabase(undefined)).toBe(false);
    expect(isLocalDatabase('')).toBe(false);
    expect(isLocalDatabase('not a url')).toBe(false);
  });

  it('does not match a remote host that merely contains a local name', () => {
    expect(isLocalDatabase('postgresql://u:p@localhost.evil.example.com:5432/x')).toBe(false);
    expect(isLocalDatabase('postgresql://u:p@my-postgres.example.com:5432/x')).toBe(false);
  });
});

describe('integrationsEnabled', () => {
  it('is ON in real production: production build, remote database', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = PROD_DB;
    delete process.env.ENABLE_INTEGRATIONS;
    expect(integrationsEnabled()).toBe(true);
  });

  it('is OFF for a production build pointed at a LOCAL database', () => {
    // The exact case that created five Drive folders.
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = LOCAL_DB;
    delete process.env.ENABLE_INTEGRATIONS;
    expect(integrationsEnabled()).toBe(false);
  });

  it('is OFF in development by default', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = LOCAL_DB;
    delete process.env.ENABLE_INTEGRATIONS;
    expect(integrationsEnabled()).toBe(false);
  });

  it('ENABLE_INTEGRATIONS=1 turns it on anywhere', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = LOCAL_DB;
    process.env.ENABLE_INTEGRATIONS = '1';
    expect(integrationsEnabled()).toBe(true);
  });

  it('ENABLE_INTEGRATIONS=0 turns it off even in real production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = PROD_DB;
    process.env.ENABLE_INTEGRATIONS = '0';
    expect(integrationsEnabled()).toBe(false);
  });
});
