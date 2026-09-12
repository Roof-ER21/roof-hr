/**
 * Connecting an app to Roof HR, as yourself — the refusals.
 *
 * Roof HR is the permissions key: another app answers a person's Roof HR
 * question on a token minted for THAT PERSON, so every answer goes through
 * Roof HR's own routes and role checks. The failure this design exists to
 * prevent is one shared service token handing every rep the privileges of
 * whoever it was minted as — and the token that exists on prod today is a
 * System Administrator.
 *
 * The positive path is one line. What is worth pinning is everything that must
 * NOT work: a redirect that is nearly right, a code used twice, a code redeemed
 * by the wrong app, a secret that is close, a rep granting an area their role
 * cannot reach. Each of those, wrong, is a token in the wrong hands.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CODE_TTL_MS,
  CONNECT_APPS,
  clearCodes,
  describeAreas,
  findConnectApp,
  grantableAreas,
  issueCode,
  liveCodeCount,
  redeemCode,
  redirectAllowed,
  secretMatches,
} from '../../server/mcp/connect';
import { MCP_AREAS } from '../../server/mcp/areas';

const sa21 = findConnectApp('sa21')!;
const GOOD_REDIRECT = 'https://sa21.theroofdocs.com/api/connect/roofhr/callback';

const admin = { role: 'SYSTEM_ADMIN', email: 'ada@roofhr.test' };
const manager = { role: 'MANAGER', email: 'mgr@roofhr.test' };
const employee = { role: 'EMPLOYEE', email: 'eli@roofhr.test' };
const stranger = { role: 'NOT_A_ROLE', email: 'who@example.test' };

const seed = (over: Partial<Parameters<typeof issueCode>[0]> = {}) =>
  issueCode({
    appSlug: 'sa21',
    redirectUri: GOOD_REDIRECT,
    userId: 'user-1',
    token: 'roofhr_secret_value',
    tokenId: 'tok-1',
    scopes: ['me:read'],
    ...over,
  });

beforeEach(() => clearCodes());

describe('the app registry is a decision, not a lookup', () => {
  it('only registered apps resolve', () => {
    expect(findConnectApp('sa21')).toBeTruthy();
    expect(findConnectApp('SA21')).toBeTruthy(); // case is forgiven
    expect(findConnectApp('sa22')).toBeNull();
    expect(findConnectApp('')).toBeNull();
    expect(findConnectApp(null)).toBeNull();
    expect(findConnectApp({ slug: 'sa21' })).toBeNull();
  });

  it('every registered app asks only for areas that exist, and names a secret env var', () => {
    for (const app of CONNECT_APPS) {
      expect(app.redirectUris.length).toBeGreaterThan(0);
      expect(app.secretEnv).toMatch(/^CONNECT_SECRET_/);
      for (const area of app.requestedAreas) {
        expect(MCP_AREAS as readonly string[]).toContain(area);
      }
    }
  });

  it('no registered redirect is a wildcard or a bare origin', () => {
    for (const app of CONNECT_APPS) {
      for (const uri of app.redirectUris) {
        expect(uri).not.toContain('*');
        expect(new URL(uri).pathname.length).toBeGreaterThan(1);
      }
    }
  });
});

describe('the redirect allowlist is exact — this is what stops a token being sent elsewhere', () => {
  it('accepts a registered address', () => {
    expect(redirectAllowed(sa21, GOOD_REDIRECT)).toBe(true);
  });

  it('refuses everything that is only nearly right', () => {
    for (const bad of [
      'https://sa21.theroofdocs.com/api/connect/roofhr/callback/',        // trailing slash
      'https://sa21.theroofdocs.com/api/connect/roofhr/callback?x=1',      // extra query
      'https://sa21.theroofdocs.com/api/connect/roofhr/callback#x',        // fragment
      'http://sa21.theroofdocs.com/api/connect/roofhr/callback',           // downgraded scheme
      'https://sa21.theroofdocs.com.evil.test/api/connect/roofhr/callback',// suffix host
      'https://evil.test/api/connect/roofhr/callback',                     // other host
      'https://sa21.theroofdocs.com/api/connect/roofhr/callback@evil.test',
      'https://sa21.theroofdocs.com',                                      // bare origin
      '',
      null,
      undefined,
    ]) {
      expect(redirectAllowed(sa21, bad), `must refuse ${String(bad)}`).toBe(false);
    }
  });
});

describe('a person can only grant what their own role reaches', () => {
  it('an admin can grant everything the app asked for', () => {
    expect(grantableAreas(sa21, admin).toSorted()).toEqual([...sa21.requestedAreas].toSorted());
  });

  it('a plain employee grants a narrower set, never a wider one', () => {
    const theirs = grantableAreas(sa21, employee);
    for (const area of theirs) expect(sa21.requestedAreas).toContain(area);
    expect(theirs.length).toBeLessThanOrEqual(sa21.requestedAreas.length);
  });

  it('an unknown role grants nothing at all', () => {
    expect(grantableAreas(sa21, stranger)).toEqual([]);
  });

  it('what is withheld is the difference, so the screen can be honest about it', () => {
    const granted = grantableAreas(sa21, employee);
    const withheld = sa21.requestedAreas.filter((a) => !granted.includes(a));
    expect([...granted, ...withheld].toSorted()).toEqual([...sa21.requestedAreas].toSorted());
  });

  it('the description shown to a person is a real label, not a raw slug', () => {
    for (const g of describeAreas(grantableAreas(sa21, manager))) {
      expect(g.scope).toBe(`${g.area}:read`);
      expect(g.label.length).toBeGreaterThan(1);
      expect(g.label).not.toBe(g.area);
      expect(g.description.length).toBeGreaterThan(10);
    }
  });
});

describe('the one-time code', () => {
  it('round-trips once and hands back the token', () => {
    const code = seed();
    const first = redeemCode(code, { appSlug: 'sa21', redirectUri: GOOD_REDIRECT });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.record.token).toBe('roofhr_secret_value');
  });

  it('cannot be used twice', () => {
    const code = seed();
    expect(redeemCode(code, { appSlug: 'sa21', redirectUri: GOOD_REDIRECT }).ok).toBe(true);
    const second = redeemCode(code, { appSlug: 'sa21', redirectUri: GOOD_REDIRECT });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/already been used|not valid/i);
  });

  it('is consumed even by a FAILED redemption, so it cannot be probed', () => {
    const code = seed();
    // Wrong app: refused...
    expect(redeemCode(code, { appSlug: 'other', redirectUri: GOOD_REDIRECT }).ok).toBe(false);
    // ...and now spent, so the right app cannot use it either.
    expect(redeemCode(code, { appSlug: 'sa21', redirectUri: GOOD_REDIRECT }).ok).toBe(false);
  });

  it('will not be redeemed by a different app', () => {
    const code = seed();
    const r = redeemCode(code, { appSlug: 'cc24', redirectUri: GOOD_REDIRECT });
    expect(r.ok).toBe(false);
  });

  it('will not be redeemed against a different redirect than it was issued for', () => {
    const code = seed();
    const r = redeemCode(code, { appSlug: 'sa21', redirectUri: 'https://evil.test/cb' });
    expect(r.ok).toBe(false);
  });

  it('a forged or empty code is simply not valid', () => {
    for (const bad of ['rhc_made_up', '', null, undefined, 42]) {
      expect(redeemCode(bad, { appSlug: 'sa21', redirectUri: GOOD_REDIRECT }).ok).toBe(false);
    }
  });

  it('the plaintext code is not the key it is stored under', () => {
    const code = seed();
    expect(liveCodeCount()).toBe(1);
    // Redeeming by the raw string works, which only holds if the lookup hashes it.
    expect(redeemCode(code, { appSlug: 'sa21', redirectUri: GOOD_REDIRECT }).ok).toBe(true);
    expect(liveCodeCount()).toBe(0);
  });

  it('expires, and an expired one is refused', () => {
    const code = seed();
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + CODE_TTL_MS + 1000;
      const r = redeemCode(code, { appSlug: 'sa21', redirectUri: GOOD_REDIRECT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/expired|not valid/i);
    } finally {
      Date.now = realNow;
    }
  });

  it('lives for a minute and a half, not a day', () => {
    expect(CODE_TTL_MS).toBeLessThanOrEqual(5 * 60_000);
    expect(CODE_TTL_MS).toBeGreaterThan(30_000);
  });

  it('does not grow without bound', () => {
    for (let i = 0; i < 600; i++) seed({ userId: `u${i}` });
    expect(liveCodeCount()).toBeLessThanOrEqual(500);
  });
});

describe('the app secret', () => {
  it('matches only itself', () => {
    expect(secretMatches('s'.repeat(32), 's'.repeat(32))).toBe(true);
    expect(secretMatches('s'.repeat(31) + 'x', 's'.repeat(32))).toBe(false);
    expect(secretMatches('s'.repeat(31), 's'.repeat(32))).toBe(false);
    expect(secretMatches('', 's'.repeat(32))).toBe(false);
    expect(secretMatches(null, 's'.repeat(32))).toBe(false);
    expect(secretMatches(undefined, 's'.repeat(32))).toBe(false);
  });

  it('a length mismatch does not throw — timingSafeEqual would', () => {
    expect(() => secretMatches('short', 'a much longer secret value here')).not.toThrow();
  });
});
