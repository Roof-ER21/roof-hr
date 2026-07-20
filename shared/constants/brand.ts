// Roof-ER brand kit — the single source of truth for the "stylist" (M3).
// The stored kit (marketing_brand table, one row) overrides these defaults and
// flows into: poster templates, campaign QR colors, and the rep QR styling.
// Shared by server (routes.ts) and client (lib/poster/templates.ts).

export interface BrandTokens {
  /** Dark module/text color — must stay dark or QR codes stop scanning. */
  charcoal: string;
  red: string;
  cream: string;
  phone: string;
  email: string;
  website: string;
  servingAreas: string[];
  chips: string[];
}

export const DEFAULT_BRAND: BrandTokens = {
  charcoal: '#302f2f',
  red: '#c80000',
  cream: '#f2ede3',
  phone: '703-239-3738',
  email: 'info@theroofdocs.com',
  website: 'theroofdocs.com',
  servingAreas: ['NORTHERN VA', 'MARYLAND', 'RICHMOND'],
  chips: ['ROOFING', 'SIDING', 'GUTTERS', 'STORM RESTORATION'],
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function relativeLuminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Validate + normalize a partial brand payload over the defaults.
 *  Returns the merged tokens, or throws with a human-readable message. */
export function sanitizeBrand(input: unknown): BrandTokens {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: BrandTokens = { ...DEFAULT_BRAND };

  for (const key of ['charcoal', 'red', 'cream'] as const) {
    const v = raw[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || !HEX.test(v.trim())) throw new Error(`${key} must be a #rrggbb hex color`);
    out[key] = v.trim().toLowerCase();
  }
  // QR modules render in charcoal — a light value would break scanning everywhere.
  if (relativeLuminance(out.charcoal) > 0.35) {
    throw new Error('The charcoal color is too light — QR codes need a dark module color to scan reliably.');
  }

  for (const key of ['phone', 'email', 'website'] as const) {
    const v = raw[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim().length === 0 || v.length > 80) throw new Error(`${key} must be a short non-empty string`);
    out[key] = v.trim();
  }

  for (const key of ['servingAreas', 'chips'] as const) {
    const v = raw[key];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.length === 0 || v.length > 6 || v.some((s) => typeof s !== 'string' || !s.trim() || s.length > 40)) {
      throw new Error(`${key} must be 1–6 short labels`);
    }
    out[key] = v.map((s: string) => s.trim());
  }

  return out;
}
