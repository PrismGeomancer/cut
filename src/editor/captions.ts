export interface Caption { id: string; start: number; end: number; text: string }

/** Wrap text to lines that fit `maxWidth` on a 2D context. */
export function wrap(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/** Draw a caption block in the lower third: bone text on a graphite plate. Scale is relative to a 1080 wide frame. */
export function drawCaption(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, text: string, W: number, H: number) {
  const k = W / 1080;
  ctx.save();
  ctx.font = `800 ${Math.round(64 * k)}px "Archivo Variable", system-ui, sans-serif`;
  (ctx as any).fontStretch = 'condensed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrap(ctx, text, W * 0.82);
  const lh = 76 * k, padX = 28 * k, padY = 18 * k;
  const blockH = lines.length * lh + padY * 2;
  const y0 = H * 0.70 - blockH / 2;
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
  ctx.fillStyle = 'rgba(20,23,26,0.92)';
  ctx.beginPath();
  (ctx as any).roundRect ? (ctx as any).roundRect((W - width) / 2, y0, width, blockH, 10 * k) : ctx.rect((W - width) / 2, y0, width, blockH);
  ctx.fill();
  ctx.fillStyle = '#E8E4DA';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + padY + lh * i + lh / 2));
  ctx.restore();
}

/** A transparent 1080×1920 PNG holding one caption, for ffmpeg to overlay. */
export async function captionPng(text: string): Promise<Uint8Array> {
  const c = new OffscreenCanvas(1080, 1920);
  const ctx = c.getContext('2d')!;
  await document.fonts.ready;
  drawCaption(ctx, text, 1080, 1920);
  const blob = await c.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}
