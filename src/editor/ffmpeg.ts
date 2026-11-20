// Single-threaded ffmpeg.wasm, self-hosted in /ffmpeg (GitHub Pages can't send COOP/COEP).
// Loaded only when the visitor exports from Cut.
import type { FFmpeg } from '@ffmpeg/ffmpeg';

let instance: Promise<FFmpeg> | null = null;

export function loadFFmpeg(): Promise<FFmpeg> {
  instance ??= (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
    const ff = new FFmpeg();
    const base = new URL('./ffmpeg/', location.href).toString();
    await ff.load({
      coreURL: await toBlobURL(`${base}ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ff;
  })().catch((e) => { instance = null; throw e; });
  return instance;
}
