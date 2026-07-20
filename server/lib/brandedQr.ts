// Branded QR generator — reproduces the Roof-ER "The Roof Docs" branded QR style
// (charcoal rounded modules + centered roofline/cross logo, error-correction H) for
// any data URL. Pure vector SVG output: print-ready, scales sticker→poster with no
// quality loss — the format the print vendor wants. Geometry derived from the
// original qr-theroofdocs-branded.svg so campaign QRs match the existing kit.
import QRCode from 'qrcode';

// Roof-ER brand marks.
const DARK = '#302f2f';    // charcoal modules
const ACCENT = '#c80000';  // Roof-ER red (the cross)
const LIGHT = '#ffffff';

// Logo geometry as fractions of the white knockout square (measured off the
// original 37-grid art: square at 12.95, size 11.10).
const LOGO_FRAC = 0.34;        // knockout square size as a fraction of the module area
const SQUARE_RADIUS = 0.12;    // corner radius / square size (1.33 / 11.10)
// Roofline polygon points (fractions of the square).
const ROOF = [
  [0.181, 0.500], [0.500, 0.226], [0.819, 0.500],
  [0.728, 0.500], [0.500, 0.306], [0.272, 0.500],
];
// Red cross (fractions of the square): [x, y, w, h].
const CROSS_V = [0.454, 0.546, 0.091, 0.259];
const CROSS_H = [0.371, 0.629, 0.259, 0.091];

export interface BrandedQrOptions {
  quiet?: number;         // quiet-zone modules (default 4, per QR spec + print rules)
  moduleRadius?: number;  // per-module corner radius in module units (default 0.28)
  logo?: boolean;         // draw the centered roofline/cross mark (default true)
  dark?: string;          // module color (default charcoal)
  accent?: string;        // cross color (default Roof-ER red)
}

function fmt(n: number): string {
  // Trim to 3 decimals, drop trailing zeros — keeps the SVG compact.
  return Number(n.toFixed(3)).toString();
}

/** Build a branded QR as an SVG string for the given data. Error correction is
 *  forced to level H (30%) so the center logo never breaks a scan. */
export function brandedQrSvg(data: string, opts: BrandedQrOptions = {}): string {
  const quiet = opts.quiet ?? 4;
  const r = opts.moduleRadius ?? 0.28;
  const dark = opts.dark ?? DARK;
  const accent = opts.accent ?? ACCENT;
  const drawLogo = opts.logo ?? true;

  const qr = QRCode.create(data, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const bits = qr.modules.data; // row-major Uint8Array, 1 = dark
  const total = n + quiet * 2;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`);
  parts.push(`<rect width="${total}" height="${total}" fill="${LIGHT}"/>`);

  // The center logo knockout (in module coords) — skip modules under it so the
  // white square reads cleanly; EC-H reconstructs the covered data.
  const logoSize = drawLogo ? LOGO_FRAC * n : 0;
  const logoX0 = quiet + (n - logoSize) / 2;
  const logoY0 = quiet + (n - logoSize) / 2;
  const inLogo = (x: number, y: number) =>
    drawLogo && x + 1 > logoX0 && x < logoX0 + logoSize && y + 1 > logoY0 && y < logoY0 + logoSize;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!bits[row * n + col]) continue;
      const x = quiet + col;
      const y = quiet + row;
      if (inLogo(x, y)) continue;
      parts.push(`<rect x="${x}" y="${y}" width="1" height="1" rx="${r}" fill="${dark}"/>`);
    }
  }

  if (drawLogo) {
    const L = logoSize;
    const px = (fx: number) => fmt(logoX0 + fx * L);
    const py = (fy: number) => fmt(logoY0 + fy * L);
    // White rounded knockout square.
    parts.push(`<rect x="${fmt(logoX0)}" y="${fmt(logoY0)}" width="${fmt(L)}" height="${fmt(L)}" rx="${fmt(SQUARE_RADIUS * L)}" fill="${LIGHT}"/>`);
    // Roofline.
    const pts = ROOF.map(([fx, fy]) => `${px(fx)},${py(fy)}`).join(' ');
    parts.push(`<polygon points="${pts}" fill="${dark}"/>`);
    // Red cross.
    parts.push(`<rect x="${px(CROSS_V[0])}" y="${py(CROSS_V[1])}" width="${fmt(CROSS_V[2] * L)}" height="${fmt(CROSS_V[3] * L)}" fill="${accent}"/>`);
    parts.push(`<rect x="${px(CROSS_H[0])}" y="${py(CROSS_H[1])}" width="${fmt(CROSS_H[2] * L)}" height="${fmt(CROSS_H[3] * L)}" fill="${accent}"/>`);
  }

  parts.push('</svg>');
  return parts.join('');
}

/** SVG as a base64 data URI, ready for an <img src> or download. */
export function brandedQrDataUri(data: string, opts: BrandedQrOptions = {}): string {
  const svg = brandedQrSvg(data, opts);
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}
