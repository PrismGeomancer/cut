import { icon } from './icons';
// The parts every page is built from.
import { html, raw, safeUrl, type SafeHtml } from './dom';
import { img, avatar } from './img';
import { dot } from './empty';
import { age, clock, compact, int, liveFor, usd, usdCompact, languageName } from '../lib/format';
import { thumbAt, aboutUrl, PLATFORM_NAME, PLATFORM_VAR, type Stream, type StreamerInfo } from '../lib/live';
import type { Clip } from '../lib/clips';
import type { Short } from '../lib/shorts';
import type { FeedItem } from '../lib/feed';
import type { MarketRow } from '../lib/market';
import { getJSON, setJSON } from '../lib/storage';

export const clipThisHref = (name: string) => `#/cut?source=${encodeURIComponent(name)}`;

/** Live tile: thumbnail, platform, name, one-line title, viewers. Hover raises the title and Clip this. */
export function liveTile(s: Stream, i: number): SafeHtml {
  return html`<article class="tile" data-stream="${s.platform}:${s.id}">
    <div class="tile__img sel">
      ${img(thumbAt(s.thumbnail, 440, 248), 440, 248, PLATFORM_NAME[s.platform], { eager: i < 4 })}
      <span class="tile__badge"><i class="rec" aria-hidden="true"></i>live ${liveFor(s.startedAt)}</span><span class="tile__views">${icon('eye', 13)}${compact(s.viewers)}</span>
      <div class="tile__over"><p>${s.title}</p><div class="card__a">
        <button class="btn btn--ghost btn--sm" type="button" data-watch="${s.platform}:${s.login || s.name}" data-title="${s.name}" data-url="${safeUrl(s.url)}">${icon('play', 14)}Watch</button>
        <a class="btn btn--sm" href="${clipThisHref(s.name)}">${icon('cut', 14)}Clip this</a></div></div>
    </div>
    <div class="tile__name"><a href="#/radar?tab=live&focus=${encodeURIComponent(`${s.platform}:${s.id}`)}">${s.name}</a><span class="num">${compact(s.viewers)} watching</span></div>
    <div class="tile__title">${s.title}</div>
    <div class="tile__meta">${dot(s.platform)}${s.game ? html`<span class="tag">${s.game.replace(/^Grand Theft Auto /, 'GTA ')}</span>` : ''}</div>
  </article>`;
}

/** Ranked clip row: thumb, title, broadcaster, creator, duration, view bar on a shared scale, views, age. */
export function clipRow(c: Clip, i: number, maxViews: number): SafeHtml {
  const pct = maxViews ? Math.max(1, (c.views / maxViews) * 100) : 0;
  return html`<li class="row">
    <span class="row__rank">${i + 1}</span>
    <div class="row__thumb sel">${img(c.thumbnail, 480, 272, 'Twitch')}<span class="row__dur">${clock(c.duration)}</span></div>
    <div class="row__main"><span class="row__title">${c.title}</span><span class="row__sub"><span>${c.broadcaster}</span><span>clipped by ${c.creator}</span></span></div>
    <div class="row__bar" aria-label="${int(c.views)} views"><div class="track"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div><span><b>${icon('eye', 13)}${compact(c.views)} views</b><em>${icon('clock', 13)}${age(c.createdAt)}</em></span></div>
    <div class="row__act"><button class="btn btn--ghost btn--sm" type="button" data-clip-watch="${c.embedUrl}" data-title="${c.title}">${icon('play', 14)}Watch</button><a class="btn btn--sm" href="${clipThisHref(c.broadcaster)}">${icon('cut', 14)}Clip this</a></div>
  </li>`;
}

export function shortCard(s: Short): SafeHtml {
  return html`<article class="card">
    <div class="sel">${img(s.thumbnail, 360, 640, 'YouTube', { cls: 'media--v' })}</div>
    <span class="card__t">${s.title}</span>
    <span class="card__s">${s.channel}</span>
    ${s.views || s.publishedAt ? html`<span class="card__s card__s--pair num">${s.views ? html`<span>${icon('eye', 13)}${compact(s.views)} views</span>` : ''}${s.publishedAt ? html`<span>${icon('clock', 13)}${age(s.publishedAt)}</span>` : ''}</span>` : ''}
    <div class="card__a"><button class="btn btn--ghost btn--sm" type="button" data-short="${s.id}" data-title="${s.title}">${icon('play', 14)}Watch</button></div>
  </article>`;
}

export function clipCard(c: Clip): SafeHtml {
  return html`<article class="card">
    <div class="row__thumb sel">${img(c.thumbnail, 480, 272, 'Twitch')}<span class="row__dur">${clock(c.duration)}</span></div>
    <span class="card__t">${c.title}</span>
    <span class="card__s card__s--pair"><span>${c.broadcaster}</span><span>clipped by ${c.creator}</span></span>
    <span class="card__s card__s--pair num"><span>${icon('eye', 13)}${compact(c.views)} views</span><span>${icon('clock', 13)}${age(c.createdAt)}</span></span>
    <div class="card__a"><button class="btn btn--ghost btn--sm" type="button" data-clip-watch="${c.embedUrl}" data-title="${c.title}">${icon('play', 14)}Watch</button><a class="btn btn--sm" href="${clipThisHref(c.broadcaster)}">${icon('cut', 14)}Clip this</a></div>
  </article>`;
}

