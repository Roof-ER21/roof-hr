/**
 * Offices — the pure half of server/services/officeService.ts.
 * FALLBACK_OFFICES mirrors the rows migrations/0011_offices.sql seeds; the
 * renderer uses it only when the database cannot be reached at send time.
 */
export interface OfficeSeed {
  key: string;
  label: string;
  address: string;
  meetPerson: string;
}

export const FALLBACK_OFFICES: OfficeSeed[] = [
  { key: 'DMV', label: 'DMV (Vienna, VA)', address: '8100 Boone Blvd Suite 400, Vienna, VA 22182', meetPerson: 'Reese Samala' },
  { key: 'PA', label: 'PHI (Chesterbrook, PA)', address: '851 Duportail Rd, Chesterbrook, PA 19087', meetPerson: 'the team' },
  { key: 'RICHMOND', label: 'Richmond (Glen Allen, VA)', address: '2400 Old Brick Rd, Suite 105, Glen Allen, VA 23060', meetPerson: 'the team' },
  { key: 'PITT', label: 'PITT (Warrendale, PA)', address: '50 Pennwood Pl Suite 329, Warrendale, PA 15086', meetPerson: 'Josh Morris and Jay Waseem' },
];

export const DEFAULT_OFFICE_KEY = 'DMV';

/** "Pittsburgh Office" → "PITTSBURGH_OFFICE". Keys are what the hire route stores. */
export function slugifyKey(label: string): string {
  return label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
