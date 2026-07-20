// Poster templates — parameterized SVG artboards that recreate the Roof-ER
// in-store poster system (decoded from the RoofDocs-QR-InStore print kit):
// logo → eyebrow → two-tone condensed headline → subhead → callout → service
// chips → white footer card (branded QR + phone + contact) → serving-area bar.
// Brand values flow through BrandTokens so the M3 "stylist" presets can restyle
// every template (and the QR) from one object.
import { fmt, fitFont, wrapText, balancedWrap, txt, txtLines, nestSvg, type Measure, type FontSpec } from './svg';
import { DEFAULT_BRAND, type BrandTokens } from '@shared/constants/brand';
import { POSTER_SPECS, type PosterSpec, type CopyField } from '@shared/constants/poster-specs';

export { DEFAULT_BRAND, type BrandTokens, type CopyField };

export const POSTER_W = 1100;
export const POSTER_H = 1700;
/** 3× the artboard = 3300×5100 px = 11×17in at 300dpi (scales cleanly to letter). */
export const EXPORT_SCALE = 3;

export interface PosterContext {
  copy: Record<string, string>;
  brand: BrandTokens;
  /** Campaign's branded QR as a standalone SVG document (decoded from qrCodeUrl). */
  qrSvg: string;
  measure: Measure;
  /** Unique per rendered instance — prefixes defs ids so multiple inline previews coexist. */
  uid: string;
}

/** A shared copy spec plus this module's SVG builder. */
export interface PosterTemplate extends PosterSpec {
  build(ctx: PosterContext): string;
}

const WHITE = '#ffffff';
const OSWALD = 'Oswald';
const HANKEN = 'Hanken Grotesk';
const CAVEAT = 'Caveat';

/** Mix a hex color toward white — used for accent text on dark cards. */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------- shared blocks ----------

function openSvg(bodyFont: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${POSTER_W} ${POSTER_H}" width="${POSTER_W}" height="${POSTER_H}" font-family="${bodyFont}">`;
}