/**
 * TikTok card. TikTok's oEmbed no longer returns cover images, so the card is set in type
 * and Play swaps in TikTok's own player for that one card. Loading a player in every card
 * at once gets visitors rate-limited by TikTok's CDN ("Access Denied").
 */
export function tiktokCard(f: FeedItem): SafeHtml {
  const title = f.title || f.url.replace('https://www.', '');
  const cover = f.thumbnail
    ? img(f.thumbnail, 300, 533, 'TikTok', { cls: 'media--v' })
    : html`<button class="ttcard" type="button" data-tt-play aria-label="Play ${title}">
        <span class="ttcard__who"><span class="avatar avatar--fallback">${f.author.replace('@', '').slice(0, 1).toUpperCase()}</span><span>${f.author}</span></span>
        <span class="ttcard__cap">${title.replace(/(^|\s)#\S+/g, '').trim() || title}</span>
        <span class="ttcard__tags">${(title.match(/#\S+/g) ?? []).slice(0, 3).join(' ')}</span>
        <span class="ttcard__play">${icon('play', 22)}</span>
      </button>`;
  return html`<article class="vcard" data-tt="${f.url}">
    <div class="vcard__media">${cover}</div>
    <span class="vcard__t">${title}</span>
    <span class="vcard__a">${f.author}</span>
    <div class="card__a"><button class="btn btn--ghost btn--sm" type="button" data-tt-play>${icon('play', 14)}Play</button><a class="textlink" href="${safeUrl(f.url)}" target="_blank" rel="noopener">Open on TikTok</a></div>
  </article>`;
}

// ── Streamer status (saved in this browser) ───────────────
export const STATUSES = ['Not contacted', 'Contacted', 'Replied', 'Agreed', 'Passed'] as const;
export type ContactStatus = (typeof STATUSES)[number];
const SKEY = 'streamer:status';
export const statuses = () => getJSON<Record<string, ContactStatus>>(SKEY, {});
export const statusOf = (key: string): ContactStatus => statuses()[key] ?? 'Not contacted';
export function setStatus(key: string, s: ContactStatus) { const all = statuses(); all[key] = s; return setJSON(SKEY, all); }

/** Status is an icon plus a label, never colour alone. */
const ICON: Record<ContactStatus, string> = {
  'Not contacted': '<circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/>',
  Contacted: '<circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/><path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor"/>',
  Replied: '<path d="M1.5 3h9v5h-5l-2.5 2v-2h-1.5z" fill="none" stroke="currentColor"/>',
  Agreed: '<circle cx="6" cy="6" r="4.5" fill="currentColor"/><path d="M3.8 6.2l1.5 1.5 3-3" fill="none" stroke="var(--bay)" stroke-width="1.4"/>',
  Passed: '<path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.4"/>',
};
export const statusIcon = (s: ContactStatus) => html`<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">${raw(ICON[s])}</svg>`;

export function statusSelect(key: string, name: string): SafeHtml {
  const cur = statusOf(key);
  return html`<label class="status"><span class="sr-only">Status for ${name}</span>${statusIcon(cur)}
    <select class="input input--sm" data-status="${key}" style="height:32px;width:auto;padding:0 8px">
      ${STATUSES.map((s) => html`<option ${s === cur ? 'selected' : ''}>${s}</option>`)}
    </select></label>`;
}

export function badge(info?: StreamerInfo, partner = false): SafeHtml {
  return html`${info?.platform === 'twitch' && info.broadcasterType === 'partner' ? html`<span class="tag">${icon('check', 12)}Twitch Partner</span>` : ''}
    ${info?.platform === 'twitch' && info.broadcasterType === 'affiliate' ? html`<span class="tag">Twitch Affiliate</span>` : ''}
    ${partner ? html`<span class="tag tag--cut">${icon('shield', 12)}CUT partner</span>` : ''}`;
}

export function whoCell(name: string, avatarUrl: string, extra: SafeHtml | '' = ''): SafeHtml {
  return html`<div class="who-cell">${avatar(avatarUrl, name)}<div><b>${name}</b> ${extra}</div></div>`;
}

// ── Market table ──────────────────────────────────────────
export function change(v: number): SafeHtml {
  const up = v >= 0;
  return html`<span class="chg ${up ? 'chg--up' : 'chg--down'}"><i aria-hidden="true">${up ? '▲' : '▼'}</i>${up ? '+' : '−'}${Math.abs(v).toFixed(1)}%<span class="sr-only">${up ? ' up' : ' down'}</span></span>`;
}

