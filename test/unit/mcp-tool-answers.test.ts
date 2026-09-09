/**
 * MCP pass one — the answers the tools actually give.
 *
 * The area test proves the registry is well formed. This one proves the tools
 * answer the question that was asked, because on 2026-09-09 they did not: a
 * live agent on prod said one person was off in September when three were,
 * said Ford Barsi's PTO balance was unavailable when it was two calls away,
 * and reported "no notes" for a candidate whose id it had passed, having been
 * handed the whole 3,423-row pipeline starting at a stranger.
 *
 * Every case here is one of those transcripts, driven through the real tool's
 * `run` with the loopback swapped for a fixture, so the assertion covers the
 * route the tool chose AND the projection it applied — the two places the
 * wrong answers came from. No server, no database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ path: '', query: undefined as unknown, fixture: null as unknown }));

vi.mock('../../server/mcp/loopback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/mcp/loopback')>();
  return {
    ...actual,
    loopbackGet: async (_ctx: unknown, options: any) => {
      h.path = options.path;
      h.query = options.query;
      return { json: options.pick ? options.pick(h.fixture) : h.fixture };
    },
  };
});

const { MCP_TOOLS } = await import('../../server/mcp/tools');

const ME = 'me-0001';
const ctx = { auth: { principal: { id: ME } }, requestId: 'test', signal: new AbortController().signal } as any;

/** Run a tool the way the MCP server does, against `fixture` as the route's answer. */
async function call(name: string, args: Record<string, unknown>, fixture: unknown): Promise<any> {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  h.fixture = fixture;
  h.path = '';
  h.query = undefined;
  const result: any = await tool.run(ctx, args);
  if (result.isError) return result;
  return result.json;
}

// The September that was answered wrong, plus a request that straddles the
// month boundary — the one an eyeball skim is most likely to drop.
const CALENDAR = [
  { id: 'c1', startDate: '2026-08-12', endDate: '2026-08-14', employeeId: 'u1', employeeName: 'Ryan Ferguson' },
  { id: 'c2', startDate: '2026-09-23', endDate: '2026-09-25', employeeId: 'u2', employeeName: 'Jack Strycharz' },
  { id: 'c3', startDate: '2026-09-04', endDate: '2026-09-04', employeeId: 'u3', employeeName: 'Steven Saravia' },
  { id: 'c4', startDate: '2026-08-31', endDate: '2026-09-02', employeeId: 'u4', employeeName: 'Amber Couch' },
  { id: 'c5', startDate: '2026-10-19', endDate: '2026-10-19', employeeId: 'u5', employeeName: 'Ford Barsi' },
];

const DIRECTORY = [
  { id: 'u9', firstName: 'Ford', lastName: 'Barsi', email: 'ford.barsi@theroofdocs.com', role: 'ADMIN', department: 'Administration', isActive: true },
  { id: 'u8', firstName: 'Garett', lastName: 'Dunn-Ford', email: 'garrett.d@theroofdocs.com', role: 'SALES_REP', department: 'Sales', isActive: true },
  { id: 'u7', firstName: 'Amber', lastName: 'Couch', email: 'amber@theroofdocs.com', role: 'EMPLOYEE', department: 'Sales', isActive: false },
];

const CANDIDATES = [
  { id: 'k1', firstName: 'Cedrick', lastName: 'Powell', status: 'DEAD_BY_US', position: 'Insurance Sales' },
  { id: 'k2', firstName: 'Luca', lastName: 'Orlando', status: 'HIRED', position: 'Insurance Sales' },
];

beforeEach(() => {
  h.path = '';
  h.query = undefined;
  h.fixture = null;
});

describe('pto — who is out, and when', () => {
  it('a month window returns every overlapping request, not the first one noticed', async () => {
    const out = await call('pto', { view: 'calendar', month: '2026-09' }, CALENDAR);
    expect(out.window).toBe('2026-09');
    expect(out.totalMatching).toBe(3);
    expect(out.timeOff.map((r: any) => r.employeeName)).toEqual([
      'Amber Couch', // 08-31 → 09-02 straddles the boundary and still counts
      'Steven Saravia',
      'Jack Strycharz',
    ]);
  });

  it('next month is the same call with the next month', async () => {
    const out = await call('pto', { view: 'calendar', month: '2026-10' }, CALENDAR);
    expect(out.totalMatching).toBe(1);
    expect(out.timeOff[0].employeeName).toBe('Ford Barsi');
  });

  it('an explicit start/end window is honoured on both ends', async () => {
    const out = await call('pto', { view: 'calendar', startDate: '2026-09-05', endDate: '2026-09-30' }, CALENDAR);
    expect(out.timeOff.map((r: any) => r.id)).toEqual(['c2']);
    expect(out.window).toBe('2026-09-05..2026-09-30');
  });

  it('with no window nothing is dropped, and the answer says so', async () => {
    const out = await call('pto', { view: 'calendar' }, CALENDAR);
    expect(out.totalMatching).toBe(CALENDAR.length);
    expect(out.window).toBe('all dates on record');
  });

  it('a cut list still reports what it matched', async () => {
    const out = await call('pto', { view: 'calendar', limit: 2 }, CALENDAR);
    expect(out.totalMatching).toBe(5);
    expect(out.countReturned).toBe(2);
  });

  it('requests filter by status and window together', async () => {
    const requests = [
      { id: 'r1', employeeId: 'u1', status: 'PENDING', startDate: '2026-09-08', endDate: '2026-09-10' },
      { id: 'r2', employeeId: 'u1', status: 'APPROVED', startDate: '2026-09-08', endDate: '2026-09-10' },
      { id: 'r3', employeeId: 'u1', status: 'APPROVED', startDate: '2026-11-01', endDate: '2026-11-02' },
    ];
    const out = await call('pto', { status: 'approved', month: '2026-09' }, requests);
    expect(out.requests.map((r: any) => r.id)).toEqual(['r2']);
  });
});

