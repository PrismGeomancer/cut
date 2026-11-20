// Pure scale and path helpers (tested).
export type Scale = ((v: number) => number) & { domain: [number, number]; range: [number, number] };

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain, [r0, r1] = range;
  const span = d1 - d0 || 1;
  const f = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Scale;
  f.domain = domain; f.range = range;
  return f;
}

/** Round step: 1, 2, 2.5 or 5 × 10^n. */
export function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Ticks from 0 (or min) to a nice max that covers `max`. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) max = min + 1;
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}

/** Polyline path through points. */
export function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
}

/** Closed area between a top and bottom line (same x positions). */
export function areaPath(top: [number, number][], bottom: [number, number][]): string {
  if (!top.length) return '';
  const back = [...bottom].reverse();
  return `${linePath(top)}L${back.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`;
}

/** Stack series bottom-up. Returns [lower, upper] per series per index. */
export function stack(series: number[][]): [number, number][][] {
  const n = series[0]?.length ?? 0;
  const base = new Array(n).fill(0);
  return series.map((s) => s.map((v, i) => { const lo = base[i]; base[i] += Math.max(0, v || 0); return [lo, base[i]] as [number, number]; }));
}

/**
 * A bar with a 4 px rounded data end. Horizontal: rounded on the right. Vertical: rounded on top.
 * Bars shorter than the radius shrink the radius so the shape stays valid.
 */
export function barPath(x: number, y: number, w: number, h: number, r = 4, orient: 'h' | 'v' = 'h'): string {
  if (w <= 0 || h <= 0) return '';
  if (orient === 'h') {
    const rr = Math.min(r, w, h / 2);
    return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
  }
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Index of the nearest x position (for crosshairs). */
export function nearest(xs: number[], x: number): number {
  let best = 0, d = Infinity;
  xs.forEach((v, i) => { const dd = Math.abs(v - x); if (dd < d) { d = dd; best = i; } });
  return best;
}
