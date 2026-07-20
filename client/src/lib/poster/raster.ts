// Poster export — turns a built poster SVG into downloadable files. The SVG
// gets the fonts embedded as data URIs (self-contained: renders identically at
// the print vendor with no font install), and the PNG is rasterized through an
// offscreen canvas at 300dpi (3300×5100 = 11×17in; scales cleanly to letter).
import { posterFontFaceCss } from './fonts';
import { POSTER_W, POSTER_H, EXPORT_SCALE } from './templates';

/** Inject the embedded-font stylesheet right after the opening <svg> tag. */
export async function selfContainedSvg(posterSvg: string): Promise<string> {
  const css = await posterFontFaceCss();
  return posterSvg.replace(/(<svg[^>]*>)/, `$1<defs><style>${css}</style></defs>`);
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export async function downloadPosterSvg(posterSvg: string, filename: string): Promise<void> {
  const svg = await selfContainedSvg(posterSvg);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function posterPngBlob(posterSvg: string, scale = EXPORT_SCALE): Promise<Blob> {
  const svg = await selfContainedSvg(posterSvg);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_W * scale;
    canvas.height = POSTER_H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPosterPng(posterSvg: string, filename: string): Promise<void> {
  const blob = await posterPngBlob(posterSvg);
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
