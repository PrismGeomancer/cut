import { html, safeUrl } from './dom';
import { openModal } from './modal';
import { twitchEmbed } from '../lib/clips';
import { shortEmbed } from '../lib/shorts';
import { tiktokId } from '../lib/feed';

// Videos always play from the platform they were posted on. Nothing is downloaded or re-hosted.

/** Swap one card's cover for TikTok's own player (one player per click, never all at once). */
export function playTikTok(host: HTMLElement, url: string) {
  const t = tiktokId(url);
  if (!t) return;
  host.innerHTML = html`<div class="ttframe"><iframe src="https://www.tiktok.com/player/v1/${t.id}?autoplay=1&controls=1&description=0&music_info=0&rel=0" title="TikTok video" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`.value;
}

export function watchTwitchClip(title: string, embedUrl: string) {
  const src = twitchEmbed(embedUrl);
  if (!safeUrl(src)) return;
  openModal(title, html`<div class="frame169"><iframe src="${src}" title="${title}" allowfullscreen allow="autoplay; fullscreen" loading="lazy"></iframe></div>`);
}

export function watchShort(title: string, id: string) {
  openModal(title, html`<div class="frame916"><iframe src="${shortEmbed(id)}" title="${title}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`, { vertical: true });
}

export function watchStream(title: string, platform: string, login: string, url: string) {
  if (platform === 'twitch') {
    const src = `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${encodeURIComponent(location.hostname || 'localhost')}&muted=true`;
    openModal(title, html`<div class="frame169"><iframe src="${src}" title="${title}" allowfullscreen allow="autoplay; fullscreen" loading="lazy"></iframe></div>`);
  } else if (platform === 'kick') {
    const src = `https://player.kick.com/${encodeURIComponent(login)}?muted=true&autoplay=true`;
    openModal(title, html`<div class="frame169"><iframe src="${src}" title="${title}" allowfullscreen allow="autoplay; fullscreen" loading="lazy"></iframe></div>
      <p class="fine"><a href="${safeUrl(url)}" target="_blank" rel="noopener">Open on Kick</a></p>`);
  }
}
