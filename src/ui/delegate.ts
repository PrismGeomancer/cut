// One set of listeners for the shared parts, so every page gets the same behaviour.
import { watchShort, watchStream, watchTwitchClip, playTikTok } from './embed';
import { setStatus, statusIcon, type ContactStatus } from './parts';
import { toast, copy } from './toast';
import { pitch } from '../lib/pitch';
import { PREVIEW } from '../preview';
import { openModal } from './modal';
import { html } from './dom';

/** Preview mode: the channels are invented, so "play" shows the frame instead of a platform embed. */
function previewPlay(el: HTMLElement, title: string) {
  const card = el.closest('.tile, .row, .card, .vcard, tr, .stack__clip, .split aside') ?? document;
  const src = card.querySelector('img')?.getAttribute('src') ?? '';
  const vertical = !!el.closest('.vcard, .grid916');
  openModal(title, html`<div class="${vertical ? 'frame916' : 'frame169'}" style="position:relative">${src ? html`<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px">` : ''}</div>`, { vertical });
}

export function installDelegates() {
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (PREVIEW) {
      const pv = t.closest<HTMLElement>('[data-watch], [data-clip-watch], [data-short], [data-tt-play]');
      // only generated items get the frame; real TikToks and Shorts play from their platform
      const holder = pv?.closest('.tile, .row, .card, .vcard, tr, .stack__clip, .split aside');
      const generated = !!holder?.querySelector('img[src^="./preview/"]');
      if (pv && generated) { previewPlay(pv, pv.dataset.title || pv.closest('[data-tt]')?.querySelector('.vcard__t')?.textContent || 'Preview'); return; }
    }
    const watch = t.closest<HTMLElement>('[data-watch]');
    if (watch) {
      const [platform, login] = watch.dataset.watch!.split(':');
      watchStream(watch.dataset.title || login, platform, login, watch.dataset.url || '');
      return;
    }
    const clip = t.closest<HTMLElement>('[data-clip-watch]');
    if (clip) { watchTwitchClip(clip.dataset.title || 'Clip', clip.dataset.clipWatch!); return; }
    const short = t.closest<HTMLElement>('[data-short]');
    if (short) { watchShort(short.dataset.title || 'Short', short.dataset.short!); return; }
    const play = t.closest<HTMLElement>('[data-tt-play]');
    if (play) {
      const card = play.closest<HTMLElement>('[data-tt]')!;
      const host = card.querySelector<HTMLElement>('.vcard__media')!;
      if (card.classList.contains('is-playing')) return;
      card.classList.add('is-playing');
      playTikTok(host, card.dataset.tt!);
      card.querySelector('.card__a [data-tt-play]')?.remove();
      return;
    }
    const p = t.closest<HTMLElement>('[data-pitch]');
    if (p) { copy(pitch(p.dataset.pitch!), 'Link copied.'); return; }
  });
  document.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('select[data-status]');
    if (!sel) return;
    const v = sel.value as ContactStatus;
    if (setStatus(sel.dataset.status!, v)) toast('Saved in this browser.');
    const icon = sel.parentElement?.querySelector('svg');
    if (icon) icon.outerHTML = statusIcon(v).value;
  });
}
