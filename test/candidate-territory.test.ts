/**
 * A candidate's location (territory) can be changed after it's first set, and
 * cleared (9/11 ask: "they can't change the location of a candidate once it's
 * set"). The list endpoint carries the new territory back to the board.
 */
import crypto from 'node:crypto';
import pg from 'pg';
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL!;
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN!;
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

// Seeded straight into the DB: POST /api/territories only admits
// TRUE_ADMIN / ADMIN / GENERAL_MANAGER, and the fixture admin is SYSTEM_ADMIN.
async function territory(name: string, region: string) {
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    const id = crypto.randomUUID();
    await db.query('INSERT INTO territories (id, name, region, is_active) VALUES ($1, $2, $3, true)', [id, name, region]);
    return id;
  } finally {
    await db.end();
  }
}

async function onBoard(id: string) {
  const list = await api('GET', '/api/candidates', undefined, ADMIN_TOKEN);
  expect(list.status).toBe(200);
  const rows = Array.isArray(list.json) ? list.json : list.json.candidates;
  return rows.find((c: any) => c.id === id);
}

describe('candidate territory', () => {
  it('set → change → clear, and the board shows each step', async () => {
    const dmv = await territory(`DMV-${Date.now()}`, 'Virginia');
    const pitt = await territory(`PITT-${Date.now()}`, 'Pennsylvania');

    const created = await api('POST', '/api/candidates', {
      firstName: 'Tara', lastName: 'Territory', email: `tara.${Date.now()}@example.test`, phone: '555-0101', position: 'Insurance Sales',
    }, ADMIN_TOKEN);
    expect(created.status).toBeLessThan(300);
    const id = created.json.id as string;

    expect((await api('PATCH', `/api/candidates/${id}`, { territoryId: dmv }, ADMIN_TOKEN)).status).toBe(200);
    expect((await onBoard(id)).territory?.id).toBe(dmv);

    // The ask: changing it once it's set.
    expect((await api('PATCH', `/api/candidates/${id}`, { territoryId: pitt }, ADMIN_TOKEN)).status).toBe(200);
    const moved = await onBoard(id);
    expect(moved.territoryId).toBe(pitt);
    expect(moved.territory?.region).toBe('Pennsylvania');

    // And clearing it.
    expect((await api('PATCH', `/api/candidates/${id}`, { territoryId: null }, ADMIN_TOKEN)).status).toBe(200);
    const cleared = await onBoard(id);
    expect(cleared.territoryId).toBeNull();
    expect(cleared.territory).toBeNull();
  });

  it('a plain employee still cannot move a candidate', async () => {
    const created = await api('POST', '/api/candidates', { firstName: 'No', lastName: 'Access', email: `no.${Date.now()}@example.test` }, ADMIN_TOKEN);
    const r = await api('PATCH', `/api/candidates/${created.json.id}`, { territoryId: null }, EMPLOYEE_TOKEN);
    expect(r.status).toBe(403);
  });
});
