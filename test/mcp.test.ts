/**
 * MCP pass one, end to end against the booted test server (test/global-setup.ts):
 *
 *   - the seeded admin mints a personal agent token (writes refused, unknown
 *     areas refused, out-of-role areas refused by name, plaintext shown once,
 *     list shows hint only)
 *   - a real MCP client (SDK Client + StreamableHTTPClientTransport) connects
 *     to /mcp with it, lists only the scoped tools, calls `me` and
 *     `pto` and gets the route's own JSON, and is refused in plain
 *     words for an unknown argument and for an unscoped tool
 *   - the loopback SESSION (agent_scope 'mcp:read') reads but cannot POST —
 *     403 "Read-only agent token." — on a requireAuth route, on a route that
 *     relies on the global session middleware alone, and on the token routes;
 *     it is never sliding-renewed and is deleted after the call
 *   - revoke → 401; no token → 401; another person cannot revoke it
 *   - mcp_audit_log has a row per call with argument KEYS and no values
 *   - the per-token limiter answers 429 past 120 requests in a minute
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE_URL = process.env.TEST_BASE_URL!;
const TEST_DB = process.env.TEST_DATABASE_URL!;
const ADMIN_ID = process.env.TEST_ADMIN_ID!;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN!;
const EMPLOYEE_ID = process.env.TEST_EMPLOYEE_ID!;
const EMPLOYEE_TOKEN = process.env.TEST_EMPLOYEE_TOKEN!;

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

/** A raw JSON-RPC initialize POST — enough to see the transport's status code. */
async function rawMcp(bearer?: string) {
  return fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'raw', version: '0' } },
    }),
  });
}

async function connect(bearer: string): Promise<Client> {
  const client = new Client({ name: 'vitest-mcp', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  await client.connect(transport);
  return client;
}

function firstText(result: any): string {
  const block = Array.isArray(result?.content) ? result.content.find((c: any) => c.type === 'text') : null;
  return block?.text ?? '';
}

let db: pg.Pool;
let mintedId = '';
let mintedToken = '';
const SECRET_VALUE = 'zz-never-in-audit-9f3c';

beforeAll(async () => {
  expect(BASE_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  db = new pg.Pool({ connectionString: TEST_DB });
  const me = await api('GET', '/api/auth/me', undefined, ADMIN_TOKEN);
  expect(me.status).toBe(200);
  expect(me.json.id).toBe(ADMIN_ID);
});

afterAll(async () => {
  await db.end();
});

describe('POST /api/mcp/tokens — minting', () => {
  it('lists the areas this person may mint, all read-only, with the endpoint', async () => {
    const res = await api('GET', '/api/mcp/tokens/areas', undefined, ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.json.readOnly).toBe(true);
    expect(res.json.endpoint).toBe(`${BASE_URL}/mcp`);
    expect(res.json.areas.map((a: any) => a.area)).toContain('pto');
    expect(res.json.areas.every((a: any) => a.scope.endsWith(':read'))).toBe(true);
    expect(res.json.areas.every((a: any) => a.allowed === true)).toBe(true);
  });

  it('tells an employee which areas their role does not reach', async () => {
    const res = await api('GET', '/api/mcp/tokens/areas', undefined, EMPLOYEE_TOKEN);
    expect(res.status).toBe(200);
    const byArea = Object.fromEntries(res.json.areas.map((a: any) => [a.area, a.allowed]));
    expect(byArea.me).toBe(true);
    expect(byArea.pto).toBe(true);
    expect(byArea.analytics).toBe(false);
    expect(byArea.attendance).toBe(false);
  });

  it('refuses a write scope in a plain sentence', async () => {
    const res = await api('POST', '/api/mcp/tokens', { name: 'writer', scopes: ['pto:write'] }, ADMIN_TOKEN);
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/not enabled yet/i);
  });

  it('refuses an unknown area by name', async () => {
    const res = await api('POST', '/api/mcp/tokens', { name: 'nope', scopes: ['payroll:read'] }, ADMIN_TOKEN);
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/Unknown scope: payroll:read/);
  });

  it('refuses an area outside the caller\'s role by name', async () => {
    const res = await api('POST', '/api/mcp/tokens', { name: 'reach', scopes: ['me:read', 'analytics:read'] }, EMPLOYEE_TOKEN);
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/does not have access to: analytics/);
  });

  it('requires a name', async () => {
    const res = await api('POST', '/api/mcp/tokens', { scopes: ['pto:read'] }, ADMIN_TOKEN);
    expect(res.status).toBe(400);
  });

  it('mints a token: plaintext once, hint = last four, only the requested read scopes', async () => {
    const res = await api('POST', '/api/mcp/tokens', {
      name: 'vitest agent', scopes: ['pto:read', 'me:read', 'pto:read'], expiresInDays: 30,
    }, ADMIN_TOKEN);
    expect(res.status).toBe(201);
    expect(res.json.token).toMatch(/^roofhr_[0-9A-Za-z]{20,}$/);
    expect(res.json.hint).toBe(res.json.token.slice(-4));
    expect(res.json.scopes).toEqual(['pto:read', 'me:read']);
    expect(res.json.readOnly).toBe(true);
    expect(res.json.expiresAt).toBeTruthy();
    expect(res.json.tokenHash).toBeUndefined();
    mintedId = res.json.id;
    mintedToken = res.json.token;
  });

  it('the list shows the hint and scopes, never the token or its hash', async () => {
    const res = await api('GET', '/api/mcp/tokens', undefined, ADMIN_TOKEN);
    expect(res.status).toBe(200);
    const row = res.json.tokens.find((t: any) => t.id === mintedId);
    expect(row).toBeTruthy();
    expect(row.hint).toBe(mintedToken.slice(-4));
    expect(row.scopes).toEqual(['pto:read', 'me:read']);
    expect(JSON.stringify(res.json)).not.toContain(mintedToken);
    expect(JSON.stringify(res.json)).not.toMatch(/tokenHash|token_hash/);
  });

  it('another person does not see it and cannot revoke it', async () => {
    const list = await api('GET', '/api/mcp/tokens', undefined, EMPLOYEE_TOKEN);
    expect(list.status).toBe(200);
    expect(list.json.tokens.some((t: any) => t.id === mintedId)).toBe(false);
    const del = await api('DELETE', `/api/mcp/tokens/${mintedId}`, undefined, EMPLOYEE_TOKEN);
    expect(del.status).toBe(404);
  });
});

