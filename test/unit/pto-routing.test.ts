import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routePtoRequestRecipients } from '../../shared/constants/pto-routing';
import { getPTOApproversForEmployee as legacyRouting, PTO_APPROVER_EMAILS } from '../../shared/constants/roles';

const state = vi.hoisted(() => ({ grants: [] as any[] }));
vi.mock('../../server/db', () => ({
  db: { select: () => ({ from: () => ({ where: async () => state.grants }) }) },
}));
import { getPTOApproversForEmployee, refreshAuthzCache } from '../../server/services/authzService';

const ford = 'ford.barsi@theroofdocs.com';
const greg = 'greg.campbell@theroofdocs.com';
const employees = [
  'cadell.barnes@theroofdocs.com', 'colby.mahlstede@theroofdocs.com',
  'service@theroofdocs.com', 'john.dickey@theroofdocs.com', 'jack@theroofdocs.com',
];

beforeEach(async () => {
  state.grants = [
    ...PTO_APPROVER_EMAILS.map(principal => ({ capability: 'pto.approve.core', principalType: 'USER_EMAIL', principal })),
    ...[ford, 'reese.samala@theroofdocs.com'].map(principal => ({ capability: 'pto.route.senior_manager', principalType: 'USER_EMAIL', principal })),
    ...['ahmed.mahmoud@theroofdocs.com', 'oliver.brown@theroofdocs.com'].map(principal => ({ capability: 'pto.approve.senior', principalType: 'USER_EMAIL', principal })),
    { capability: 'pto.approve.department', principalType: 'USER_EMAIL', principal: greg, metadata: { department: 'Production' } },
  ];
  await refreshAuthzCache();
});

describe('Project Manager PTO routing', () => {
  for (const [label, route] of [['DB-backed', getPTOApproversForEmployee], ['legacy', legacyRouting]] as const) {
    it.each(employees)(`${label}: routes %s to Greg instead of Ford`, email => {
      const recipients = route(email, 'Production');
      expect(recipients).not.toContain(ford);
      expect(recipients.filter(recipient => recipient === greg)).toHaveLength(1);
      expect(recipients).toEqual(expect.arrayContaining(PTO_APPROVER_EMAILS.filter(email => email !== ford)));
    });
    it(`${label}: leaves other employees and senior routing unchanged`, () => {
      expect(route('evan.g@theroofdocs.com', 'Sales')).toEqual(PTO_APPROVER_EMAILS);
      expect(route('other@theroofdocs.com', 'Production')).toEqual(PTO_APPROVER_EMAILS);
      expect(route(ford, 'Administration')).toEqual(['ahmed.mahmoud@theroofdocs.com', 'oliver.brown@theroofdocs.com']);
    });
  }
  it.each(employees)('Susan recipient list replaces Ford and adds Greg for %s', email => {
    const susanRecipients = PTO_APPROVER_EMAILS.filter(email => email !== greg);
    expect(routePtoRequestRecipients(email, susanRecipients)).toEqual([
      ...susanRecipients.filter(email => email !== ford), greg,
    ]);
  });
  it('normalizes account emails without duplicating Greg or mutating the input', () => {
    const input = [ford.toUpperCase(), greg.toUpperCase(), greg];
    expect(routePtoRequestRecipients(' JACK@THEROOFDOCS.COM ', input)).toEqual([greg]);
    expect(input).toHaveLength(3);
  });
  it('preserves unrelated custom DB grants', async () => {
    state.grants.push({ capability: 'pto.approve.core', principalType: 'USER_EMAIL', principal: 'backup@example.test' });
    await refreshAuthzCache();
    expect(getPTOApproversForEmployee(employees[0], 'Production')).toContain('backup@example.test');
  });
});
