// Poster fonts — self-hosted variable woff2s (client/public/marketing/fonts/).
// Never reference external CDNs here: exported SVG/PNG must be fully
// self-contained, and the old ad kit died precisely because its assets lived on
// a CDN that vanished. Two loading paths:
//   1. ensurePosterFonts() — @font-face into the page for live inline-SVG preview
//   2. posterFontFaceCss() — the same faces with the woff2 inlined as data: URIs,
//      injected into exported SVGs so they render identically anywhere.
const FACES = [
  { family: 'Oswald', file: '/marketing/fonts/oswald.woff2', weight: '200 700' },
  { family: 'Hanken Grotesk', file: '/marketing/fonts/hanken.woff2', weight: '100 900' },
  { family: 'Caveat', file: '/marketing/fonts/caveat.woff2', weight: '400 700' },
];

function faceCss(src: string, f: (typeof FACES)[number]): string {
  return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};src:url(${src}) format('woff2');}`;
}

let injected = false;
let readyPromise: Promise<void> | null = null;

/** Load the poster fonts into the document (for the live preview). Resolves when
 *  every family is ready so first paint doesn't flash fallback metrics. */
export function ensurePosterFonts(): Promise<void> {
  if (!readyPromise) {
    if (!injected) {
      const style = document.createElement('style');
      style.textContent = FACES.map((f) => faceCss(f.file, f)).join('\n');
      document.head.appendChild(style);
      injected = true;
    }
    readyPromise = Promise.all([
      document.fonts.load("700 100px 'Oswald'"),
      document.fonts.load("500 100px 'Oswald'"),
      document.fonts.load("400 100px 'Hanken Grotesk'"),
      document.fonts.load("700 100px 'Hanken Grotesk'"),
      document.fonts.load("700 100px 'Caveat'"),
    ]).then(() => undefined);
  }
  return readyPromise;
}

let embedCssPromise: Promise<string> | null = null;

/** @font-face CSS with every woff2 embedded as a base64 data URI — for export. */
export function posterFontFaceCss(): Promise<string> {
  if (!embedCssPromise) {
    embedCssPromise = Promise.all(
      FACES.map(async (f) => {
        const buf = await fetch(f.file).then((r) => {
          if (!r.ok) throw new Error(`font fetch failed: ${f.file}`);
          return r.arrayBuffer();
        });
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return faceCss(`data:font/woff2;base64,${btoa(bin)}`, f);
      }),
    ).then((rules) => rules.join('\n'));
    embedCssPromise.catch(() => { embedCssPromise = null; }); // allow retry
  }
  return embedCssPromise;
}

/** Canvas-backed text measurer — templates use this to wrap and auto-fit copy.
 *  Call after ensurePosterFonts() so measurements use the real faces. */
export function makeMeasure(): (text: string, font: string) => number {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}
