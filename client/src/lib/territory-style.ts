/**
 * One place for how a territory is drawn: its short code, badge classes, and
 * a hex for map dots. Matched by keyword on the territory name so a rename in
 * the database (PA → PHI, 2026-09-04) or a new territory (PITT) only needs a
 * line here, not in every card and dialog.
 */
export interface TerritoryStyle {
  short: string;
  badgeClass: string;
  hex: string;
}

const FALLBACK: TerritoryStyle = {
  short: '',
  badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
  hex: '#9CA3AF',
};

// Order matters: first match wins. Each pattern is matched as a whole word,
// case-insensitively, against the territory name (e.g. "PHI Territory").
const STYLES: Array<{ pattern: RegExp; style: TerritoryStyle }> = [
  {
    pattern: /\bdmv\b/i,
    style: { short: 'DMV', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', hex: '#3B82F6' },
  },
  {
    // PITT is black by design (team request 2026-09-04) so it never reads as PHI.
    pattern: /\b(pitt|pittsburgh)\b/i,
    style: { short: 'PITT', badgeClass: 'bg-gray-900 text-white dark:bg-black dark:text-gray-100', hex: '#111111' },
  },
  {
    // "pa" keeps any pre-rename "PA Territory" row rendering the same green.
    pattern: /\b(phi|philadelphia|philly|pa)\b/i,
    style: { short: 'PHI', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', hex: '#22C55E' },
  },
  {
    pattern: /\brichmond\b/i,
    style: { short: 'RA', badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', hex: '#A855F7' },
  },
];

export function getTerritoryStyle(name: string | null | undefined): TerritoryStyle {
  const haystack = name ?? '';
  for (const { pattern, style } of STYLES) {
    if (pattern.test(haystack)) return style;
  }
  return { ...FALLBACK, short: name ?? '' };
}
