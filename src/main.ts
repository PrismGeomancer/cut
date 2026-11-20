import './styles.css';
import { CONFIG } from './config';
import { html, mount, safeUrl, reducedMotion } from './ui/dom';
import { renderBar, setActive, paintTikTok } from './ui/nav';
import { installImageFallback } from './ui/img';
import { installDelegates } from './ui/delegate';
import { reconnectIfTrusted } from './lib/wallet';
import { saveSession } from './lib/tiktokSession';
import { toast } from './ui/toast';
import { shortAddr, timecode } from './lib/format';
import { solscanAccount } from './lib/payment';


type Cleanup = void | (() => void);
type Route = { render(root: HTMLElement, params: URLSearchParams): Cleanup | Promise<Cleanup> };
const routes: Record<string, () => Promise<Route>> = {
  '': () => import('./routes/desk'),
  cut: () => import('./routes/cut'),
  post: () => import('./routes/post'),
  radar: () => import('./routes/radar'),
  streamers: () => import('./routes/streamers'),
  feed: () => import('./routes/feed'),
  earn: () => import('./routes/earn'),
  pay: () => import('./routes/pay'),
};
const TITLES: Record<string, string> = { '': 'CUT: Cut the clip. Take your cut.', cut: 'Cut', post: 'Post', radar: 'Radar', streamers: 'Streamers', feed: 'Feed', earn: 'Earn', pay: 'Pay a clipper' };

