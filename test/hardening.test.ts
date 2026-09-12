/**
 * Regression tests for the 2026-09-12 hardening pass.
 *
 * Each block below pins a defect that was live in production. They are written
 * from the attacker's side where that is the point: the question is not "does
 * the happy path still work" but "can an ordinary employee reach this".
 *
 * The fixture EMPLOYEE is role EMPLOYEE, which is exactly the privilege level
 * that could previously read every colleague's signing token.
 */
import crypto from 'node:crypto';
import pg from 'pg';
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL!;
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN!;
const EMPLOYEE_TOKEN = process.env.TEST_EMPLOYEE_TOKEN!;
const EMPLOYEE_ID = process.env.TEST_EMPLOYEE_ID!;

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

async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try { return await fn(db); } finally { await db.end(); }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('equipment agreements: signing tokens are not readable by colleagues', () => {
  let agreementId: string;
  let realToken: string;

  beforeAll(async () => {
    // An agreement addressed to SOMEONE ELSE, not the fixture employee.
    agreementId = crypto.randomUUID();
    realToken = crypto.randomBytes(32).toString('hex');
    await withDb(db => db.query(
      `INSERT INTO equipment_agreements
         (id, employee_name, employee_email, access_token, items, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW())`,
      [agreementId, 'Someone Else', 'someone.else@example.test', realToken,
       JSON.stringify([{ name: 'Ladder', quantity: 1, received: false }])],
    ));
  });

  it('an EMPLOYEE cannot see another person\'s agreement in the list at all', async () => {
    const res = await api('GET', '/api/equipment-agreements', undefined, EMPLOYEE_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect(res.json.find((a: any) => a.id === agreementId)).toBeUndefined();
  });

  it('no accessToken, signature or IP reaches an EMPLOYEE on any row', async () => {
    const res = await api('GET', '/api/equipment-agreements', undefined, EMPLOYEE_TOKEN);
    for (const row of res.json) {
      expect(row).not.toHaveProperty('accessToken');
      expect(row).not.toHaveProperty('signatureData');
      expect(row).not.toHaveProperty('signatureIp');
    }
    // The whole response body, so a token cannot hide in a nested field.
    expect(JSON.stringify(res.json)).not.toContain(realToken);
  });

  it('fetching another person\'s agreement by id is a 404, not a leak', async () => {
    const res = await api('GET', `/api/equipment-agreements/${agreementId}`, undefined, EMPLOYEE_TOKEN);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.json)).not.toContain(realToken);
  });

  it('an EMPLOYEE cannot delete an agreement', async () => {
    const res = await api('DELETE', `/api/equipment-agreements/${agreementId}`, undefined, EMPLOYEE_TOKEN);
    expect(res.status).toBe(403);
    const still = await withDb(db => db.query('SELECT 1 FROM equipment_agreements WHERE id = $1', [agreementId]));
    expect(still.rowCount).toBe(1);
  });

  it('an EMPLOYEE cannot mint a new agreement (which would hand them a token)', async () => {
    const res = await api('POST', '/api/equipment-agreements', {
      employeeName: 'Forged Person', employeeEmail: 'forged@example.test',
      items: JSON.stringify([{ name: 'Truck', quantity: 1, received: false }]),
    }, EMPLOYEE_TOKEN);
    expect(res.status).toBe(403);
  });

  // CONTROL RUN: the checks above are only meaningful if the admin CAN see
  // these fields. If this fails, the tests above are passing for the wrong
  // reason and prove nothing.
  it('control: an admin still gets accessToken, because the HR view needs it', async () => {
    const res = await api('GET', '/api/equipment-agreements', undefined, ADMIN_TOKEN);
    expect(res.status).toBe(200);
    const row = res.json.find((a: any) => a.id === agreementId);
    expect(row).toBeDefined();
    expect(row.accessToken).toBe(realToken);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('rate-limit reset is no longer a public kill switch', () => {
  it('GET /api/public/reset-rate-limits is 404 without the key', async () => {
    const res = await api('GET', '/api/public/reset-rate-limits');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.json ?? {})).not.toContain('Rate limits cleared');
  });

  it('a wrong key is also 404, not a 401 that confirms the route exists', async () => {
    const res = await fetch(`${BASE_URL}/api/public/reset-rate-limits`, { headers: { 'x-reset-key': 'wrong' } });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('candidate purge: cascaded, transactional, audited', () => {
  async function seedCandidateWithChildren() {
    const created = await api('POST', '/api/candidates', {
      firstName: 'Purge', lastName: 'Test', email: `purge.${Date.now()}.${Math.random()}@example.test`,
      phone: '555-0199', position: 'Insurance Sales',
    }, ADMIN_TOKEN);
    expect(created.status).toBeLessThan(300);
    const id = created.json.id as string;

    await withDb(async db => {
      await db.query(
        `INSERT INTO candidate_notes (id, candidate_id, author_id, content, type, created_at)
         VALUES ($1, $2, $3, 'interview went well', 'INTERVIEW', NOW())`,
        [crypto.randomUUID(), id, EMPLOYEE_ID],
      );
      await db.query(
        `INSERT INTO candidate_status_history
           (id, candidate_id, previous_status, new_status, changed_by, changed_by_name, created_at)
         VALUES ($1, $2, 'NEW', 'SCREENING', $3, 'Test Runner', NOW())`,
        [crypto.randomUUID(), id, EMPLOYEE_ID],
      );
    });
    return id;
  }

  it('an ordinary MANAGER can no longer purge; it is HR admin and above', async () => {
    const id = await seedCandidateWithChildren();
    const res = await api('DELETE', `/api/candidates/${id}`, undefined, EMPLOYEE_TOKEN);
    expect(res.status).toBe(403);
    const still = await withDb(db => db.query('SELECT 1 FROM candidates WHERE id = $1', [id]));
    expect(still.rowCount).toBe(1);
  });

  it('purging removes the children too, instead of stranding them', async () => {
    const id = await seedCandidateWithChildren();

    const before = await withDb(db => db.query(
      'SELECT (SELECT count(*) FROM candidate_notes WHERE candidate_id = $1) AS notes,'
      + ' (SELECT count(*) FROM candidate_status_history WHERE candidate_id = $1) AS hist', [id]));
    expect(Number(before.rows[0].notes)).toBe(1);
    expect(Number(before.rows[0].hist)).toBeGreaterThanOrEqual(1);

    const res = await api('DELETE', `/api/candidates/${id}`, undefined, ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.deleted.candidate_notes).toBe(1);

    const after = await withDb(db => db.query(
      'SELECT (SELECT count(*) FROM candidates WHERE id = $1) AS c,'
      + ' (SELECT count(*) FROM candidate_notes WHERE candidate_id = $1) AS notes,'
      + ' (SELECT count(*) FROM candidate_status_history WHERE candidate_id = $1) AS hist', [id]));
    expect(Number(after.rows[0].c)).toBe(0);
    expect(Number(after.rows[0].notes)).toBe(0);
    expect(Number(after.rows[0].hist)).toBe(0);
  });

  it('writes an audit row holding the deleted person, so the record survives', async () => {
    const id = await seedCandidateWithChildren();
    await api('DELETE', `/api/candidates/${id}`, undefined, ADMIN_TOKEN);

    const audit = await withDb(db => db.query(
      `SELECT action, resource_type, previous_value FROM system_audit_logs
       WHERE resource_id = $1 AND resource_type = 'candidate'`, [id]));
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].action).toBe('DELETE');
    expect(JSON.parse(audit.rows[0].previous_value).firstName).toBe('Purge');
  });

  it('a signed contract is detached, never destroyed with the candidate', async () => {
    const id = await seedCandidateWithChildren();
    const contractId = crypto.randomUUID();
    await withDb(db => db.query(
      `INSERT INTO employee_contracts
         (id, candidate_id, recipient_type, recipient_email, recipient_name, title, content, status, created_by, created_at, updated_at)
       VALUES ($1, $2, 'CANDIDATE', 'purge@example.test', 'Purge Test', 'Offer', 'body', 'SIGNED', $3, NOW(), NOW())`,
      [contractId, id, EMPLOYEE_ID]));

    const res = await api('DELETE', `/api/candidates/${id}`, undefined, ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.json.contractsDetached).toBe(1);

    const contract = await withDb(db => db.query(
      'SELECT candidate_id, status FROM employee_contracts WHERE id = $1', [contractId]));
    expect(contract.rowCount).toBe(1);              // still there
    expect(contract.rows[0].candidate_id).toBeNull(); // just unlinked
    expect(contract.rows[0].status).toBe('SIGNED');
  });

  it('a missing candidate is a 404 and writes no audit row', async () => {
    const ghost = crypto.randomUUID();
    const res = await api('DELETE', `/api/candidates/${ghost}`, undefined, ADMIN_TOKEN);
    expect(res.status).toBe(404);
    const audit = await withDb(db => db.query(
      'SELECT 1 FROM system_audit_logs WHERE resource_id = $1', [ghost]));
    expect(audit.rowCount).toBe(0);
  });
});