describe('pto — how many days someone has left', () => {
  const POLICIES = [
    { employeeId: 'u9', policyLevel: 'COMPANY', totalDays: 17, usedDays: 37, remainingDays: 0, vacationDays: 10 },
    { employeeId: 'u8', policyLevel: 'COMPANY', totalDays: 0, usedDays: 0, remainingDays: 0, vacationDays: 0 },
  ];

  it('answers the balance for another employee', async () => {
    const out = await call('pto', { view: 'balance', employeeId: 'u9' }, POLICIES);
    expect(out.remainingDays).toBe(0);
    expect(out.totalDays).toBe(17);
  });

  it('never reaches the route that creates a policy row as a side effect of reading one', async () => {
    await call('pto', { view: 'balance', employeeId: 'u9' }, POLICIES);
    expect(h.path).toBe('/api/pto-policies');
    await call('pto', { view: 'employee_policy', employeeId: 'u8' }, POLICIES);
    expect(h.path).toBe('/api/pto-policies');
    // /api/pto-policies/employee/:id writes a default row on a miss. A read tool must not.
    expect(h.path).not.toContain('/employee/');
  });

  it('says so plainly when an employee has no individual policy', async () => {
    const out = await call('pto', { view: 'balance', employeeId: 'nobody' }, POLICIES);
    expect(out.notFound).toMatch(/no individual pto policy/i);
    expect(out.remainingDays).toBeUndefined();
  });

  it('asking for your own balance reads your own portal', async () => {
    await call('pto', { view: 'balance' }, {});
    expect(h.path).toBe('/api/employee-portal/pto-balance');
    await call('pto', { view: 'balance', employeeId: ME }, {});
    expect(h.path).toBe('/api/employee-portal/pto-balance');
  });
});

describe('employees — turning a name into an id', () => {
  it('finds a person by partial name', async () => {
    const out = await call('employees', { search: 'ford barsi' }, DIRECTORY);
    expect(out.totalMatching).toBe(1);
    expect(out.employees[0].id).toBe('u9');
  });

  it('a surname substring matches the surname too, and does not silently pick one', async () => {
    const out = await call('employees', { search: 'ford' }, DIRECTORY);
    expect(out.employees.map((e: any) => e.name)).toEqual(['Ford Barsi', 'Garett Dunn-Ford']);
  });

  it('finds a person by email', async () => {
    const out = await call('employees', { search: 'AMBER@theroofdocs' }, DIRECTORY);
    expect(out.employees[0].name).toBe('Amber Couch');
  });

  it('department and activeOnly narrow the directory', async () => {
    const out = await call('employees', { department: 'sales', activeOnly: true }, DIRECTORY);
    expect(out.employees.map((e: any) => e.id)).toEqual(['u8']);
  });

  it('an employeeId returns that employee, not the company', async () => {
    const out = await call('employees', { employeeId: 'u9' }, DIRECTORY);
    expect(out.name).toBe('Ford Barsi');
    expect(out.employees).toBeUndefined();
  });

  it('a directory read reports the full headcount even when it is cut', async () => {
    const out = await call('employees', { limit: 1 }, DIRECTORY);
    expect(out.totalMatching).toBe(3);
    expect(out.countReturned).toBe(1);
  });

  it('notes still require an explicit view, and reach the notes route', async () => {
    await call('employees', { view: 'notes', employeeId: 'u9' }, []);
    expect(h.path).toBe('/api/employees/u9/notes');
  });
});

describe('an id that was passed is an id that is used', () => {
  it('recruiting answers about the candidate whose id it was given', async () => {
    const out = await call('recruiting', { candidateId: 'k2' }, CANDIDATES);
    expect(out.name).toBe('Luca Orlando');
    // The bug: this used to come back as the whole pipeline, starting at Cedrick Powell.
    expect(out.candidates).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Cedrick');
  });

  it('recruiting says a candidate is missing rather than answering about another one', async () => {
    const out = await call('recruiting', { candidateId: 'ghost' }, CANDIDATES);
    expect(out.notFound).toBeTruthy();
    expect(out.name).toBeUndefined();
  });

  it('candidate notes reach the notes route for that candidate', async () => {
    await call('recruiting', { view: 'candidate_notes', candidateId: 'k2' }, []);
    expect(h.path).toBe('/api/candidates/k2/notes');
  });

  it('a bare list is still a list', async () => {
    const out = await call('recruiting', {}, CANDIDATES);
    expect(out.candidates).toHaveLength(2);
  });

  for (const [tool, args, path] of [
    ['workflows', { workflowId: 'w1' }, '/api/workflows/w1'],
    ['meetings', { meetingId: 'm1' }, '/api/meetings/m1'],
    ['onboarding', { id: 'o1' }, '/api/onboarding-instances/o1'],
    ['attendance', { sessionId: 's1' }, '/api/attendance/sessions/s1'],
    ['territories', { territoryId: 't1' }, '/api/territories/t1'],
    ['documents', { id: 'd1' }, '/api/documents/d1'],
  ] as [string, Record<string, unknown>, string][]) {
    it(`${tool} with an id reads that record, not the list`, async () => {
      await call(tool, args, {});
      expect(h.path).toBe(path);
    });
  }
});
