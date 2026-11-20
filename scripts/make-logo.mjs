// Builds the brand assets from logo2.png (the main logo).
// The source is drawn on pure black with no alpha, so we "un-multiply" it from black:
// alpha = brightest channel, colour = channel / alpha. White and red stay fully opaque,
// the grey and dark-red pixel squares become translucent, and the black disappears,
// so the mark sits cleanly on the --bay surface instead of in a black square.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'logo2.png';
const OUT = 'public/brand';
const BAY = { r: 0x14, g: 0x17, b: 0x1a, alpha: 1 };
mkdirSync(OUT, { recursive: true });

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const rgba = Buffer.alloc(width * height * 4);
let minX = width, minY = height, maxX = 0, maxY = 0;
for (let i = 0, p = 0; i < data.length; i += 3, p += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  let a = Math.max(r, g, b);
  if (a < 14) a = 0; // compression noise in the black field
  if (a) {
    rgba[p] = Math.min(255, Math.round((r * 255) / a));
    rgba[p + 1] = Math.min(255, Math.round((g * 255) / a));
    rgba[p + 2] = Math.min(255, Math.round((b * 255) / a));
    rgba[p + 3] = a;
    const x = (i / 3) % width, y = Math.floor(i / 3 / width);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
// square crop around the mark with a small margin
const pad = 24;
const side = Math.max(maxX - minX, maxY - minY) + pad * 2;
const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
const left = Math.max(0, Math.round(cx - side / 2)), top = Math.max(0, Math.round(cy - side / 2));
const s = Math.min(side, width - left, height - top);
const mark = await sharp(rgba, { raw: { width, height, channels: 4 } })
  .extract({ left, top, width: s, height: s }).png().toBuffer();

const out = (size, name) => sharp(mark).resize(size, size).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}`);
await out(512, 'logo.png');
await out(96, 'logo-96.png');   // top bar (48 px at 2x)
await out(64, 'favicon-64.png');
await out(32, 'favicon-32.png');

// on-surface versions for places that need an opaque image
const onBay = async (size, inner, name) => {
  const m = await sharp(mark).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BAY } })
    .composite([{ input: m, gravity: 'centre' }]).png().toFile(`${OUT}/${name}`);
};
await onBay(180, 150, 'apple-touch-icon.png');
await onBay(512, 420, 'avatar.png');

// link preview: left half empty for text, mark on the right
const og = await sharp(mark).resize(520, 520).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: BAY } })
  .composite([{ input: og, left: 620, top: 55 }]).png().toFile(`${OUT}/og.png`);
console.log('brand assets written to', OUT, { crop: { left, top, size: s } });
