import { html, type SafeHtml } from './dom';

/** Native <dialog>: focus trap, Esc to close, focus returns to the opener. */
export function openModal(title: string, body: SafeHtml, opts: { vertical?: boolean } = {}) {
  const opener = document.activeElement as HTMLElement | null;
  const d = document.createElement('dialog');
  d.className = `modal${opts.vertical ? ' modal--vertical' : ''}`;
  d.setAttribute('aria-label', title);
  d.innerHTML = html`<div class="modal__bar"><h2 class="modal__title">${title}</h2><button class="btn btn--ghost btn--sm" type="button" data-close>Close</button></div><div class="modal__body">${body}</div>`.value;
  document.body.append(d);
  const close = () => d.close();
  d.querySelector('[data-close]')!.addEventListener('click', close);
  d.addEventListener('click', (e) => { if (e.target === d) close(); });
  d.addEventListener('close', () => { d.remove(); opener?.focus(); });
  d.showModal();
  return d;
}
