// Copies the single-threaded ffmpeg core into public/ffmpeg so it is self-hosted
// (GitHub Pages cannot send COOP/COEP headers, so the multi-thread core is not an option).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
const src = 'node_modules/@ffmpeg/core/dist/esm';
if (!existsSync(src)) process.exit(0);
mkdirSync('public/ffmpeg', { recursive: true });
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) cpSync(`${src}/${f}`, `public/ffmpeg/${f}`);
console.log('ffmpeg core copied to public/ffmpeg');