/** Dark storm background: charcoal gradient, soft top glow, faint rain streaks. */
function darkBg(uid: string, out: string[]): void {
  out.push(
    `<defs>` +
      `<linearGradient id="${uid}-bg" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#232326"/><stop offset="0.55" stop-color="#161618"/><stop offset="1" stop-color="#0d0d0f"/>` +
      `</linearGradient>` +
      `<radialGradient id="${uid}-glow" cx="0.5" cy="0.28" r="0.75">` +
      `<stop offset="0" stop-color="#ffffff" stop-opacity="0.07"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
      `</radialGradient>` +
      `</defs>`,
  );
  out.push(`<rect width="${POSTER_W}" height="${POSTER_H}" fill="url(#${uid}-bg)"/>`);
  out.push(`<rect width="${POSTER_W}" height="${POSTER_H}" fill="url(#${uid}-glow)"/>`);
  // Rain: sparse diagonal strokes, barely-there.
  const rain: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = ((i * 379) % (POSTER_W + 400)) - 200;
    const y = (i * 257) % POSTER_H;
    const len = 90 + ((i * 83) % 130);
    rain.push(`<line x1="${x}" y1="${y}" x2="${fmt(x - len * 0.28)}" y2="${y + len}"/>`);
  }
  out.push(`<g stroke="#ffffff" stroke-opacity="0.045" stroke-width="2.5" stroke-linecap="round">${rain.join('')}</g>`);
}

/** The roofline + medical-cross mark (same geometry as the branded QR logo). */
function roofMark(cx: number, top: number, size: number, main: string, accent: string): string {
  const L = size;
  const x0 = cx - L / 2;
  const px = (fx: number) => fmt(x0 + fx * L);
  const py = (fy: number) => fmt(top + fy * L);
  const roof = [
    [0.181, 0.5], [0.5, 0.226], [0.819, 0.5],
    [0.728, 0.5], [0.5, 0.306], [0.272, 0.5],
  ].map(([fx, fy]) => `${px(fx)},${py(fy)}`).join(' ');
  return (
    `<polygon points="${roof}" fill="${main}"/>` +
    `<rect x="${px(0.454)}" y="${py(0.546)}" width="${fmt(0.091 * L)}" height="${fmt(0.259 * L)}" fill="${accent}"/>` +
    `<rect x="${px(0.371)}" y="${py(0.629)}" width="${fmt(0.259 * L)}" height="${fmt(0.091 * L)}" fill="${accent}"/>`
  );
}

/** ROOFER / THE ROOF DOCS wordmark with the roof mark above. Returns bottom y. */
function logoBlock(
  o: { cx: number; top: number; main: string; accent: string; twoTone?: boolean },
  out: string[],
): number {
  const { cx, top, main, accent } = o;
  out.push(roofMark(cx, top - 6, 78, main, accent));
  const nameY = top + 108;
  if (o.twoTone) {
    out.push(
      `<text x="${cx}" y="${nameY}" font-family="${OSWALD}" font-weight="700" font-size="50" letter-spacing="3" text-anchor="middle" fill="${main}">ROOF<tspan fill="${accent}">ER</tspan></text>`,
    );
  } else {
    out.push(txt({ x: cx, y: nameY, text: 'ROOFER', family: OSWALD, weight: 700, size: 50, ls: 3, fill: main }));
  }
  out.push(txt({ x: cx, y: nameY + 27, text: 'THE ROOF DOCS', family: OSWALD, weight: 500, size: 15, ls: 8, fill: main }));
  return nameY + 27;
}

type EyebrowStyle = { bg?: string; stroke?: string; color: string; glyph?: 'warn' | 'house' };

/** Small warning-triangle / house glyph drawn in vector (emoji chars rasterize
 *  unpredictably inside SVG-as-image, so glyphs are paths). */
function eyebrowGlyph(kind: 'warn' | 'house', x: number, cy: number, color: string): string {
  if (kind === 'warn') {
    const top = cy - 10;
    return (
      `<g stroke="${color}" stroke-width="2.4" fill="none" stroke-linejoin="round">` +
      `<polygon points="${x + 11},${top} ${x + 22},${top + 19} ${x},${top + 19}"/>` +
      `</g>` +
      `<rect x="${x + 10}" y="${top + 6}" width="2.4" height="7" fill="${color}"/>` +
      `<rect x="${x + 10}" y="${top + 15}" width="2.4" height="2.4" fill="${color}"/>`
    );
  }
  const top = cy - 9;
  return (
    `<g stroke="${color}" stroke-width="2.4" fill="none" stroke-linejoin="round">` +
    `<polyline points="${x},${top + 9} ${x + 10},${top} ${x + 20},${top + 9}"/>` +
    `<polyline points="${x + 3},${top + 8} ${x + 3},${top + 18} ${x + 17},${top + 18} ${x + 17},${top + 8}"/>` +
    `</g>`
  );
}

function eyebrow(text: string, cy: number, style: EyebrowStyle, measure: Measure, out: string[]): void {
  const f: FontSpec = { family: OSWALD, weight: 600, size: 21, ls: 5 };
  const fitted = fitFont(text, f, 700, measure);
  const tw = measure(text, `${fitted.weight} ${fitted.size}px "${fitted.family}"`) + (fitted.ls ?? 0) * Math.max(0, text.length - 1);
  const glyphW = style.glyph ? 36 : 0;
  const padX = 30;
  const w = tw + glyphW + padX * 2;
  const h = 58;
  const x = POSTER_W / 2 - w / 2;
  const rectAttrs = style.bg ? `fill="${style.bg}"` : `fill="none"`;
  const strokeAttrs = style.stroke ? ` stroke="${style.stroke}" stroke-width="2.5"` : '';
  out.push(`<rect x="${fmt(x)}" y="${fmt(cy - h / 2)}" width="${fmt(w)}" height="${h}"${style.bg ? ` ${rectAttrs}` : ' fill="none"'}${strokeAttrs}/>`);
  if (style.glyph) out.push(eyebrowGlyph(style.glyph, x + padX, cy, style.color));
  out.push(txt({ x: POSTER_W / 2 + glyphW / 2, y: cy + fitted.size * 0.36, text, ...fitted, fill: style.color }));
}

/** Outlined service chips, centered. */
function chipsRow(chips: string[], cy: number, style: { stroke: string; color: string; bg?: string }, measure: Measure, out: string[]): void {
  const f: FontSpec = { family: OSWALD, weight: 600, size: 17, ls: 2 };
  const gap = 14;
  const padX = 20;
  const h = 48;
  const widths = chips.map((c) => measure(c, `600 17px "${OSWALD}"`) + (f.ls ?? 0) * Math.max(0, c.length - 1) + padX * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
  let x = POSTER_W / 2 - total / 2;
  chips.forEach((c, i) => {
    out.push(
      `<rect x="${fmt(x)}" y="${fmt(cy - h / 2)}" width="${fmt(widths[i])}" height="${h}" fill="${style.bg ?? 'none'}" stroke="${style.stroke}" stroke-width="2"/>`,
    );
    out.push(txt({ x: x + widths[i] / 2, y: cy + 6, text: c, ...f, fill: style.color }));
    x += widths[i] + gap;
  });
}

/** Footer contact card with the campaign QR. Works on a white or charcoal card. */
function footerCard(
  o: { y: number; h: number; dark: boolean; scanCta: string },
  ctx: PosterContext,
  out: string[],
): void {
  const { brand, measure, qrSvg } = ctx;
  const x = 72;
  const w = POSTER_W - 144;
  const cardFill = o.dark ? brand.charcoal : WHITE;
  out.push(`<rect x="${x}" y="${o.y}" width="${w}" height="${o.h}" rx="20" fill="${cardFill}"/>`);

  const q = o.h - 64;
  const qx = x + 36;
  const qy = o.y + 32;
  if (o.dark) {
    // QR sits on its own white tile so the quiet zone stays honest.
    out.push(`<rect x="${qx - 6}" y="${qy - 6}" width="${q + 12}" height="${q + 12}" rx="12" fill="${WHITE}"/>`);
  }
  out.push(nestSvg(qrSvg, qx, qy, q));

  const tx = qx + q + 30 + (x + w - 36 - (qx + q + 30)) / 2; // center of remaining width
  const maxTw = x + w - 36 - (qx + q + 30);
  const cy = o.y + o.h / 2;
  const ctaColor = o.dark ? lighten(brand.red, 0.42) : brand.red;
  const inkColor = o.dark ? WHITE : '#2c2c2e';
  const subColor = o.dark ? '#b9b7b4' : '#6f6d6a';
  const cta = fitFont(o.scanCta, { family: OSWALD, weight: 700, size: 28, ls: 1 }, maxTw, measure);
  out.push(txt({ x: tx, y: cy - 52, text: o.scanCta, ...cta, fill: ctaColor }));
  const phone = fitFont(brand.phone, { family: OSWALD, weight: 700, size: 64, ls: 2 }, maxTw, measure);
  out.push(txt({ x: tx, y: cy + 22, text: brand.phone, ...phone, fill: inkColor }));
  const contact = `${brand.email}  •  ${brand.website}`;
  const cf = fitFont(contact, { family: HANKEN, weight: 600, size: 21 }, maxTw, measure);
  out.push(txt({ x: tx, y: cy + 68, text: contact, ...cf, fill: subColor }));
}

function servingBar(areas: string[], y: number, h: number, out: string[]): void {
  out.push(`<rect x="0" y="${y}" width="${POSTER_W}" height="${h}" fill="#242427"/>`);
  const label = ['SERVING ' + areas[0], ...areas.slice(1)].join('   •   ');
  out.push(txt({ x: POSTER_W / 2, y: y + h / 2 + 6, text: label, family: OSWALD, weight: 500, size: 17, ls: 6, fill: WHITE }));
}

function redEdges(red: string, out: string[]): void {
  out.push(`<rect x="0" y="0" width="${POSTER_W}" height="10" fill="${red}"/>`);
  out.push(`<rect x="0" y="${POSTER_H - 10}" width="${POSTER_W}" height="10" fill="${red}"/>`);
}

/** Two-tone stacked condensed headline; returns y below the last line. */
function headline(
  l1: string, l2: string, c1: string, c2: string, yFirst: number, size: number, ctx: PosterContext, out: string[],
): number {
  const base: FontSpec = { family: OSWALD, weight: 700, size, ls: 1 };
  const f1 = fitFont(l1, base, 960, ctx.measure);
  const f2 = fitFont(l2, base, 960, ctx.measure);
  out.push(txt({ x: POSTER_W / 2, y: yFirst, text: l1, ...f1, fill: c1 }));
  const y2 = yFirst + size * 1.12;
  out.push(txt({ x: POSTER_W / 2, y: y2, text: l2, ...f2, fill: c2 }));
  return y2;
}

// ---------- templates (copy specs live in @shared/constants/poster-specs) ----------

function buildStormDark(ctx: PosterContext): string {
    const { copy, brand, measure, uid } = ctx;
    const out: string[] = [openSvg(OSWALD)];
    darkBg(uid, out);
    logoBlock({ cx: POSTER_W / 2, top: 64, main: WHITE, accent: brand.red }, out);
    eyebrow(copy.eyebrow, 262, { bg: brand.red, color: WHITE, glyph: 'warn' }, measure, out);
    const hBottom = headline(copy.headline1, copy.headline2, WHITE, brand.red, 435, 100, ctx, out);
    out.push(`<rect x="${POSTER_W / 2 - 190}" y="${fmt(hBottom + 38)}" width="380" height="5" fill="${brand.red}"/>`);
    const subF: FontSpec = { family: OSWALD, weight: 600, size: 34, ls: 1 };
    const subLines = balancedWrap(copy.subhead, subF, 760, measure, 2);
    const subEnd = txtLines(subLines, { ...subF, fill: WHITE, x: POSTER_W / 2, yFirst: hBottom + 104, lineHeight: 46 }, out);

    // Red callout box grows with its copy.
    const bodyF: FontSpec = { family: HANKEN, weight: 600, size: 27 };
    const bodyLines = wrapText(copy.callout, bodyF, 850, measure, 5);
    const boxTop = subEnd + 52;
    const boxH = bodyLines.length * 40 + 84;
    out.push(`<rect x="72" y="${fmt(boxTop)}" width="${POSTER_W - 144}" height="${fmt(boxH)}" fill="${brand.red}"/>`);
    txtLines(bodyLines, { ...bodyF, fill: WHITE, x: POSTER_W / 2, yFirst: boxTop + 62, lineHeight: 40 }, out);

    chipsRow(brand.chips, boxTop + boxH + 66, { stroke: brand.red, color: WHITE }, measure, out);
    footerCard({ y: 1290, h: 268, dark: false, scanCta: copy.scanCta }, ctx, out);
    servingBar(brand.servingAreas, 1608, 62, out);
    redEdges(brand.red, out);
    out.push('</svg>');
  return out.join('');
}

function buildErrandCream(ctx: PosterContext): string {
    const { copy, brand, measure, uid } = ctx;
    const ink = brand.charcoal;
    const out: string[] = [openSvg(OSWALD)];
    out.push(
      `<defs><filter id="${uid}-sh" x="-20%" y="-20%" width="140%" height="140%">` +
        `<feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#3a2f20" flood-opacity="0.22"/>` +
        `</filter></defs>`,
    );
    out.push(`<rect width="${POSTER_W}" height="${POSTER_H}" fill="${brand.cream}"/>`);
    logoBlock({ cx: POSTER_W / 2, top: 58, main: ink, accent: brand.red, twoTone: true }, out);
    eyebrow(copy.eyebrow, 252, { bg: WHITE, stroke: brand.red, color: brand.red }, measure, out);

    // Notepad card, slightly rotated.
    const items = copy.listItems.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const rows = [...items.map((t) => ({ t, done: true })), { t: copy.listAction, done: false }];
    const cardX = 296, cardY = 312, cardW = 508;
    const rowH = 64;
    const cardH = 96 + rows.length * rowH + 30;
    const np: string[] = [];
    np.push(`<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${fmt(cardH)}" rx="14" fill="${WHITE}" filter="url(#${uid}-sh)"/>`);
    np.push(`<path d="M ${cardX} ${cardY + 14} a 14 14 0 0 1 14 -14 h ${cardW - 28} a 14 14 0 0 1 14 14 v 8 h -${cardW} z" fill="${brand.red}"/>`);
    np.push(txt({ x: cardX + 44, y: cardY + 74, text: copy.listTitle, family: CAVEAT, weight: 700, size: 40, fill: ink, anchor: 'start' }));
    const itemF: FontSpec = { family: CAVEAT, weight: 700, size: 34 };
    rows.forEach((row, i) => {
      const ry = cardY + 100 + i * rowH;
      const boxY = ry + 14;
      np.push(`<rect x="${cardX + 44}" y="${boxY}" width="26" height="26" rx="5" fill="none" stroke="#9a978f" stroke-width="2.4"/>`);
      if (row.done) {
        np.push(
          `<polyline points="${cardX + 49},${boxY + 13} ${cardX + 56},${boxY + 21} ${cardX + 68},${boxY + 4}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
      }
      const tx0 = cardX + 92;
      const color = row.done ? '#a09d95' : ink;
      np.push(txt({ x: tx0, y: ry + 38, text: row.t, ...itemF, fill: color, anchor: 'start' }));
      const tw = measure(row.t, `700 34px "${CAVEAT}"`);
      if (row.done) {
        np.push(`<line x1="${tx0 - 4}" y1="${ry + 27}" x2="${fmt(tx0 + tw + 6)}" y2="${ry + 25}" stroke="#a09d95" stroke-width="2.6"/>`);
      } else {
        np.push(
          `<ellipse cx="${fmt(tx0 + tw / 2)}" cy="${ry + 27}" rx="${fmt(tw / 2 + 26)}" ry="27" fill="none" stroke="${brand.red}" stroke-width="3.6" transform="rotate(-2 ${fmt(tx0 + tw / 2)} ${ry + 27})"/>`,
        );
      }
      np.push(`<line x1="${cardX + 40}" y1="${ry + 52}" x2="${cardX + cardW - 40}" y2="${ry + 52}" stroke="#d8d4ca" stroke-width="1.6" stroke-dasharray="2 5"/>`);
    });
    out.push(`<g transform="rotate(-2 ${POSTER_W / 2} ${cardY + cardH / 2})">${np.join('')}</g>`);

    const hTop = cardY + cardH + 96;
    const hBottom = headline(copy.headline1, copy.headline2, ink, brand.red, hTop, 78, ctx, out);
    const subF = fitFont(copy.subhead, { family: OSWALD, weight: 600, size: 30, ls: 1 }, 900, measure);
    out.push(txt({ x: POSTER_W / 2, y: hBottom + 62, text: copy.subhead, ...subF, fill: ink }));

    chipsRow(brand.chips, hBottom + 132, { stroke: brand.red, color: brand.red, bg: WHITE }, measure, out);
    footerCard({ y: 1330, h: 268, dark: true, scanCta: copy.scanCta }, ctx, out);
    servingBar(brand.servingAreas, 1648, 52, out);
    out.push(`<rect x="0" y="0" width="${POSTER_W}" height="10" fill="${brand.red}"/>`);
    out.push('</svg>');
  return out.join('');
}

function buildNeighborsDark(ctx: PosterContext): string {
    const { copy, brand, measure, uid } = ctx;
    const out: string[] = [openSvg(OSWALD)];
    darkBg(uid, out);
    logoBlock({ cx: POSTER_W / 2, top: 60, main: WHITE, accent: brand.red }, out);
    eyebrow(copy.eyebrow, 252, { bg: brand.red, color: WHITE, glyph: 'house' }, measure, out);
    const hBottom = headline(copy.headline1, copy.headline2, WHITE, brand.red, 420, 94, ctx, out);
    out.push(`<rect x="${POSTER_W / 2 - 190}" y="${fmt(hBottom + 36)}" width="380" height="5" fill="${brand.red}"/>`);
    const subF: FontSpec = { family: OSWALD, weight: 600, size: 32, ls: 1 };
    const subLines = balancedWrap(copy.subhead, subF, 720, measure, 2);
    const subEnd = txtLines(subLines, { ...subF, fill: WHITE, x: POSTER_W / 2, yFirst: hBottom + 98, lineHeight: 44 }, out);

    // Three-stat band: red / charcoal / red, contiguous.
    const bandY = subEnd + 62;
    const bandH = 190;
    const bandX = 72;
    const bandW = POSTER_W - 144;
    const cellW = bandW / 3;
    const stats = [
      { big: copy.stat1, sub: copy.stat1sub, fill: brand.red },
      { big: copy.stat2, sub: copy.stat2sub, fill: '#2a2a2d' },
      { big: copy.stat3, sub: copy.stat3sub, fill: brand.red },
    ];
    stats.forEach((s, i) => {
      const cx = bandX + cellW * i + cellW / 2;
      out.push(`<rect x="${fmt(bandX + cellW * i)}" y="${fmt(bandY)}" width="${fmt(cellW)}" height="${bandH}" fill="${s.fill}"/>`);
      const bigF = fitFont(s.big, { family: OSWALD, weight: 700, size: 46, ls: 1 }, cellW - 44, measure);
      out.push(txt({ x: cx, y: bandY + 84, text: s.big, ...bigF, fill: WHITE }));
      const capF: FontSpec = { family: HANKEN, weight: 600, size: 20 };
      const capLines = wrapText(s.sub, capF, cellW - 48, measure, 2);
      txtLines(capLines, { ...capF, fill: WHITE, x: cx, yFirst: bandY + 122, lineHeight: 27 }, out);
    });

    // Outlined callout.
    const bodyF: FontSpec = { family: HANKEN, weight: 600, size: 26 };
    const bodyLines = wrapText(copy.callout, bodyF, 830, measure, 4);
    const boxTop = bandY + bandH + 48;
    const boxH = bodyLines.length * 38 + 72;
    out.push(
      `<rect x="72" y="${fmt(boxTop)}" width="${POSTER_W - 144}" height="${fmt(boxH)}" fill="#1c1c1f" fill-opacity="0.72" stroke="${brand.red}" stroke-width="1.6"/>`,
    );
    txtLines(bodyLines, { ...bodyF, fill: WHITE, x: POSTER_W / 2, yFirst: boxTop + 54, lineHeight: 38 }, out);

    footerCard({ y: 1310, h: 260, dark: false, scanCta: copy.scanCta }, ctx, out);
    servingBar(brand.servingAreas, 1612, 58, out);
    redEdges(brand.red, out);
    out.push('</svg>');
  return out.join('');
}

const BUILDERS: Record<string, (ctx: PosterContext) => string> = {
  'storm-dark': buildStormDark,
  'errand-cream': buildErrandCream,
  'neighbors-dark': buildNeighborsDark,
};

export const POSTER_TEMPLATES: PosterTemplate[] = POSTER_SPECS.map((spec) => {
  const build = BUILDERS[spec.id];
  if (!build) throw new Error(`poster spec ${spec.id} has no builder`);
  return { ...spec, build };
});

export function templateById(id: string): PosterTemplate | undefined {
  return POSTER_TEMPLATES.find((t) => t.id === id);
}

/** Decode a campaign's qrCodeUrl (base64 SVG data URI) back to the SVG document. */
export function qrSvgFromDataUri(dataUri: string): string {
  const m = dataUri.match(/^data:image\/svg\+xml;base64,(.+)$/);
  if (!m) return '';
  try {
    return atob(m[1]);
  } catch {
    return '';
  }
}

export function posterFileName(templateId: string, campaignCode: string, ext: string): string {
  return `roofer-${templateId}-${campaignCode}.${ext}`;
}
