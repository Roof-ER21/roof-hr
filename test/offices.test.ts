/**
 * Offices as data (migration 0011), end to end against the booted test server:
 *
 *   - boot seeds DMV / PA / RICHMOND / PITT (Ryan's Pittsburgh ask, 9/9)
 *   - anyone signed in can list them; only an admin can add / edit / remove
 *   - the welcome email renders the chosen office's address and meet-person,
 *     falls back to DMV for an unknown key, and still resolves a removed office
 *     so an old hire's re-send keeps its address
 *   - a hidden (disabled) office leaves the pickers but stays in the admin list
 */
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

async function previewFor(officeLocation: string) {
  const r = await api('POST', '/api/email/welcome-preview', { firstName: 'Semaj', officeLocation }, ADMIN_TOKEN);
  expect(r.status).toBe(200);
  return String(r.json.html);
}

const PITT_ADDRESS = '50 Pennwood Pl Suite 329, Warrendale, PA 15086';
const DMV_ADDRESS = '8100 Boone Blvd Suite 400, Vienna, VA 22182';

describe('offices', () => {
  it('boot seeded the four offices, Pittsburgh included', async () => {
    const r = await api('GET', '/api/offices', undefined, EMPLOYEE_TOKEN);
    expect(r.status).toBe(200);
    const keys = r.json.map((o: any) => o.key);
    expect(keys).toEqual(['DMV', 'PA', 'RICHMOND', 'PITT']);
    const pitt = r.json.find((o: any) => o.key === 'PITT');
    expect(pitt.address).toBe(PITT_ADDRESS);
    expect(pitt.meetPerson).toBe('Josh Morris and Jay Waseem');
  });

  it('the welcome email reads address and meet-person from the office', async () => {
    const html = await previewFor('PITT');
    expect(html).toContain(PITT_ADDRESS);
    expect(html).toContain('Josh Morris and Jay Waseem');
    expect(html).not.toContain(DMV_ADDRESS);
  });

  it('an unknown office key falls back to DMV', async () => {
    const html = await previewFor('NOWHERE');
    expect(html).toContain(DMV_ADDRESS);
    expect(html).toContain('Reese Samala');
  });

  it('only admins can change the list', async () => {
    const body = { label: 'Nope', address: '1 Nope St' };
    expect((await api('POST', '/api/offices', body, EMPLOYEE_TOKEN)).status).toBe(403);
    expect((await api('POST', '/api/offices', body)).status).toBe(401);
    expect((await api('POST', '/api/offices', { label: 'No address' }, ADMIN_TOKEN)).status).toBe(400);
  });

  it('admin add → edit → hide → remove, and every step shows in the pickers and the email', async () => {
    const created = await api(
      'POST',
      '/api/offices',
      { label: 'Harrisburg (PA)', address: '10 Market St, Harrisburg, PA 17101', meetPerson: 'Dana Ortiz' },
      ADMIN_TOKEN,
    );
    expect(created.status).toBe(201);
    expect(created.json.key).toBe('HARRISBURG_PA');
    const id = created.json.id as string;

    // Same name twice is a conflict, not a silent duplicate.
    expect((await api('POST', '/api/offices', { label: 'Harrisburg (PA)', address: 'x' }, ADMIN_TOKEN)).status).toBe(409);

    let list = (await api('GET', '/api/offices', undefined, EMPLOYEE_TOKEN)).json;
    expect(list.map((o: any) => o.key)).toContain('HARRISBURG_PA');

    let html = await previewFor('HARRISBURG_PA');
    expect(html).toContain('10 Market St, Harrisburg, PA 17101');
    expect(html).toContain('Dana Ortiz');

    // Edit: the email follows the new address immediately.
    const edited = await api('PATCH', `/api/offices/${id}`, { address: '12 Market St, Harrisburg, PA 17101', meetPerson: '' }, ADMIN_TOKEN);
    expect(edited.status).toBe(200);
    expect(edited.json.meetPerson).toBe('the team');
    html = await previewFor('HARRISBURG_PA');
    expect(html).toContain('12 Market St, Harrisburg, PA 17101');
    expect(html).toContain('meet with <strong>the team</strong>');

    // Hide: gone from the pickers, still in the admin list, still renders.
    expect((await api('PATCH', `/api/offices/${id}`, { enabled: false }, ADMIN_TOKEN)).status).toBe(200);
    list = (await api('GET', '/api/offices', undefined, EMPLOYEE_TOKEN)).json;
    expect(list.map((o: any) => o.key)).not.toContain('HARRISBURG_PA');
    const adminList = (await api('GET', '/api/offices?all=true', undefined, ADMIN_TOKEN)).json;
    expect(adminList.find((o: any) => o.key === 'HARRISBURG_PA')?.enabled).toBe(false);
    // ?all=true from a non-admin is just the active list.
    const empAll = (await api('GET', '/api/offices?all=true', undefined, EMPLOYEE_TOKEN)).json;
    expect(empAll.map((o: any) => o.key)).not.toContain('HARRISBURG_PA');
    html = await previewFor('HARRISBURG_PA');
    expect(html).toContain('12 Market St, Harrisburg, PA 17101');

    // Remove: soft — leaves every list, but an old hire's key still resolves.
    expect((await api('DELETE', `/api/offices/${id}`, undefined, EMPLOYEE_TOKEN)).status).toBe(403);
    expect((await api('DELETE', `/api/offices/${id}`, undefined, ADMIN_TOKEN)).status).toBe(200);
    expect((await api('DELETE', `/api/offices/${id}`, undefined, ADMIN_TOKEN)).status).toBe(404);
    const afterRemove = (await api('GET', '/api/offices?all=true', undefined, ADMIN_TOKEN)).json;
    expect(afterRemove.map((o: any) => o.key)).not.toContain('HARRISBURG_PA');
    html = await previewFor('HARRISBURG_PA');
    expect(html).toContain('12 Market St, Harrisburg, PA 17101');

    // Adding it back under the same name revives the row (same key, same id).
    const revived = await api('POST', '/api/offices', { label: 'Harrisburg (PA)', address: '14 Market St' }, ADMIN_TOKEN);
    expect(revived.status).toBe(201);
    expect(revived.json.id).toBe(id);
    expect(revived.json.enabled).toBe(true);
  });
});