export function parseHash(hash = location.hash) {
  const h = hash.replace(/^#\/?/, '');
  const [path, q = ''] = h.split('?');
  return { route: path.split('/')[0] ?? '', params: new URLSearchParams(q) };
}

let cleanup: Cleanup;
let first = true;
async function navigate() {
  const { route, params } = parseHash();
  const main = document.getElementById('main')!;

  // TikTok Worker hands back #/post?session=<signed>
  if (route === 'post' && params.get('session')) {
    const s = saveSession(params.get('session')!);
    toast(s ? 'Logged in with TikTok.' : 'TikTok login failed. Try again.');
    paintTikTok();
    history.replaceState(null, '', '#/post');
  }
  if (route === 'post' && params.get('error')) { toast('TikTok login failed. Try again.'); history.replaceState(null, '', '#/post'); }

  const load = routes[route] ?? routes[''];
  if (typeof cleanup === 'function') cleanup();
  setActive(route === 'pay' ? 'earn' : route);
  const scene = document.querySelector('[data-scene]'); if (scene) scene.textContent = SCENES[route] ?? 'The desk';
  document.title = route ? `${TITLES[route] ?? 'CUT'} | CUT` : TITLES[''];
  const mod = await load();
  // a fresh view per navigation: late async writes from the previous route land in a detached node
  const view = document.createElement('div');
  main.replaceChildren(view);
  cleanup = await mod.render(view, params);
  if (!first) {
    scrollTo(0, 0); main.focus({ preventScroll: true });
    // a short fade answers the click; nothing moves on its own
    if (!reducedMotion()) view.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
  first = false;
}

const SCENES: Record<string, string> = { '': 'The desk', cut: 'Cut', post: 'Post', radar: 'Radar', streamers: 'Streamers', feed: 'Feed', earn: 'Earn', pay: 'Pay a clipper' };

/** The footer is a slate: the board that opens and closes every take. */
function footer() {
  const community = [
    CONFIG.X_URL && html`<li><a href="${safeUrl(CONFIG.X_URL)}" target="_blank" rel="noopener">X</a></li>`,
    CONFIG.TELEGRAM_URL && html`<li><a href="${safeUrl(CONFIG.TELEGRAM_URL)}" target="_blank" rel="noopener">Telegram</a></li>`,
    CONFIG.CONTRACT_ADDRESS && html`<li><a href="${solscanAccount(CONFIG.CONTRACT_ADDRESS)}" target="_blank" rel="noopener">Contract <span class="mono">${shortAddr(CONFIG.CONTRACT_ADDRESS)}</span></a></li>`,
    CONFIG.REPO_URL && html`<li><a href="${safeUrl(CONFIG.REPO_URL)}" target="_blank" rel="noopener">Repo</a></li>`,
  ].filter(Boolean);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  mount(document.getElementById('foot')!, html`
    <div class="slate">
      <div class="slate__stick" aria-hidden="true"><span></span></div>
      <div class="slate__board">
        <div class="slate__cell slate__cell--brand">
          <img src="./brand/logo-96.png" width="56" height="56" alt="">
          <div><span class="slate__k">Production</span><b class="slate__v">CUT</b></div>
        </div>
        <div class="slate__cell"><span class="slate__k">Scene</span><b class="slate__v" data-scene>The desk</b></div>
        <div class="slate__cell"><span class="slate__k">Date</span><b class="slate__v">${today}</b></div>
        <div class="slate__cell"><span class="slate__k">Timecode</span><b class="slate__v mono" data-foot-tc>00:00:00:00</b></div>
      </div>
      <p class="slate__line">Cut the clip. Take your cut.</p>
    </div>
    <nav class="foot__nav" aria-label="Footer">
      <div><h2>The desk</h2><ul>${[['cut', 'Cut'], ['post', 'Post'], ['radar', 'Radar'], ['streamers', 'Streamers'], ['feed', 'Feed']].map(([r, l]) => html`<li><a href="#/${r}">${l}</a></li>`)}</ul></div>
      <div><h2>Money</h2><ul>${[['earn?tab=pay', 'Pay a clipper'], ['earn?tab=get', 'Get paid'], ['earn?tab=receipts', 'Receipts'], ['earn?tab=board', 'Leaderboard'], ['earn?tab=rules', 'Rules']].map(([r, l]) => html`<li><a href="#/${r}">${l}</a></li>`)}</ul></div>
      ${community.length ? html`<div><h2>Community</h2><ul>${community as any}</ul></div>` : ''}
    </nav>
    <div class="foot__small">
      <p>Not financial advice. Meme coins can lose all their value. Verify the contract on the official X.</p>
      <p>Streams, clips and videos belong to their creators and play from the platforms they were posted on. Prices from DexScreener.</p>
      <button class="linkbtn" type="button" data-top>Back to top</button>
    </div>`);
  const tc = document.querySelector('[data-foot-tc]')!;
  setInterval(() => { const d = new Date(); tc.textContent = timecode(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()); }, 1000);
  document.querySelector('[data-top]')!.addEventListener('click', () => { scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); document.getElementById('main')!.focus({ preventScroll: true }); });
}

/** Loader: about 1.2 s, skippable, once per session, never with reduced motion. */
function loader(): Promise<void> {
  let seen = false;
  try { seen = sessionStorage.getItem('cut:loaded') === '1'; sessionStorage.setItem('cut:loaded', '1'); } catch { seen = true; }
  if (seen || reducedMotion() || navigator.webdriver) return Promise.resolve();
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'loader';
    el.innerHTML = html`<div class="loader__in"><span class="loader__tc" aria-hidden="true">00:00:00:00</span><span class="loader__line">Rolling.</span></div><button class="btn btn--ghost btn--sm loader__skip" type="button">Skip</button>`.value;
    document.body.append(el);
    const tc = el.querySelector('.loader__tc')!;
    const t0 = performance.now();
    let done = false;
    const finish = () => { if (done) return; done = true; el.remove(); resolve(); };
    el.querySelector('button')!.addEventListener('click', finish);
    const step = (now: number) => {
      const f = Math.min(25, Math.floor(((now - t0) / 1000) * 25));
      tc.textContent = f >= 25 ? '00:00:01:00' : `00:00:00:${String(f).padStart(2, '0')}`;
      if (now - t0 < 1200 && !done) requestAnimationFrame(step); else setTimeout(finish, 80);
    };
    requestAnimationFrame(step);
  });
}

installImageFallback();
installDelegates();
renderBar(document.getElementById('bar')!);
// sticky filters sit right under the top bar, whatever its height
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--bar-h', `${Math.round(e.target.getBoundingClientRect().height)}px`)).observe(document.getElementById('bar')!);
footer();
reconnectIfTrusted();
document.querySelector('[data-skip]')!.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('main')!.focus(); });
window.addEventListener('hashchange', navigate);
addEventListener('offline', () => toast("You're offline. The editor still works."));
loader().then(navigate);
