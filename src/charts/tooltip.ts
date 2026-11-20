import type { SafeHtml } from '../ui/dom';

let tip: HTMLDivElement | null = null;
function el() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'presentation');
    tip.setAttribute('aria-hidden', 'true');
    document.body.append(tip);
  }
  return tip;
}

/** Place the tooltip near (clientX, clientY), kept inside the viewport. */
export function showTip(content: SafeHtml, clientX: number, clientY: number) {
  const t = el();
  t.innerHTML = content.value;
  t.style.display = 'block';
  const { width, height } = t.getBoundingClientRect();
  let x = clientX + 14, y = clientY - height - 12;
  if (x + width > innerWidth - 8) x = clientX - width - 14;
  if (x < 8) x = 8;
  if (y < 8) y = clientY + 16;
  t.style.transform = `translate(${Math.round(x + scrollX)}px, ${Math.round(y + scrollY)}px)`;
}
export function hideTip() { if (tip) tip.style.display = 'none'; }
