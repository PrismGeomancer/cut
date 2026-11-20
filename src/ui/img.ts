import { html, safeUrl as httpsOnly } from './dom';
import { PREVIEW } from '../preview';

// preview mode serves its generated images from ./preview/img; everything else must be https
const safeUrl = (u: string) => (PREVIEW && typeof u === 'string' && u.startsWith('./preview/img/') ? u : httpsOnly(u));

/**
 * A real image with fixed dimensions, lazy, cover-fit. If it fails (or there is no URL),
 * a --panel tile with the platform name takes its place. Never a stock image, never blank.
 */
export function img(url: string, w: number, h: number, fallback: string, opts: { cls?: string; alt?: string; eager?: boolean } = {}) {
  const src = safeUrl(url);
  const cls = `media ${opts.cls ?? ''}`;
  if (!src) return html`<span class="${cls} media--fallback" style="aspect-ratio:${w}/${h}"><span>${fallback}</span></span>`;
  return html`<span class="${cls}" style="aspect-ratio:${w}/${h}"><img src="${src}" width="${w}" height="${h}" alt="${opts.alt ?? ''}" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer" data-fallback="${fallback}"></span>`;
}

export function avatar(url: string, name: string, size = 32) {
  const src = safeUrl(url);
  return src
    ? html`<img class="avatar" style="width:${size}px;height:${size}px" src="${src}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback-avatar="${name.slice(0, 1).toUpperCase()}">`
    : html`<span class="avatar avatar--fallback" style="width:${size}px;height:${size}px" aria-hidden="true">${name.slice(0, 1).toUpperCase()}</span>`;
}

/** One capturing listener swaps any failed image for its fallback tile. */
export function installImageFallback() {
  document.addEventListener('error', (e) => {
    const el = e.target as HTMLImageElement;
    if (!(el instanceof HTMLImageElement)) return;
    if (el.dataset.fallback !== undefined) {
      const wrap = el.parentElement!;
      wrap.classList.add('media--fallback');
      const s = document.createElement('span');
      s.textContent = el.dataset.fallback;
      el.replaceWith(s);
    } else if (el.dataset.fallbackAvatar !== undefined) {
      const s = document.createElement('span');
      s.className = 'avatar avatar--fallback';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = el.dataset.fallbackAvatar;
      el.replaceWith(s);
    }
  }, true);
}