describe('/mcp — a real MCP client acting as the person', () => {
  it('rejects a request with no token', async () => {
    const res = await rawMcp();
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toMatch(/Bearer/);
  });

  it('rejects a token that does not exist', async () => {
    const res = await rawMcp('roofhr_thisIsNotARealToken0000000000000000');
    expect(res.status).toBe(401);
  });

  it('lists only the tools in the scoped areas', async () => {
    const client = await connect(mintedToken);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).toSorted();
      expect(names).toContain('me');
      expect(names).toContain('my_portal');
      expect(names).toContain('pto');
      expect(names).not.toContain('employees');
      expect(names).not.toContain('analytics');
      // The kit hardens every schema: unknown arguments are refused.
      expect(tools.every((t) => (t.inputSchema as any).additionalProperties === false)).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('`me` and `pto` return exactly what the app itself returns for this person', async () => {
    const client = await connect(mintedToken);
    try {
      const me: any = await client.callTool({ name: 'me', arguments: {} });
      expect(me.isError).toBeFalsy();
      const meJson = JSON.parse(firstText(me));
      expect(meJson.id).toBe(ADMIN_ID);
      expect(meJson.email).toBe(ADMIN_EMAIL);
      expect(me.structuredContent).toBeTypeOf('object');
      const direct = await api('GET', '/api/auth/me', undefined, ADMIN_TOKEN);
      expect(Object.keys(meJson).toSorted()).toEqual(Object.keys(direct.json).toSorted());

      const pto: any = await client.callTool({ name: 'pto', arguments: {} });
      expect(pto.isError).toBeFalsy();
      const ptoJson = JSON.parse(firstText(pto));
      const directPto = await api('GET', '/api/pto', undefined, ADMIN_TOKEN);
      // The tool pages and projects the route's answer so an agent can read it,
      // but every row it returns is a row the route itself gave this person —
      // nothing here re-implements who may see what.
      expect(ptoJson.totalMatching).toBe(directPto.json.length);
      expect(ptoJson.countReturned).toBe(Math.min(directPto.json.length, 100));
      const directIds = new Set(directPto.json.map((r: any) => r.id));
      for (const row of ptoJson.requests) expect(directIds.has(row.id)).toBe(true);

      // The window arguments are on the schema, so the unknown-argument guard
      // lets them through rather than refusing the "who is out in September" call.
      const windowed: any = await client.callTool({ name: 'pto', arguments: { view: 'calendar', month: '2026-09' } });
      expect(windowed.isError).toBeFalsy();
      expect(JSON.parse(firstText(windowed)).window).toBe('2026-09');
    } finally {
      await client.close();
    }
  });

  it('refuses an unknown argument in plain words, and an unscoped tool by scope name', async () => {
    const client = await connect(mintedToken);
    try {
      const bad: any = await client.callTool({
        name: 'pto', arguments: { employeeId: ADMIN_ID, bogus: SECRET_VALUE },
      });
      expect(bad.isError).toBe(true);
      expect(firstText(bad)).toBe('Unknown argument "bogus".');
      expect(firstText(bad)).not.toContain(SECRET_VALUE);

      const unscoped: any = await client.callTool({ name: 'employees', arguments: {} });
      expect(unscoped.isError).toBe(true);
      expect(firstText(unscoped)).toMatch(/no employees:read scope/);
    } finally {
      await client.close();
    }
  });

  it('leaves no loopback session behind', async () => {
    const { rows } = await db.query("SELECT count(*)::int AS n FROM sessions WHERE agent_scope = 'mcp:read'");
    expect(rows[0].n).toBe(0);
  });

  it('writes one audit row per call with argument keys and never values', async () => {
    const { rows } = await db.query(
      `SELECT tool, area, access, argument_keys, ok, error, user_id
         FROM mcp_audit_log WHERE token_id = $1 ORDER BY created_at ASC`,
      [mintedId],
    );
    const tools = rows.map((r: any) => r.tool);
    expect(tools).toContain('me');
    expect(tools).toContain('pto');
    expect(tools).toContain('employees');

    const okMe = rows.find((r: any) => r.tool === 'me' && r.ok);
    expect(okMe.argument_keys).toEqual([]);
    expect(okMe.area).toBe('me');
    expect(okMe.access).toBe('read');
    expect(okMe.user_id).toBe(ADMIN_ID);

    const refused = rows.find((r: any) => r.tool === 'pto' && !r.ok);
    expect(refused.argument_keys.toSorted()).toEqual(['bogus', 'employeeId']);
    expect(JSON.stringify(rows)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(rows)).not.toContain(ADMIN_ID.slice(0, 8) + '"'); // the id VALUE is not in argument_keys

    const unscoped = rows.find((r: any) => r.tool === 'employees');
    expect(unscoped.ok).toBe(false);
    expect(unscoped.error).toMatch(/missing scope employees:read/);
  });
});

describe('the loopback session — reads yes, writes never, renewal never', () => {
  let withLoopbackSession: typeof import('../server/mcp/loopback').withLoopbackSession;

  beforeAll(async () => {
    ({ withLoopbackSession } = await import('../server/mcp/loopback'));
  });

  it('authenticates a GET as the person without sliding-renewing the row', async () => {
    await withLoopbackSession(ADMIN_ID, async (bearer) => {
      // sessions.expires_at is timestamp WITHOUT time zone holding a UTC wall
      // clock (drizzle writes/reads it as +0000); tell pg the same so the
      // instant compares against Date.now() honestly.
      const before = await db.query("SELECT (expires_at AT TIME ZONE 'UTC') AS expires_at FROM sessions WHERE token = $1", [bearer]);
      expect(before.rowCount).toBe(1);
      const res = await api('GET', '/api/auth/me', undefined, bearer);
      expect(res.status).toBe(200);
      expect(res.json.id).toBe(ADMIN_ID);
      // A login session would have been pushed to now + 24h here.
      const after = await db.query("SELECT (expires_at AT TIME ZONE 'UTC') AS expires_at, agent_scope FROM sessions WHERE token = $1", [bearer]);
      expect(after.rows[0].agent_scope).toBe('mcp:read');
      expect(new Date(after.rows[0].expires_at).getTime()).toBe(new Date(before.rows[0].expires_at).getTime());
      expect(new Date(after.rows[0].expires_at).getTime()).toBeLessThan(Date.now() + 6 * 60_000);
      expect(new Date(after.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now() + 4 * 60_000);
    });
  });

  it('is refused on POST through requireAuth (server/middleware/auth.ts)', async () => {
    await withLoopbackSession(ADMIN_ID, async (bearer) => {
      const res = await api('POST', '/api/onboarding-templates', { name: 'must not exist' }, bearer);
      expect(res.status).toBe(403);
      expect(res.json).toEqual({ error: 'Read-only agent token.' });
    });
  });

  it('is refused on POST through the global session middleware (server/routes.ts) and on PATCH', async () => {
    await withLoopbackSession(ADMIN_ID, async (bearer) => {
      const post = await api('POST', '/api/equipment-agreements', { employeeId: ADMIN_ID }, bearer);
      expect(post.status).toBe(403);
      expect(post.json).toEqual({ error: 'Read-only agent token.' });
      const patch = await api('PATCH', `/api/users/${ADMIN_ID}`, { timezone: 'UTC' }, bearer);
      expect(patch.status).toBe(403);
      expect(patch.json).toEqual({ error: 'Read-only agent token.' });
    });
  });

  it('cannot manage tokens at all — not even list them', async () => {
    await withLoopbackSession(ADMIN_ID, async (bearer) => {
      const mint = await api('POST', '/api/mcp/tokens', { name: 'escalate', scopes: ['pto:read'] }, bearer);
      expect(mint.status).toBe(403);
      const list = await api('GET', '/api/mcp/tokens', undefined, bearer);
      expect(list.status).toBe(403);
      expect(list.json).toEqual({ error: 'Read-only agent token.' });
    });
  });

  it('is deleted after the call, even when the call throws', async () => {
    let bearerSeen = '';
    await expect(withLoopbackSession(ADMIN_ID, async (bearer) => {
      bearerSeen = bearer;
      throw new Error('boom');
    })).rejects.toThrow('boom');
    const { rows } = await db.query('SELECT 1 FROM sessions WHERE token = $1', [bearerSeen]);
    expect(rows.length).toBe(0);
  });
});

describe('rate limit and revoke', () => {
  it('answers 429 once a token passes 120 requests in a minute', async () => {
    // A bogus bearer: the limiter keys on the bearer's hash and runs before auth,
    // so this never touches the real token's budget.
    const bogus = 'roofhr_rateLimitProbe000000000000000000000000';
    const statuses: number[] = [];
    for (let i = 0; i < 125; i++) {
      const res = await rawMcp(bogus);
      statuses.push(res.status);
      await res.text();
    }
    expect(statuses.slice(0, 100).every((s) => s === 401)).toBe(true);
    expect(statuses[statuses.length - 1]).toBe(429);
  }, 60_000);

  it('revoke → the very next MCP request is 401', async () => {
    const before = await rawMcp(mintedToken);
    expect(before.status).toBe(200);
    await before.text();

    const del = await api('DELETE', `/api/mcp/tokens/${mintedId}`, undefined, ADMIN_TOKEN);
    expect(del.status).toBe(200);
    expect(del.json.revokedAt).toBeTruthy();

    const after = await rawMcp(mintedToken);
    expect(after.status).toBe(401);

    const list = await api('GET', '/api/mcp/tokens', undefined, ADMIN_TOKEN);
    expect(list.json.tokens.some((t: any) => t.id === mintedId)).toBe(false);
  });

  it('an inactive person\'s token stops working without a revoke', async () => {
    const mint = await api('POST', '/api/mcp/tokens', { name: 'emp agent', scopes: ['me:read'] }, EMPLOYEE_TOKEN);
    expect(mint.status).toBe(201);
    const ok = await rawMcp(mint.json.token);
    expect(ok.status).toBe(200);
    await ok.text();
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [EMPLOYEE_ID]);
    try {
      const gone = await rawMcp(mint.json.token);
      expect(gone.status).toBe(401);
    } finally {
      await db.query('UPDATE users SET is_active = true WHERE id = $1', [EMPLOYEE_ID]);
    }
  });
});
