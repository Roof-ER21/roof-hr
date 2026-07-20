// Low-level SVG builders shared by the poster templates. Everything is emitted
// as plain strings — the same output drives the live inline preview, the SVG
// download, and the canvas rasterization, so there is exactly one layout truth.

export type Measure = (text: string, font: string) => number;

export interface FontSpec {
  family: string;
  weight: number;
  size: number;
  /** letter-spacing in px — canvas measureText ignores it, so width math adds it manually */
  ls?: number;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function cssFont(f: FontSpec): string {
  return `${f.weight} ${f.size}px "${f.family}"`;
}

export function textWidth(text: string, f: FontSpec, measure: Measure): number {
  const ls = f.ls ?? 0;
  return measure(text, cssFont(f)) + ls * Math.max(0, text.length - 1);
}

/** Shrink font-size until the line fits maxW (spacing scales along). */
export function fitFont(text: string, f: FontSpec, maxW: number, measure: Measure): FontSpec {
  const w = textWidth(text, f, measure);
  if (w <= maxW || w === 0) return f;
  const k = maxW / w;
  return { ...f, size: f.size * k, ls: (f.ls ?? 0) * k };
}

/** Greedy word-wrap. Overflow beyond maxLines is dropped onto the last line. */
export function wrapText(text: string, f: FontSpec, maxW: number, measure: Measure, maxLines = 5): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (line && textWidth(probe, f, measure) > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const rest = lines.slice(maxLines - 1).join(' ');
    lines.length = maxLines - 1;
    lines.push(rest);
  }
  return lines;
}

/** Wrap, then tighten the measure so multi-line blocks come out balanced
 *  (no orphan last line) — same line count, narrowest width that still fits. */
export function balancedWrap(text: string, f: FontSpec, maxW: number, measure: Measure, maxLines = 5): string[] {
  const lines = wrapText(text, f, maxW, measure, maxLines);
  if (lines.length < 2) return lines;
  let lo = maxW * 0.5;
  let hi = maxW;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (wrapText(text, f, mid, measure, maxLines + 2).length > lines.length) lo = mid;
    else hi = mid;
  }
  return wrapText(text, f, hi, measure, maxLines);
}

export interface TextOpts extends FontSpec {
  x: number;
  y: number;
  text: string;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  opacity?: number;
}

export function txt(o: TextOpts): string {
  const attrs = [
    `x="${fmt(o.x)}"`,
    `y="${fmt(o.y)}"`,
    `font-family="${o.family}"`,
    `font-weight="${o.weight}"`,
    `font-size="${fmt(o.size)}"`,
    `fill="${o.fill}"`,
    `text-anchor="${o.anchor ?? 'middle'}"`,
  ];
  if (o.ls) attrs.push(`letter-spacing="${fmt(o.ls)}"`);
  if (o.opacity !== undefined) attrs.push(`opacity="${fmt(o.opacity)}"`);
  return `<text ${attrs.join(' ')}>${esc(o.text)}</text>`;
}

/** Emit a centered multi-line block; returns the y just below the last line. */
export function txtLines(
  lines: string[],
  o: Omit<TextOpts, 'text' | 'y'> & { yFirst: number; lineHeight: number },
  out: string[],
): number {
  lines.forEach((line, i) => out.push(txt({ ...o, text: line, y: o.yFirst + i * o.lineHeight })));
  return o.yFirst + (lines.length - 1) * o.lineHeight;
}

/** Re-tag a standalone SVG document so it nests at x/y/size inside the poster. */
export function nestSvg(svg: string, x: number, y: number, size: number): string {
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!vb) return '';
  return svg.replace(
    /<svg[^>]*>/,
    `<svg x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" viewBox="${vb}" shape-rendering="crispEdges">`,
  );
}
