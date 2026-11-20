import type { Caption } from './captions';

export type FrameMode = 'fill' | 'blur' | 'stacked';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export interface Look { contrast: number; saturation: number; grain: number; vignette: number; speed: number }
export interface ExportOpts { inT: number; outT: number; frame: FrameMode; corner: Corner; look: Look; captions: Caption[]; hasAudio: boolean }

const CORNER: Record<Corner, string> = { tl: '0:0', tr: 'iw*2/3:0', bl: '0:ih*2/3', br: 'iw*2/3:ih*2/3' };

/** Pure: builds the ffmpeg argument list for a 1080×1920 H.264/AAC export. Caption PNGs are inputs 1..n. */
export function buildArgs(o: ExportOpts, input = 'in', output = 'out.mp4'): string[] {
  const parts: string[] = [];
  if (o.frame === 'fill') parts.push('[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[f]');
  else if (o.frame === 'blur') parts.push('[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[bg];[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[f]');
  else parts.push(`[0:v]split[g][c];[g]crop='min(iw,ih*1080/1152)':ih:'(iw-min(iw,ih*1080/1152))/2':0,scale=1080:1152[top];[c]crop=iw/3:ih/3:${CORNER[o.corner]},scale=1080:768:force_original_aspect_ratio=increase,crop=1080:768[cam];[top][cam]vstack,setsar=1[f]`);

  const L = o.look;
  const look = [`eq=contrast=${L.contrast.toFixed(2)}:saturation=${L.saturation.toFixed(2)}`];
  if (L.grain > 0) look.push(`noise=alls=${Math.round(L.grain * 30)}:allf=t`);
  if (L.vignette > 0) look.push(`vignette=angle=${(0.15 + L.vignette * 0.6).toFixed(3)}`);
  if (L.speed !== 1) look.push(`setpts=PTS/${L.speed.toFixed(2)}`);
  parts.push(`[f]${look.join(',')}[l0]`);

  let last = 'l0';
  o.captions.forEach((c, i) => {
    const s = Math.max(0, (c.start - o.inT) / L.speed), e = Math.max(s, (c.end - o.inT) / L.speed);
    parts.push(`[${last}][${i + 1}:v]overlay=0:0:enable='between(t,${s.toFixed(2)},${e.toFixed(2)})'[c${i}]`);
    last = `c${i}`;
  });
  parts.push(`[${last}]format=yuv420p[v]`);

  const args = ['-ss', o.inT.toFixed(3), '-to', o.outT.toFixed(3), '-i', input];
  o.captions.forEach((_, i) => args.push('-i', `cap${i}.png`));
  args.push('-filter_complex', parts.join(';'), '-map', '[v]');
  if (o.hasAudio) {
    args.push('-map', '0:a:0?');
    if (L.speed !== 1) args.push('-af', `atempo=${L.speed.toFixed(2)}`);
    args.push('-c:a', 'aac', '-b:a', '128k');
  }
  args.push('-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', output);
  return args;
}
