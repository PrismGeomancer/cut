import { icon } from './icons';
import { CONFIG } from '../config';
import { $, html, mount, safeUrl } from './dom';
import { compact, int, minutesAgo, shortAddr, timecode, usd } from '../lib/format';
import { loadLive, streamsOf } from '../lib/live';
import { ageOf } from '../lib/data';
import { solPrice } from '../lib/market';
import { connect, disconnect, hasWallet, onWallet, walletKey } from '../lib/wallet';
import { currentSession } from '../lib/tiktokSession';
import { toast } from './toast';

export const ROUTES = [
  ['cut', 'Cut', 'cut'], ['post', 'Post', 'post'], ['radar', 'Radar', 'radar'], ['streamers', 'Streamers', 'users'], ['feed', 'Feed', 'feed'], ['earn', 'Earn', 'coin'],
] as const;

export const loginUrl = () => (CONFIG.TIKTOK_AUTH_WORKER_URL ? `${CONFIG.TIKTOK_AUTH_WORKER_URL.replace(/\/$/, '')}/login` : '');
export const xUrl = () => (CONFIG.X_URL ? safeUrl(CONFIG.X_URL) : '');
export const buyUrl = () => (CONFIG.CONTRACT_ADDRESS ? `https://jup.ag/swap/SOL-${encodeURIComponent(CONFIG.CONTRACT_ADDRESS)}` : '');

export function renderBar(el: HTMLElement) {
  mount(el, html`
  <div class="bar__row">
    <a class="brand" href="#/" aria-label="CUT, the desk">
      <img src="./brand/logo-96.png" width="40" height="40" alt="">
      <span class="brand__word">CUT</span>
    </a>
    <span class="bar__tc mono" aria-hidden="true" data-clock>00:00:00:00</span>
    <button class="bar__menu btn btn--ghost btn--sm" type="button" aria-expanded="false" aria-controls="primary-nav" data-menu>Menu</button>
    <nav class="bar__nav" id="primary-nav" aria-label="Primary">
      <ul>${ROUTES.map(([r, label, ic]) => html`<li><a href="#/${r}" data-route="${r}">${icon(ic)}<span>${label}</span></a></li>`)}</ul>
      <div class="bar__actions">
        <span data-tiktok></span>
        <button class="btn btn--ghost btn--sm" type="button" data-wallet>${icon('wallet')}Connect wallet</button>
        <a class="btn btn--ghost btn--sm" data-x href="${xUrl() || '#/'}" ${xUrl() ? 'target="_blank" rel="noopener"' : ''} aria-label="Twitter (X)"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Twitter</a>
        ${buyUrl() ? html`<a class="btn btn--ghost btn--sm" href="${buyUrl()}" target="_blank" rel="noopener">Buy $CUT</a>` : ''}
      </div>
    </nav>
  </div>
  <div class="strip" data-strip hidden></div>`);

  // live clock as timecode (local time of day), updated once a second
  const clock = $('[data-clock]', el)!;
  const tick = () => {
    const d = new Date();
    clock.textContent = timecode(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());
  };
  tick(); setInterval(tick, 1000);

  const menu = $<HTMLButtonElement>('[data-menu]', el)!;
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    el.classList.toggle('is-open', open);
  });
  el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.bar__nav a')) { el.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); } });

  const wbtn = $<HTMLButtonElement>('[data-wallet]', el)!;
  const paintWallet = (pk: string | null) => {
    wbtn.innerHTML = pk ? html`${icon('wallet')}<span class="mono">${shortAddr(pk)}</span>`.value : html`${icon('wallet')}Connect wallet`.value;
    wbtn.setAttribute('aria-label', pk ? `Wallet ${pk}. Disconnect` : 'Connect wallet');
  };
  onWallet(paintWallet);
  wbtn.addEventListener('click', async () => {
    if (walletKey()) { await disconnect(); toast('Wallet disconnected.'); return; }
    if (!hasWallet()) { toast('Connect a wallet to continue.'); return; }
    try { if (await connect()) toast('Wallet connected.'); } catch { toast('Signature cancelled. Nothing was sent.'); }
  });

  paintTikTok(el);
  paintStrip(el);
}

export function paintTikTok(el: HTMLElement = document.querySelector('.bar') as HTMLElement) {
  const slot = $('[data-tiktok]', el);
  if (!slot) return;
  const s = currentSession();
  if (s) mount(slot, html`<a class="who" href="#/post">${safeUrl(s.avatar_url) ? html`<img class="avatar avatar--sm" src="${safeUrl(s.avatar_url)}" width="20" height="20" alt="">` : ''}<span>${s.display_name}</span></a>`);
  else if (loginUrl()) mount(slot, html`<a class="btn btn--ghost btn--sm" href="${loginUrl()}">Log in with TikTok</a>`);
  else slot.innerHTML = '';
}

export function setActive(route: string) {
  document.querySelectorAll<HTMLAnchorElement>('.bar__nav a[data-route]').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

async function paintStrip(el: HTMLElement) {
  const strip = $('[data-strip]', el)!;
  const [live, price] = await Promise.all([loadLive(), solPrice()]);
  const items: string[] = [];
  if (price !== null) items.push(html`<li>${icon('coin', 14)}<span class="k">SOL</span> <b class="num">${usd(price)}</b></li>`.value);
  if (live.state === 'ok' || live.state === 'snapshot') {
    const s = streamsOf(live);
    items.push(html`<li>${icon('live', 14)}<b class="num">${int(s.length)}</b> live now</li>`.value);
    items.push(html`<li>${icon('eye', 14)}<b class="num">${compact(s.reduce((a, x) => a + x.viewers, 0))}</b> watching</li>`.value);
    const m = minutesAgo(ageOf(live));
    items.push(html`<li class="strip__age">${icon('clock', 14)}Updated ${m} min ago</li>`.value);
  }
  if (items.length) { strip.innerHTML = `<ul>${items.join('')}</ul>`; strip.hidden = false; }
}
