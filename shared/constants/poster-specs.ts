// Poster template copy specs — the single source of truth for what copy each
// template takes. Client (lib/poster/templates.ts) attaches the SVG builders;
// server (AI designer endpoint) uses the same specs to prompt the LLM and to
// validate whatever comes back. The render path itself never trusts AI output:
// everything passes through sanitizePosterCopy before it touches a template.

export interface CopyField {
  key: string;
  label: string;
  kind: 'line' | 'multiline';
  maxLen: number;
}

export interface PosterSpec {
  id: string;
  name: string;
  description: string;
  skin: 'dark' | 'cream';
  /** When a designer would reach for this layout — guidance for the AI. */
  aiHint: string;
  fields: CopyField[];
  defaults: Record<string, string>;
}

const SCAN_FIELD: CopyField = { key: 'scanCta', label: 'QR call-to-action', kind: 'line', maxLen: 40 };

export const POSTER_SPECS: PosterSpec[] = [
  {
    id: 'storm-dark',
    name: 'Storm Alert (Dark)',
    description: 'High-urgency dark poster for post-storm canvassing and in-store displays.',
    skin: 'dark',
    aiHint: 'Urgent, time-sensitive messages: fresh storm damage, act-now inspections, seasonal deadlines. Strongest when fear-of-hidden-damage is the hook.',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow banner', kind: 'line', maxLen: 32 },
      { key: 'headline1', label: 'Headline line 1 (white)', kind: 'line', maxLen: 18 },
      { key: 'headline2', label: 'Headline line 2 (red)', kind: 'line', maxLen: 18 },
      { key: 'subhead', label: 'Subhead', kind: 'line', maxLen: 80 },
      { key: 'callout', label: 'Callout box', kind: 'multiline', maxLen: 220 },
      SCAN_FIELD,
    ],
    defaults: {
      eyebrow: 'STORM ALERT — ACT NOW',
      headline1: 'HAIL HIT',
      headline2: 'YOUR ROOF?',
      subhead: 'NORTHERN VA & MD WERE JUST HAMMERED BY HAIL STORMS',
      callout:
        'Hail damage hides — and it worsens fast. Get a FREE roof checkup from the Roof Docs: a full inspection, photo documentation, and a clear diagnosis of what your roof needs.',
      scanCta: 'SCAN FOR YOUR FREE INSPECTION',
    },
  },
  {
    id: 'errand-cream',
    name: 'Errand List (Cream)',
    description: 'Playful checklist poster for grocery stores, gas stations, and community boards.',
    skin: 'cream',
    aiHint: 'Friendly, low-pressure placements where people run errands. The joke: everyday to-dos are checked off, the roof never is. Keep list items mundane and short.',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow banner', kind: 'line', maxLen: 40 },
      { key: 'listTitle', label: 'List title (handwritten)', kind: 'line', maxLen: 24 },
      { key: 'listItems', label: 'Checked-off items (one per line)', kind: 'multiline', maxLen: 80 },
      { key: 'listAction', label: 'Circled unchecked item', kind: 'line', maxLen: 24 },
      { key: 'headline1', label: 'Headline line 1 (charcoal)', kind: 'line', maxLen: 26 },
      { key: 'headline2', label: 'Headline line 2 (red)', kind: 'line', maxLen: 26 },
      { key: 'subhead', label: 'Subhead', kind: 'line', maxLen: 60 },
      SCAN_FIELD,
    ],
    defaults: {
      eyebrow: 'FREE ROOF CHECKUP — WHILE YOU SHOP',
      listTitle: 'Saturday errands',
      listItems: 'milk\neggs\npaper towels\ncoffee',
      listAction: 'check the roof',
      headline1: "IT'S BEEN ON THE LIST",
      headline2: 'SINCE THE LAST STORM.',
      subhead: 'CROSS IT OFF RIGHT NOW — THE CHECKUP IS FREE.',
      scanCta: 'SCAN FOR YOUR FREE INSPECTION',
    },
  },
  {
    id: 'neighbors-dark',
    name: 'Neighbors Called (Stats)',
    description: 'Social-proof poster with a three-stat band — strong for neighborhoods mid-canvass.',
    skin: 'dark',
    aiHint: 'Social proof and credibility: neighbors already acted, we are established here. The three stat blocks carry one big word each plus a short caption.',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow banner', kind: 'line', maxLen: 28 },
      { key: 'headline1', label: 'Headline line 1 (white)', kind: 'line', maxLen: 20 },
      { key: 'headline2', label: 'Headline line 2 (red)', kind: 'line', maxLen: 20 },
      { key: 'subhead', label: 'Subhead', kind: 'line', maxLen: 80 },
      { key: 'stat1', label: 'Stat 1 — big word', kind: 'line', maxLen: 12 },
      { key: 'stat1sub', label: 'Stat 1 — caption', kind: 'line', maxLen: 36 },
      { key: 'stat2', label: 'Stat 2 — big word', kind: 'line', maxLen: 12 },
      { key: 'stat2sub', label: 'Stat 2 — caption', kind: 'line', maxLen: 36 },
      { key: 'stat3', label: 'Stat 3 — big word', kind: 'line', maxLen: 12 },
      { key: 'stat3sub', label: 'Stat 3 — caption', kind: 'line', maxLen: 36 },
      { key: 'callout', label: 'Callout box', kind: 'multiline', maxLen: 220 },
      SCAN_FIELD,
    ],
    defaults: {
      eyebrow: 'YOUR NEIGHBORHOOD',
      headline1: 'YOUR NEIGHBORS',
      headline2: 'ALREADY CALLED.',
      subhead: 'HAIL STORMS HIT NORTHERN VA, MD & RICHMOND THIS SEASON',
      stat1: 'HUNDREDS',
      stat1sub: 'of local roofs inspected',
      stat2: 'FREE',
      stat2sub: 'inspection & documentation',
      stat3: 'FAST',
      stat3sub: 'local response',
      callout:
        'If the houses around you took hail, yours probably did too. The Roof Docs give you a straight answer — a free checkup, photos of what we find, and zero obligation.',
      scanCta: 'SCAN FOR YOUR FREE INSPECTION',
    },
  },
];

export function posterSpecById(id: string): PosterSpec | undefined {
  return POSTER_SPECS.find((s) => s.id === id);
}

function hasLetters(s: string): boolean {
  return /[a-z]/i.test(s);
}

/** Truncate at a word boundary, hard-cut as a last resort. */
function clip(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen + 1);
  const atWord = cut.slice(0, cut.lastIndexOf(' '));
  return (atWord.length >= maxLen * 0.6 ? atWord : s.slice(0, maxLen)).trimEnd();
}

/** Normalize untrusted copy (AI or user) against a template's field specs:
 *  unknown keys dropped, missing fields defaulted, lengths clipped, single-line
 *  fields flattened, and display-style casing preserved (a field whose default
 *  is all-caps stays all-caps). */
export function sanitizePosterCopy(spec: PosterSpec, raw: unknown): Record<string, string> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of spec.fields) {
    const def = spec.defaults[f.key] ?? '';
    let v = typeof input[f.key] === 'string' ? (input[f.key] as string) : def;
    v = f.kind === 'line' ? v.replace(/\s+/g, ' ').trim() : v.replace(/\r\n?/g, '\n').trim();
    if (!v) v = def;
    if (hasLetters(def) && def === def.toUpperCase()) v = v.toUpperCase();
    out[f.key] = clip(v, f.maxLen);
  }
  return out;
}
