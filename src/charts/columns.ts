import { html } from '../ui/dom';
import { barPath, linear, niceTicks } from './scale';
import { hideTip, showTip } from './tooltip';
import { responsive, table, wireToggle } from './table-view';

export interface Col { t: number; label: string; value: number }

/** One series of columns, one axis. Zero days sit on the baseline as a hairline tick. */
export function renderColumns(fig: HTMLElement, cols: Col[], o: { color: string; format: (v: number) => string; tick: (t: number) => string; summary: string; height?: number }) {
  const plot = fig.querySelector<HTMLElement>('.chart__plot')!;
  fig.querySelector('.chart__table')!.innerHTML = table(['Day', 'SOL'], cols.map((c) => [c.label, o.format(c.value)])).value;
  fig.querySelector('[id$="-summary"]')!.textContent = o.summary;
  wireToggle(fig);

  return responsive(plot, (W) => {
    const H = o.height ?? 150, M = { t: 12, r: 4, b: 22, l: 40 };
    const max = Math.max(...cols.map((c) => c.value), 0);
    const ticks = niceTicks(0, max || 1, 2);
    const y = linear([0, ticks.at(-1)!], [H - M.b, M.t]);
    const band = (W - M.l - M.r) / cols.length;
    const bw = Math.max(2, band - 2); // 2 px gap between adjacent bars
    plot.innerHTML = html`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="presentation" focusable="false">
      ${ticks.map((t) => html`<line x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${M.l - 6}" y="${y(t) + 4}" text-anchor="end" class="lbl">${o.format(t)}</text>`)}
      ${cols.map((c, i) => {
        const x0 = M.l + i * band + 1;
        const h = (H - M.b) - y(c.value);
        const mark = c.value > 0
          ? html`<path d="${barPath(x0, y(c.value), bw, Math.max(2, h), 4, 'v')}" fill="${o.color}"/>`
          : html`<rect x="${x0}" y="${H - M.b - 2}" width="${bw}" height="2" fill="var(--faint)"/>`;
        return html`<g class="col" data-i="${i}"><rect class="hit" x="${M.l + i * band}" y="0" width="${band}" height="${H}" fill="transparent"/>${mark}</g>`;
      })}
      ${[0, Math.floor(cols.length / 2), cols.length - 1].map((i, k) => html`<text x="${M.l + i * band + band / 2}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}" class="lbl">${o.tick(cols[i].t)}</text>`)}
    </svg>`.value;
    plot.querySelectorAll<SVGGElement>('.col').forEach((g) => {
      const c = cols[+g.dataset.i!];
      g.addEventListener('pointermove', (e) => showTip(html`<div class="tip__t">${c.label}</div><div class="tip__r"><span class="swatch" style="--c:${o.color}"></span><span>SOL</span><b>${o.format(c.value)}</b></div>`, (e as PointerEvent).clientX, (e as PointerEvent).clientY));
      g.addEventListener('pointerleave', hideTip);
    });
  });
}
