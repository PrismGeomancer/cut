// Tiny escaping template. Every interpolated value is escaped unless it is a SafeHtml.
export class SafeHtml {
  constructor(readonly value: string) {}
  toString() { return this.value; }
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"'`]/g, (c) => ESC[c]);

type Part = SafeHtml | string | number | boolean | null | undefined | Part[];
const render = (v: Part): string => {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
};

export function html(strings: TemplateStringsArray, ...values: Part[]): SafeHtml {
  let out = '';
  strings.forEach((s, i) => { out += s + (i < values.length ? render(values[i]) : ''); });
  return new SafeHtml(out);
}
export const raw = (s: string) => new SafeHtml(s);

/** Only https URLs from outside; anything else becomes '' so callers hide the link. */
export function safeUrl(u: unknown): string {
  if (typeof u !== 'string' || !u) return '';
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch { return ''; }
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel as any) as T | null;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel as any)) as T[];

export function mount(el: Element, content: SafeHtml) { el.innerHTML = content.value; }

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
