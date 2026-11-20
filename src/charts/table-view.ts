import { html, type SafeHtml } from '../ui/dom';
import { icon } from '../ui/icons';

export interface ChartFrame { title: string; id: string; icon?: string; legend?: { label: string; color: string }[]; note?: string }

/**
 * Shared chart frame: title, legend (only for 2+ series), a Chart/Table toggle,
 * the drawing area, a screen-reader summary and the table view.
 */
export function frame(f: ChartFrame): SafeHtml {
  return html`
  <figure class="chart" data-chart="${f.id}" data-view="chart">
    <figcaption class="chart__head">
      <h3 class="chart__title" id="${f.id}-t">${f.icon ? icon(f.icon, 16) : ''}<span>${f.title}</span></h3>
      <div class="chart__tools">
        ${f.legend && f.legend.length > 1 ? html`<ul class="legend" aria-label="Legend">${f.legend.map((l) => html`<li><span class="swatch" style="--c:${l.color}"></span>${l.label}</li>`)}</ul>` : ''}
        <button class="linkbtn" type="button" data-toggle-table aria-controls="${f.id}-table" aria-pressed="false">${icon('table', 14)}<span>Table</span></button>
      </div>
    </figcaption>
    <div class="chart__plot" id="${f.id}-plot" aria-hidden="true"></div>
    <p class="sr-only" id="${f.id}-summary"></p>
    <div class="chart__table" id="${f.id}-table" hidden></div>
    ${f.note ? html`<p class="chart__note">${f.note}</p>` : ''}
  </figure>`;
}

export function table(headers: string[], rows: (string | number)[][]): SafeHtml {
  return html`<table class="data data--compact"><thead><tr>${headers.map((h, i) => html`<th scope="col" class="${i ? 'num' : ''}">${h}</th>`)}</tr></thead>
  <tbody>${rows.map((r) => html`<tr>${r.map((c, i) => (i ? html`<td class="num">${c}</td>` : html`<th scope="row">${c}</th>`))}</tr>`)}</tbody></table>`;
}

/** Wire the toggle once per figure. */
export function wireToggle(fig: HTMLElement) {
  const btn = fig.querySelector<HTMLButtonElement>('[data-toggle-table]');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', () => {
    const toTable = fig.dataset.view === 'chart';
    fig.dataset.view = toTable ? 'table' : 'chart';
    btn.innerHTML = icon(toTable ? 'chart' : 'table', 14).value + `<span>${toTable ? 'Chart' : 'Table'}</span>`;
    btn.setAttribute('aria-pressed', String(toTable));
    (fig.querySelector('.chart__table') as HTMLElement).hidden = !toTable;
    (fig.querySelector('.chart__plot') as HTMLElement).hidden = toTable;
  });
}

/** Re-render on width changes. Returns a disposer. */
export function responsive(el: HTMLElement, draw: (w: number) => void) {
  let last = 0;
  const run = () => { const w = Math.floor(el.clientWidth); if (w && w !== last) { last = w; draw(w); } };
  const ro = new ResizeObserver(run);
  ro.observe(el);
  run();
  return () => ro.disconnect();
}
