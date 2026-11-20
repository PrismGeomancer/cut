import { html } from '../ui/dom';
import { areaPath, linePath, linear, nearest, niceTicks, stack } from './scale';
import { hideTip, showTip } from './tooltip';
import { responsive, table, wireToggle } from './table-view';

export interface Series { key: string; label: string; color: string; values: number[] }
export interface AreaOpts {
  times: number[];          // ms
  series: Series[];         // bottom-up, in fixed platform order
  format: (v: number) => string;
  timeLabel: (t: number) => string;
  tickLabel: (t: number) => string;
  summary: string;
  height?: number;
}

const M = { t: 28, r: 16, b: 28, l: 48 };

export function renderArea(fig: HTMLElement, o: AreaOpts) {
  const plot = fig.querySelector<HTMLElement>('.chart__plot')!;
  fig.querySelector('.chart__table')!.innerHTML = table(
    ['Time', ...o.series.map((s) => s.label), ...(o.series.length > 1 ? ['Total'] : [])],
    o.times.map((t, i) => [o.timeLabel(t), ...o.series.map((s) => o.format(s.values[i] ?? 0)), ...(o.series.length > 1 ? [o.format(o.series.reduce((a, s) => a + (s.values[i] ?? 0), 0))] : [])]),
  ).value;
  fig.querySelector('[id$="-summary"]')!.textContent = o.summary;
  wireToggle(fig);

  return responsive(plot, (W) => {
    const H = o.height ?? (W < 520 ? 200 : 280);
    const n = o.times.length;
    const layers = stack(o.series.map((s) => s.values));
    const totals = o.times.map((_, i) => layers.at(-1)?.[i][1] ?? 0);
    const max = Math.max(1, ...totals);
    const ticks = niceTicks(0, max, W < 520 ? 3 : 4);
    const x = linear([o.times[0], o.times[n - 1] || o.times[0] + 1], [M.l, W - M.r]);
    const y = linear([0, ticks.at(-1)!], [H - M.b, M.t]);
    const xs = o.times.map((t) => x(t));

    // x ticks: about one per 110 px
    const xt: number[] = [];
    const want = Math.max(2, Math.floor((W - M.l - M.r) / 110));
    for (let k = 0; k <= want; k++) xt.push(o.times[0] + ((o.times[n - 1] - o.times[0]) * k) / want);

    const fills = layers.map((L, si) => {
      const top = L.map((v, i) => [xs[i], y(v[1])] as [number, number]);
      const bot = L.map((v, i) => [xs[i], y(v[0])] as [number, number]);
      return html`<path d="${areaPath(top, bot)}" fill="${o.series[si].color}" fill-opacity="0.88"/>`;
    });
    // 2 px surface gap between stacked fills
    const gaps = layers.slice(0, -1).map((L) => html`<path d="${linePath(L.map((v, i) => [xs[i], y(v[1])]))}" fill="none" stroke="var(--bay)" stroke-width="2"/>`);
    const topLine = html`<path d="${linePath(totals.map((v, i) => [xs[i], y(v)]))}" fill="none" stroke="${o.series.length === 1 ? o.series[0].color : 'var(--paper)'}" stroke-width="2" stroke-linejoin="round"/>`;

    // direct label on the peak
    const pi = totals.indexOf(Math.max(...totals));
    const px = xs[pi], py = y(totals[pi]);
    const anchor = px > W - 140 ? 'end' : px < M.l + 60 ? 'start' : 'middle';
    const peak = n ? html`<g class="peak"><circle cx="${px}" cy="${py}" r="4" fill="var(--paper)" stroke="var(--bay)" stroke-width="2"/>
      <text x="${px}" y="${Math.max(12, py - 10)}" text-anchor="${anchor}" class="lbl lbl--strong">Peak ${o.format(totals[pi])}</text></g>` : '';

    plot.innerHTML = html`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="presentation" focusable="false">
      ${ticks.map((t) => html`<line x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${M.l - 8}" y="${y(t) + 4}" text-anchor="end" class="lbl">${o.format(t)}</text>`)}
      ${xt.map((t, k) => html`<text x="${x(t)}" y="${H - 8}" text-anchor="${k === 0 ? 'start' : k === xt.length - 1 ? 'end' : 'middle'}" class="lbl">${o.tickLabel(t)}</text>`)}
      ${fills}${gaps}${topLine}${peak}
      <line class="xhair" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>
      <g class="dots"></g>
      <rect class="hit" x="${M.l}" y="0" width="${W - M.l - M.r}" height="${H}" fill="transparent"/>
    </svg>`.value;

    const svg = plot.querySelector('svg')!;
    const xh = svg.querySelector<SVGLineElement>('.xhair')!;
    const dots = svg.querySelector('.dots')!;
    const hit = svg.querySelector('.hit')!;
    hit.addEventListener('pointermove', (e: Event) => {
      const ev = e as PointerEvent;
      const r = svg.getBoundingClientRect();
      const i = nearest(xs, ev.clientX - r.left);
      xh.setAttribute('x1', String(xs[i])); xh.setAttribute('x2', String(xs[i])); xh.setAttribute('visibility', 'visible');
      dots.innerHTML = layers.map((L, si) => `<circle cx="${xs[i]}" cy="${y(L[i][1])}" r="4" fill="${o.series[si].color}" stroke="var(--bay)" stroke-width="2"/>`).join('');
      showTip(html`<div class="tip__t">${o.timeLabel(o.times[i])}</div>
        ${[...o.series].reverse().map((s) => html`<div class="tip__r"><span class="swatch" style="--c:${s.color}"></span><span>${s.label}</span><b>${o.format(s.values[i] ?? 0)}</b></div>`)}
        ${o.series.length > 1 ? html`<div class="tip__r tip__r--total"><span></span><span>Total</span><b>${o.format(totals[i])}</b></div>` : ''}`, ev.clientX, ev.clientY);
    });
    hit.addEventListener('pointerleave', () => { xh.setAttribute('visibility', 'hidden'); dots.innerHTML = ''; hideTip(); });
  });
}
