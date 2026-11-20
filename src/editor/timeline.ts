import type { Caption } from './captions';
import { timecode } from '../lib/format';

export interface TimelineState {
  duration: number; t: number; inT: number; outT: number;
  wave: Float32Array | null; markers: number[]; captions: Caption[];
}

const C = { bay: '#14171A', panel: '#1B1F23', line: '#2A2F34', paper: '#E8E4DA', muted: '#A19D93', faint: '#6E6B64', cut: '#E5352B' };
const LANES = [['V1', 34], ['A1', 46], ['M', 22], ['T1', 26]] as const;
const LABEL_W = 44, RULER = 22;

/** Canvas timeline: ruler, V1 clip with in/out, A1 waveform, loud-moment markers, caption lane, playhead. */
export class Timeline {
  private ctx: CanvasRenderingContext2D;
  private drag: 'in' | 'out' | 'head' | null = null;
  constructor(private canvas: HTMLCanvasElement, private state: TimelineState, private on: { seek(t: number): void; trim(inT: number, outT: number): void }) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.draw()).observe(canvas);
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', () => { this.drag = null; });
  }
  set(s: Partial<TimelineState>) { Object.assign(this.state, s); this.draw(); }

  private x(t: number, W: number) { return LABEL_W + (t / (this.state.duration || 1)) * (W - LABEL_W - 8); }
  private t(x: number, W: number) { return Math.min(this.state.duration, Math.max(0, ((x - LABEL_W) / (W - LABEL_W - 8)) * this.state.duration)); }

  private down(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, W = r.width;
    const near = (t: number) => Math.abs(this.x(t, W) - x) < 10;
    this.drag = near(this.state.inT) ? 'in' : near(this.state.outT) ? 'out' : 'head';
    this.canvas.setPointerCapture(e.pointerId);
    this.move(e);
  }
  private move(e: PointerEvent) {
    if (!this.drag) return;
    const r = this.canvas.getBoundingClientRect(), t = this.t(e.clientX - r.left, r.width);
    if (this.drag === 'head') this.on.seek(t);
    else if (this.drag === 'in') this.on.trim(Math.min(t, this.state.outT - 0.5), this.state.outT);
    else this.on.trim(this.state.inT, Math.max(t, this.state.inT + 0.5));
  }

  draw() {
    const cv = this.canvas, dpr = devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = this.ctx, s = this.state;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.panel; g.fillRect(0, 0, W, H);
    g.font = '11px "JetBrains Mono Variable", monospace';
    g.textBaseline = 'middle';

    // ruler
    g.strokeStyle = C.line; g.beginPath(); g.moveTo(0, RULER + 0.5); g.lineTo(W, RULER + 0.5); g.stroke();
    if (s.duration) {
      const step = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((v) => (W - LABEL_W) / (s.duration / v) > 70) ?? 600;
      for (let t = 0; t <= s.duration; t += step) {
        const x = Math.round(this.x(t, W)) + 0.5;
        g.strokeStyle = C.faint; g.beginPath(); g.moveTo(x, RULER - 8); g.lineTo(x, RULER); g.stroke();
        g.fillStyle = C.muted; g.fillText(timecode(t).slice(3, 8), x + 4, 9);
      }
    }
    // lanes
    let y = RULER;
    for (const [name, h] of LANES) {
      g.fillStyle = C.muted; g.fillText(name, 10, y + h / 2);
      g.strokeStyle = C.line; g.beginPath(); g.moveTo(0, y + h + 0.5); g.lineTo(W, y + h + 0.5); g.moveTo(LABEL_W - 0.5, y); g.lineTo(LABEL_W - 0.5, y + h); g.stroke();
      if (s.duration) {
        if (name === 'V1') {
          g.fillStyle = C.faint; g.fillRect(LABEL_W, y + 7, W - LABEL_W - 8, h - 14);
          g.fillStyle = C.paper; g.fillRect(this.x(s.inT, W), y + 6, this.x(s.outT, W) - this.x(s.inT, W), h - 12);
        } else if (name === 'A1' && s.wave) {
          const n = s.wave.length, mid = y + h / 2;
          g.fillStyle = C.muted;
          for (let i = 0; i < n; i++) {
            const x = LABEL_W + (i / n) * (W - LABEL_W - 8), a = Math.max(1, s.wave[i] * (h / 2 - 5));
            g.fillRect(x, mid - a, Math.max(1, (W - LABEL_W) / n - 1), a * 2);
          }
        } else if (name === 'M') {
          g.fillStyle = C.paper;
          for (const m of s.markers) { const x = this.x(m, W); g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + 5, y + 11); g.lineTo(x, y + 18); g.lineTo(x - 5, y + 11); g.closePath(); g.fill(); }
        } else if (name === 'T1') {
          for (const c of s.captions) {
            const a = this.x(c.start, W), b = this.x(c.end, W);
            g.fillStyle = C.bay; g.fillRect(a, y + 4, Math.max(2, b - a), h - 8);
            g.strokeStyle = C.paper; g.strokeRect(a + 0.5, y + 4.5, Math.max(2, b - a) - 1, h - 9);
          }
        }
      }
      y += h;
    }
    if (!s.duration) return;
    // in/out handles
    for (const t of [s.inT, s.outT]) { const x = Math.round(this.x(t, W)); g.fillStyle = C.paper; g.fillRect(x - 1, RULER, 2, y - RULER); }
    // playhead: the cut
    const px = Math.round(this.x(s.t, W));
    g.fillStyle = C.cut; g.fillRect(px - 1, 0, 2, H);
  }
}
