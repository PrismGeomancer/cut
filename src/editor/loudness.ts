// Volume detection only. It marks the loudest stretches of audio; it has no idea what is funny.

/** RMS per window (default 250 ms). */
export function rmsWindows(pcm: Float32Array, sampleRate: number, windowSec = 0.25): Float32Array {
  const size = Math.max(1, Math.round(sampleRate * windowSec));
  const n = Math.floor(pcm.length / size);
  const out = new Float32Array(n);
  for (let w = 0; w < n; w++) {
    let sum = 0;
    const o = w * size;
    for (let i = 0; i < size; i++) { const v = pcm[o + i]; sum += v * v; }
    out[w] = Math.sqrt(sum / size);
  }
  return out;
}

/**
 * Loudest peaks with a minimum spacing between them (in windows).
 * A peak must also stand above the median by `minRatio`, so steady noise marks nothing.
 * Returns window indices in time order.
 */
export function pickPeaks(rms: ArrayLike<number>, opts: { count?: number; minSpacing?: number; minRatio?: number } = {}): number[] {
  const { count = 6, minSpacing = 20, minRatio = 1.6 } = opts;
  const n = rms.length;
  if (!n) return [];
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)] || 1e-9;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => rms[b] - rms[a]);
  const picked: number[] = [];
  for (const i of idx) {
    if (picked.length >= count) break;
    if (rms[i] < median * minRatio || rms[i] <= 0) break;
    if (picked.every((p) => Math.abs(p - i) >= minSpacing)) picked.push(i);
  }
  return picked.sort((a, b) => a - b);
}

/** Decode a file's audio to mono. Throws if the browser can't decode it. */
export async function monoAudio(file: Blob): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const buf = await file.arrayBuffer();
  const Ctx = (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext) as typeof OfflineAudioContext;
  const ctx = new Ctx(1, 1, 22050);
  const audio = await ctx.decodeAudioData(buf);
  const ch = audio.numberOfChannels;
  const out = new Float32Array(audio.length);
  for (let c = 0; c < ch; c++) { const d = audio.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / ch; }
  return { pcm: out, sampleRate: audio.sampleRate };
}

/** Peak envelope for drawing the waveform lane: `buckets` values in 0..1. */
export function envelope(rms: Float32Array, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  if (!rms.length) return out;
  let max = 0;
  for (let b = 0; b < buckets; b++) {
    const a = Math.floor((b / buckets) * rms.length), z = Math.max(a + 1, Math.floor(((b + 1) / buckets) * rms.length));
    let m = 0;
    for (let i = a; i < z; i++) if (rms[i] > m) m = rms[i];
    out[b] = m; if (m > max) max = m;
  }
  if (max) for (let b = 0; b < buckets; b++) out[b] /= max;
  return out;
}
