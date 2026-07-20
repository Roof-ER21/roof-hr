// Download helpers for QR data URIs (SVG documents encoded as data:image/svg+xml).
// Shared by the campaign and rep QR dialogs.

export function downloadQrSvg(dataUri: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  a.click();
}

/** Rasterize the SVG data URI onto a white square canvas and download as PNG. */
export function downloadQrPng(dataUri: string, filename: string, size = 1200): void {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = filename;
      a.click();
    });
  };
  img.src = dataUri;
}