export function marketTable(rows: MarketRow[]): SafeHtml {
  return html`<div class="tablewrap"><table class="data">
    <thead><tr><th scope="col">Token</th><th scope="col" class="num">Price</th><th scope="col" class="num">24 h change</th><th scope="col" class="num">24 h volume</th><th scope="col" class="num">Liquidity</th><th scope="col"><span class="sr-only">Chart</span></th></tr></thead>
    <tbody>${rows.map((r) => html`<tr>
      <th scope="row"><div class="tok">${r.icon ? html`<img src="${safeUrl(r.icon)}" width="28" height="28" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback-avatar="${r.symbol.slice(0, 1)}">` : html`<span class="avatar avatar--fallback">${r.symbol.slice(0, 1)}</span>`}<b>${r.symbol}</b><span>${r.name}</span></div></th>
      <td class="num">${usd(r.priceUsd)}</td><td class="num">${change(r.change24h)}</td><td class="num">${usdCompact(r.volume24h)}</td><td class="num">${usdCompact(r.liquidity)}</td>
      <td class="num">${safeUrl(r.url) ? html`<a class="textlink" href="${safeUrl(r.url)}" target="_blank" rel="noopener">${icon('chart', 14)}Chart<span class="sr-only"> for ${r.symbol}</span></a>` : ''}</td>
    </tr>`)}</tbody></table></div>`;
}

// ── Call sheet rows (Desk and Streamers) ──────────────────
export const PIPE: { s: ContactStatus; label: string }[] = [
  { s: 'Not contacted', label: 'To contact' }, { s: 'Contacted', label: 'Contacted' }, { s: 'Replied', label: 'Replied' },
  { s: 'Agreed', label: 'Agreed' }, { s: 'Passed', label: 'Passed' },
];

export function pipeline(rows: { platform: string; id: string }[], active?: ContactStatus | 'all'): SafeHtml {
  const counts = PIPE.map((x) => rows.filter((r) => statusOf(`${r.platform}:${r.id}`) === x.s).length);
  const btn = active !== undefined;
  return html`<div class="pipe" aria-label="Where the conversations stand">
    <div class="pipe__bar" aria-hidden="true">${PIPE.map((_, i) => (counts[i] ? html`<i class="pipe__seg pipe__seg--${i}" style="flex:${counts[i]}"></i>` : ''))}</div>
    <ul class="pipe__legend">${PIPE.map((x, i) => btn
      ? html`<li><button type="button" class="pipe__btn ${counts[i] ? '' : 'is-zero'}" data-pipe="${x.s}" aria-pressed="${String(active === x.s)}"><i class="pipe__key pipe__seg--${i}" aria-hidden="true"></i><b class="num">${counts[i]}</b>${x.label}</button></li>`
      : html`<li class="${counts[i] ? '' : 'is-zero'}"><i class="pipe__key pipe__seg--${i}" aria-hidden="true"></i><b class="num">${counts[i]}</b>${x.label}</li>`)}</ul>
  </div>`;
}

export function callRow(x: Stream, n: number, max: number, i: StreamerInfo | undefined, partner: boolean, opts: { open?: boolean; selected?: boolean } = {}): SafeHtml {
  const k = `${x.platform}:${x.id}`, st = statusOf(k);
  const who = html`<span class="call__avatar">${avatar(i?.avatar || x.avatar, x.name, 40)}<span class="dot" style="--c:${PLATFORM_VAR[x.platform]}" aria-hidden="true"></span></span>
    <div class="call__who">
      <b>${x.name}</b>
      <span class="call__meta"><span>${PLATFORM_NAME[x.platform]}</span>${x.game ? html`<span>${x.game.replace(/^Grand Theft Auto /, 'GTA ')}</span>` : ''}<span>${languageName(i?.language || x.language)}</span></span>
      <span class="call__badges">${badge(i, partner)}</span>
    </div>`;
  return html`<li class="call ${opts.selected ? 'is-selected' : ''}" data-status-now="${st}" data-k="${k}">
    <span class="call__rank num">${n + 1}</span>
    ${opts.open ? html`<button type="button" class="call__open" data-open="${k}" aria-label="Open ${x.name}">${who}</button>` : who}
    <div class="call__views"><b class="num">${compact(x.viewers)}</b><span class="call__bar" aria-hidden="true"><i style="width:${Math.max(4, (x.viewers / (max || 1)) * 100).toFixed(1)}%;background:${PLATFORM_VAR[x.platform]}"></i></span></div>
    <div class="call__status">${statusSelect(k, x.name)}</div>
    <div class="call__act">
      <button class="iconbtn" type="button" data-pitch="${x.name}" aria-label="Copy pitch for ${x.name}" title="Copy pitch">${icon('copy', 16)}</button>
      ${x.generated ? '' : html`<a class="iconbtn" href="${aboutUrl(x)}" target="_blank" rel="noopener" aria-label="Open ${x.name}'s About page" title="Open About page">${icon('user', 16)}</a>`}
    </div>
  </li>`;
}
