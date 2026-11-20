import { html } from '../ui/dom';
import { barPath, linear } from './scale';
import { hideTip, showTip } from './tooltip';
import { responsive, table, wireToggle } from './table-view';

export interface Bar { label: string; value: number; color: string }

/** Horizontal bars: 4 px rounded data ends on the baseline, 2 px gaps, direct labels. */
export function renderBars(fig: HTMLElement, bars: Bar[], o: { format: (v: number) => string; summary: string; labelWidth?: number; share?: boolean }) {
  const plot = fig.querySelector<HTMLElement>('.chart__plot')!;
  const total = bars.reduce((a, b) => a + b.value, 0) || 1;
  fig.querySelector('.chart__table')!.innerHTML = table(['Name', 'Viewers', 'Share'], bars.map((b) => [b.label, o.format(b.value), `${Math.round((b.value / total) * 100)}%`])).value;
  fig.querySelector('[id$="-summary"]')!.textContent = o.summary;
  wireToggle(fig);

  return responsive(plot, (W) => {
    const BH = 18, GAP = 2, LW = Math.min(o.labelWidth ?? 92, W * 0.34), VALW = 64;
    const H = bars.length * (BH + GAP) - GAP;
    const max = Math.max(1, ...bars.map((b) => b.value));
    const x = linear([0, max], [0, Math.max(10, W - LW - VALW)]);
    plot.innerHTML = html`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="presentation" focusable="false">
      <line x1="${LW}" x2="${LW}" y1="0" y2="${H}" class="axis"/>
      ${bars.map((b, i) => {
        const yy = i * (BH + GAP), w = Math.max(b.value > 0 ? 2 : 0, x(b.value));
        return html`<g class="bar" data-i="${i}">
          <rect x="0" y="${yy - 1}" width="${W}" height="${BH + 2}" fill="transparent" class="hit"/>
          <text x="${LW - 8}" y="${yy + BH / 2 + 4}" text-anchor="end" class="lbl lbl--paper">${b.label}</text>
          <path d="${barPath(LW, yy, w, BH, 4, 'h')}" fill="${b.color}"/>
          <text x="${LW + w + 6}" y="${yy + BH / 2 + 4}" class="lbl lbl--paper num">${o.format(b.value)}${o.share ? html`<tspan class="lbl--muted"> ${Math.round((b.value / total) * 100)}%</tspan>` : ''}</text>
        </g>`;
      })}
    </svg>`.value;
    plot.querySelectorAll<SVGGElement>('.bar').forEach((g) => {
      const b = bars[+g.dataset.i!];
      g.addEventListener('pointermove', (e) => showTip(html`<div class="tip__r"><span class="swatch" style="--c:${b.color}"></span><span>${b.label}</span><b>${o.format(b.value)}</b></div><div class="tip__s">${Math.round((b.value / total) * 100)}% of the list</div>`, (e as PointerEvent).clientX, (e as PointerEvent).clientY));
      g.addEventListener('pointerleave', hideTip);
    });
  });
}
