/**
 * MCP pass one — the area list, the tool registry behind it, and the scope
 * validation a person meets when minting a token.
 *
 * No server, no database query: the tool registry opens no pool and the
 * loopback helper imports its db lazily.
 */
import { describe, expect, it } from 'vitest';
import { assertAreasCovered, parseScopes } from '@omj21/mcp21';
import {
  MCP_AREAS,
  MCP_AREA_LABELS,
  mintableAreasForUser,
  userCanMintArea,
  validateRequestedScopes,
} from '../../server/mcp/areas';
import { MCP_TOOLS } from '../../server/mcp/tools';
import { ALL_ROLES, SUPER_ADMIN_EMAIL } from '../../shared/constants/roles';

const admin = { role: 'SYSTEM_ADMIN', email: 'ada@roofhr.test' };
const hrAdmin = { role: 'HR_ADMIN', email: 'hr@roofhr.test' };
const manager = { role: 'MANAGER', email: 'mgr@roofhr.test' };
const employee = { role: 'EMPLOYEE', email: 'eli@roofhr.test' };
const sourcer = { role: 'SOURCER', email: 'src@roofhr.test' };
const facilitiesEmployee = { role: 'EMPLOYEE', email: 'alex.ortega@theroofdocs.com' }; // FACILITIES_ACCESS_EMAILS

describe('MCP areas × tools', () => {
  it('every area has at least one read tool behind it', () => {
    expect(assertAreasCovered(MCP_AREAS, MCP_TOOLS).missing).toEqual([]);
  });

  it('every tool is a read in a known area, with a unique snake_case name and a description', () => {
    const names = new Set<string>();
    for (const tool of MCP_TOOLS) {
      expect(tool.access).toBe('read');
      expect(MCP_AREAS as readonly string[]).toContain(tool.area);
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(names.has(tool.name)).toBe(false);
      names.add(tool.name);
      expect(tool.description.length).toBeGreaterThan(30);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('every area has a label', () => {
    for (const area of MCP_AREAS) {
      expect(MCP_AREA_LABELS[area].label.length).toBeGreaterThan(0);
      expect(MCP_AREA_LABELS[area].description.length).toBeGreaterThan(0);
    }
  });

  it('the scope strings we mint are ones the kit parses', () => {
    const scopes = MCP_AREAS.map((a) => `${a}:read`);
    expect(parseScopes(scopes).map((s) => s.area)).toEqual([...MCP_AREAS]);
  });
});

describe('who may mint which area', () => {
  it('admins and the super admin email may mint every area', () => {
    expect(mintableAreasForUser(admin)).toEqual([...MCP_AREAS]);
    expect(mintableAreasForUser(hrAdmin)).toEqual([...MCP_AREAS]);
    expect(mintableAreasForUser({ role: 'CONTRACTOR', email: SUPER_ADMIN_EMAIL })).toEqual([...MCP_AREAS]);
  });

  it('a manager may mint analytics (requireManager) but not attendance without Facilities access', () => {
    expect(userCanMintArea(manager, 'analytics')).toBe(true);
    expect(userCanMintArea(manager, 'attendance')).toBe(false);
  });

  it('an employee may mint the requireAuth-only areas and nothing gated by a role', () => {
    const areas = mintableAreasForUser(employee);
    expect(areas).toContain('me');
    expect(areas).toContain('pto');
    expect(areas).toContain('documents');
    expect(areas).toContain('recruiting');
    expect(areas).not.toContain('analytics');
    expect(areas).not.toContain('attendance');
  });

  it('Facilities access is by email, not role — the route guard is canAccessFacilities', () => {
    expect(userCanMintArea(facilitiesEmployee, 'attendance')).toBe(true);
    expect(userCanMintArea(sourcer, 'attendance')).toBe(false);
  });

  it('every known role can mint at least its own data; an unknown role mints nothing', () => {
    for (const role of ALL_ROLES) expect(userCanMintArea({ role, email: 'x@roofhr.test' }, 'me')).toBe(true);
    expect(mintableAreasForUser({ role: 'NOT_A_ROLE', email: 'x@roofhr.test' })).toEqual([]);
    expect(mintableAreasForUser({ role: undefined, email: 'x@roofhr.test' })).toEqual([]);
    expect(mintableAreasForUser(null)).toEqual([]);
  });
});

describe('validateRequestedScopes (mint time)', () => {
  it('accepts read scopes the role holds, de-duplicated', () => {
    const r = validateRequestedScopes(admin, ['pto:read', 'analytics:read', 'pto:read']);
    expect(r).toEqual({ ok: true, scopes: ['pto:read', 'analytics:read'] });
  });

  it('refuses a write scope with a plain sentence — writes are not enabled yet', () => {
    const r = validateRequestedScopes(admin, ['pto:read', 'pto:write']);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not enabled yet/i);
    expect(r.error).toContain('pto');
  });

  it('refuses an area outside the role, naming the area', () => {
    const r = validateRequestedScopes(employee, ['me:read', 'analytics:read']);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/does not have access to: analytics/);
  });

  it('refuses malformed and unknown scopes', () => {
    for (const bad of [['payroll:read'], ['pto'], ['pto:read:extra'], [42], ['*:read']]) {
      const r = validateRequestedScopes(admin, bad);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/Unknown scope/);
    }
  });

  it('refuses an empty or non-array request', () => {
    expect(validateRequestedScopes(admin, []).ok).toBe(false);
    expect(validateRequestedScopes(admin, 'pto:read').ok).toBe(false);
    expect(validateRequestedScopes(admin, undefined).ok).toBe(false);
  });
});
