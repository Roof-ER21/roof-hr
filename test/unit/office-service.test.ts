import { describe, it, expect } from 'vitest';
import { slugifyKey, FALLBACK_OFFICES } from '../../shared/constants/offices';

describe('offices.slugifyKey', () => {
  it('turns a label into a stable upper-snake key', () => {
    expect(slugifyKey('Pittsburgh Office')).toBe('PITTSBURGH_OFFICE');
    expect(slugifyKey('PITT (Warrendale, PA)')).toBe('PITT_WARRENDALE_PA');
    expect(slugifyKey('  --Richmond--  ')).toBe('RICHMOND');
  });
  it('caps the key length', () => {
    expect(slugifyKey('x'.repeat(100)).length).toBe(40);
  });
});

describe('FALLBACK_OFFICES', () => {
  it('mirrors the seed in migrations/0011_offices.sql', () => {
    expect(FALLBACK_OFFICES.map((o) => o.key)).toEqual(['DMV', 'PA', 'RICHMOND', 'PITT']);
    const pitt = FALLBACK_OFFICES.find((o) => o.key === 'PITT')!;
    expect(pitt.address).toBe('50 Pennwood Pl Suite 329, Warrendale, PA 15086');
    expect(pitt.meetPerson).toBe('Josh Morris and Jay Waseem');
  });
});
