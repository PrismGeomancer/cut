import { icon } from '../ui/icons';
import { CONFIG } from '../config';
import { $, html, mount, reducedMotion, safeUrl, type SafeHtml } from '../ui/dom';
import { empty, staleLine, EMPTY_LIST, ERROR_LIST } from '../ui/empty';
import { img } from '../ui/img';
import { liveTile, clipRow, tiktokCard, marketTable, change, pipeline, callRow } from '../ui/parts';
import { frame } from '../charts/table-view';
import { renderArea } from '../charts/area';
import { renderBars } from '../charts/bars';
import { renderColumns } from '../charts/columns';
import { compact, int, languageName, minutesAgo, sol, shortAddr, timecode, usd, usdCompact, age } from '../lib/format';
import { ageOf, type Loaded } from '../lib/data';
import {
  loadLive, loadHistory, loadStreamers, streamsOf, filterStreams, byPlatform, byLanguage, thumbAt,
  RANGE_HOURS, PLATFORM_NAME, PLATFORM_VAR, type PlatformFilter, type Range, type HistoryPoint, type StreamerInfo, type LiveFile,
} from '../lib/live';
import { loadClips, clipsOf } from '../lib/clips';
import { loadFeed } from '../lib/feed';
import { loadMarket, tokenPairs } from '../lib/market';
import { loadLedger, ledgerTotals, perDay } from '../lib/treasury';
import { loadLocal } from '../lib/data';
import { solscanAccount } from '../lib/payment';
import { getJSON, setJSON } from '../lib/storage';
import { copy } from '../ui/toast';
import { parseSol, cashbackLamports, lamportsToSolString } from '../lib/fees';

const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const hm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export async function render(root: HTMLElement) {
  const f = getJSON<{ p: PlatformFilter; r: Range }>('desk:filters', { p: 'all', r: '24h' });
  let platform = f.p, range = f.r;

  mount(root, html`
  <section class="hero" aria-labelledby="hero-h">
    <div class="hero__main">
      ${hero()}
      <p class="hero__lede">Edit in your browser. Post to TikTok. When a streamer pays for your clip through CUT, CUT pays you a 3.5% cashback on eligible payments.</p>
      <div class="hero__actions"><a class="btn btn--cut" href="#/cut">${icon('cut')}Open the editor</a><a class="btn" href="#/radar">${icon('radar')}See who's live</a></div>
    </div>
    <aside class="hero__side" aria-label="Biggest streams right now" data-now></aside>
    <div class="hero__tl">${timeline()}</div>
  </section>

  <section class="desk" aria-label="The desk">
    <div class="p s12 p--raised p--sticky"><div class="filters" role="group" aria-label="Filters for every panel">
      <div><span class="lab" id="f-p">Platform</span><div class="seg" role="group" aria-labelledby="f-p" data-f="p">
        ${(['all', 'twitch', 'kick'] as const).map((v) => html`<button type="button" data-v="${v}" aria-pressed="${String(v === platform)}">${v === 'all' ? 'All' : PLATFORM_NAME[v]}</button>`)}</div></div>
      <div><span class="lab" id="f-r">Range</span><div class="seg" role="group" aria-labelledby="f-r" data-f="r">
        ${(['6h', '24h', '7d'] as const).map((v) => html`<button type="button" data-v="${v}" aria-pressed="${String(v === range)}">${v.replace('h', ' h').replace('d', ' d')}</button>`)}</div></div>
    </div></div>
    <div class="p s12" style="padding:0"><ul class="band" data-band aria-label="Right now"></ul></div>

    <div class="p s8" data-viewers>${frame({ id: 'viewers', icon: 'chart', title: 'Viewers over time', legend: [{ label: 'Twitch', color: 'var(--twitch)' }, { label: 'Kick', color: 'var(--kick)' }] })}</div>
    <div class="p s4 p--raised" data-where>
      <div class="p__head"><div><h2>${icon('globe', 18)}Where they watch</h2><p>Viewers across the live list.</p></div></div>
      ${frame({ id: 'by-platform', icon: 'bars', title: 'By platform' })}
      ${frame({ id: 'by-lang', icon: 'globe', title: 'By language' })}
    </div>

    <div class="p s12" data-wall>
      <div class="p__head"><div><h2>${icon('live', 18)}Live now</h2><p>Streams going on right now, biggest first.</p></div><a class="textlink" href="#/radar">See everyone live</a></div>
      <div data-body></div>
    </div>

    <div class="p s7" data-clips>
      <div class="p__head"><div><h2>${icon('film', 18)}Top clips right now</h2><p>The most watched Twitch clips of the last 24 hours.</p></div><a class="textlink" href="#/radar?tab=clips">See all clips</a></div>
      <div data-body></div>
    </div>
    <div class="p s5 p--raised" data-money>
      <div class="p__head"><div><h2>${icon('vault', 18)}The treasury</h2><p>Every payout is a public transaction with a memo that names the payment it answers.</p></div></div>
      <div data-body></div>
    </div>

    <div class="p s12" data-market>
      <div class="p__head"><div><h2>${icon('trend', 18)}Trending on Solana</h2><p>What the market is looking at right now.</p></div></div>
      <div data-body></div>
    </div>

    <div class="p s7" data-tiktok>
      <div class="p__head"><div><h2>${icon('play', 18)}On TikTok</h2><p>Clips from clippers, straight from TikTok.</p></div><a class="textlink" href="#/feed">See the whole feed</a></div>
      <div data-body></div>
    </div>
    <div class="p s5 p--raised" data-contact>
      <div class="p__head"><div><h2>${icon('users', 18)}Streamers to contact</h2><p>Streamers worth a message. Open their page, send the pitch, track the answer.</p></div><a class="textlink" href="#/streamers">Open the pitch list</a></div>
      <div data-body></div>
    </div>

    ${CONFIG.CONTRACT_ADDRESS ? html`<div class="p s12 p--raised" data-token><div class="p__head"><div><h2>$CUT</h2></div></div><div data-body></div></div>` : ''}

    <div class="p s12" style="padding:0">${howItWorks()}</div>
    <div class="p s12 p--raised">${onePayment()}</div>
  </section>`);

  playHero(root);
  wireMoney(root);

  // Data
  const [live, history, streamers] = await Promise.all([loadLive(), loadHistory(), loadStreamers()]);
  const infoById = new Map<string, StreamerInfo>();
  if (streamers.state === 'ok' || streamers.state === 'snapshot') {
    const list = Array.isArray(streamers.data) ? streamers.data : streamers.data.streamers ?? [];
    for (const s of list) infoById.set(`${s.platform}:${s.id}`, s);
  }

  const paint = (animate = false) => {
    paintNow(root, live);
    paintBand(root, live, platform, history, range);
    paintViewers(root, history, platform, range);
    paintWhere(root, live, platform);
    paintWall(root, live, platform);
    paintContact(root, live, platform, infoById);
    // a filter change redraws the charts with a playhead-style wipe, so you see what changed
    if (animate && !reducedMotion()) {
      root.querySelectorAll<SVGElement>('[data-viewers] .chart__plot svg, [data-where] .chart__plot svg').forEach((svg) =>
        svg.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 460, easing: 'cubic-bezier(.2,.7,.2,1)' }));
      root.querySelectorAll<HTMLElement>('[data-band] b, [data-wall] .wall').forEach((el) =>
        el.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }));
    }
  };
  paint();

  root.querySelectorAll<HTMLElement>('[data-f]').forEach((g) => g.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]');
    if (!b) return;
    g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (g.dataset.f === 'p') platform = b.dataset.v as PlatformFilter; else range = b.dataset.v as Range;
    setJSON('desk:filters', { p: platform, r: range });
    paint(true);
  }));

  paintClips(root);
  paintMoney(root);
  paintMarket(root);
  paintTikTok(root);
  if (CONFIG.CONTRACT_ADDRESS) paintToken(root);
}

// ── Hero ────────────────────────────────────────────────────
function hero(): SafeHtml {
  const lines = html`<span>Cut the clip.</span><span>Take your cut.</span>`;
  return html`<h1 class="cutline" id="hero-h" aria-label="Cut the clip. Take your cut.">
    <span class="cutline__whole" aria-hidden="true">${lines}</span>
    <span class="cutline__half cutline__a" aria-hidden="true">${lines}</span>
    <span class="cutline__half cutline__b" aria-hidden="true">${lines}</span>
    <svg class="cutline__seam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="70" x2="100" y2="34"/></svg>
    <span class="cutline__playhead" aria-hidden="true"></span>
  </h1>`;
}

function timeline(): SafeHtml {
  const ticks = Array.from({ length: 41 }, (_, i) => html`<i class="${i % 5 ? '' : 'major'}" style="left:${(i / 40) * 100}%"></i>`);
  // A1 is a drawing of a waveform lane, not data; it carries no numbers.
  const wave = Array.from({ length: 64 }, (_, i) => html`<i style="height:${20 + Math.round(70 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)))}%"></i>`);
  return html`<div class="tl" aria-hidden="true" data-tl>
    <div class="tl__ruler">${ticks}</div>
    <div class="tl__lane"><span class="tl__name">V1</span><div class="tl__track">
      <span class="tl__clip" data-v1a style="left:6%;width:56%"></span><span class="tl__clip tl__clip--b" data-v1b style="left:62%;width:30%"></span></div></div>
    <div class="tl__lane"><span class="tl__name">A1</span><div class="tl__track"><div class="tl__wave" style="left:6%;right:8%">${wave}</div></div></div>
    <div class="tl__lane"><span class="tl__name">$</span><div class="tl__track">
      <span class="tl__pay" style="left:62%">clip price</span><span class="tl__plus" data-plus style="left:calc(62% + 84px)">+3.5%</span></div></div>
    <div class="tl__head" data-head style="left:calc(44px + (100% - 44px) * .62)"><span data-tc>00:00:14:12</span></div>
  </div>`;
}

/** The one autoplaying moment: playhead sweeps, the headline splits on the diagonal, +3.5% drops onto $. */
async function playHero(root: HTMLElement) {
  if (reducedMotion()) return; // final state is the static layout
  const { gsap } = await import('gsap');
  const h1 = $('.cutline', root)!, b = $('.cutline__b', root)!, seam = $('.cutline__seam', root)!, ph = $('.cutline__playhead', root)!;
  const head = $('[data-head]', root)!, tc = $('[data-tc]', root)!, v1b = $('[data-v1b]', root)!, plus = $('[data-plus]', root)!;
  const W = h1.getBoundingClientRect().width;
  const state = { p: 0 };
  gsap.set(b, { x: 0, y: 0 });
  gsap.set(seam, { opacity: 0 });
  gsap.set(v1b, { x: -2 });
  gsap.set(plus, { y: -26, opacity: 0 });
  gsap.set(ph, { opacity: 1, x: 0 });
  const tl = gsap.timeline({ delay: 0.15 });
  tl.to(state, {
    p: 1, duration: 1.05, ease: 'power1.inOut',
    onUpdate: () => {
      ph.style.transform = `translateX(${state.p * W}px)`;
      head.style.left = `calc(44px + (100% - 44px) * ${(0.06 + state.p * 0.56).toFixed(4)})`;
      tc.textContent = timecode(state.p * 14.48);
    },
  })
    .to(seam, { opacity: 1, duration: 0.12 }, '-=0.08')
    .to(b, { x: '0.22em', y: '0.035em', duration: 0.55, ease: 'power3.out' }, '<')
    .to(v1b, { x: 6, duration: 0.45, ease: 'power3.out' }, '<')
    .to(ph, { opacity: 0, duration: 0.3 }, '<0.1')
    .to(plus, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, '-=0.15')
    .add(() => { gsap.set(v1b, { clearProps: 'transform' }); });
}

// ── Panels ──────────────────────────────────────────────────
function paintNow(root: HTMLElement, live: Loaded<LiveFile>) {
  const el = $('[data-now]', root)!;
  const [top, ...rest] = filterStreams(streamsOf(live), 'all').slice(0, 3);
  const updated = live.state === 'ok' || live.state === 'snapshot' ? html`<span>${icon('clock', 13)}Updated <b class="num">${minutesAgo(ageOf(live))}</b> min ago</span>` : '';
  const head = html`<div class="track-head"><span>Biggest stream right now</span>${updated}</div>`;
  if (!top) {
    mount(el, html`${head}<div class="monitor"><div class="monitor__frame monitor__frame--empty"><span class="empty__slate"></span></div></div>
      ${live.state === 'error' ? empty(ERROR_LIST) : empty(EMPTY_LIST)}`);
    return;
  }
  const secs = Math.max(0, (Date.now() - Date.parse(top.startedAt)) / 1000);
  const href = (s: { platform: string; id: string }) => `#/radar?tab=live&focus=${encodeURIComponent(`${s.platform}:${s.id}`)}`;
  const game = (g?: string) => (g ? html`<span class="tag">${g.replace(/^Grand Theft Auto /, 'GTA ')}</span>` : '');
  mount(el, html`${head}${staleLine(live)}
    <div class="monitor">
      <a class="monitor__frame sel sel--on" href="${href(top)}" aria-label="${top.name}, ${compact(top.viewers)} watching">
        ${img(thumbAt(top.thumbnail, 880, 496), 880, 496, PLATFORM_NAME[top.platform], { eager: true })}
        <span class="burn burn--tc" aria-hidden="true">${timecode(secs)}</span>
        <span class="burn burn--views" aria-hidden="true">${icon('eye', 13)}${compact(top.viewers)}</span>
      </a>
      <div class="monitor__meta"><b>${top.name}</b>${game(top.game)}<span class="num">${compact(top.viewers)} watching</span></div>
      <p class="monitor__title">${top.title}</p>
    </div>
    ${rest.length ? html`<ol class="queue" aria-label="Next biggest">${rest.map((s, i) => html`<li>
      <span class="queue__lane">V${i + 2}</span>
      <a class="queue__thumb sel" href="${href(s)}" aria-label="${s.name}, ${compact(s.viewers)} watching">${img(thumbAt(s.thumbnail, 440, 248), 440, 248, PLATFORM_NAME[s.platform], { eager: true })}</a>
      <div class="queue__meta"><b>${s.name}</b><span class="num">${icon('eye', 12)}${compact(s.viewers)}</span></div>
    </li>`)}</ol>` : ''}`);
}

/** A small line of real history next to a headline number. Nothing is drawn without at least two points. */
function spark(vals: number[]): SafeHtml | '' {
  if (vals.length < 2) return '';
  const W = 112, H = 30, max = Math.max(...vals), min = Math.min(...vals);
  const x = (i: number) => (i / (vals.length - 1)) * W, y = (v: number) => H - 3 - ((v - min) / (max - min || 1)) * (H - 6);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return html`<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${x(vals.length - 1)}" cy="${y(vals.at(-1)!)}" r="3" fill="var(--paper)"/></svg>`;
}

function paintBand(root: HTMLElement, live: Loaded<LiveFile>, p: PlatformFilter, history: Loaded<HistoryPoint[]>, r: Range) {
  const el = $('[data-band]', root)!;
  const s = filterStreams(streamsOf(live), p);
  const hist = (history.state === 'ok' || history.state === 'snapshot' ? history.data : [])
    .filter((h) => Date.parse(h.t) >= Date.now() - RANGE_HOURS[r] * 3600_000).sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const viewSpark = spark(hist.map((h) => (p === 'all' ? h.viewers : h[p] ?? 0)));
  const liveSpark = p === 'all' ? spark(hist.map((h) => h.streams)) : '';
  const items: SafeHtml[] = [
    html`<li><span class="band__top"><i class="band__ico">${icon('live', 18)}</i>${liveSpark}</span><b class="num">${int(s.length)}</b><span>live now</span></li>`,
    html`<li><span class="band__top"><i class="band__ico">${icon('eye', 18)}</i>${viewSpark}</span><b class="num">${compact(s.reduce((a, x) => a + x.viewers, 0))}</b><span>watching across the list</span></li>`,
    html`<li data-band-clips><span class="band__top"><i class="band__ico">${icon('film', 18)}</i></span><b class="num">0</b><span>top clips in the last 24 h</span></li>`,
  ];
  if (CONFIG.TREASURY_WALLET) items.push(html`<li class="is-cut" data-band-treasury><span class="band__top"><i class="band__ico">${icon('vault', 18)}</i></span><b class="num">0</b><span>SOL in the treasury</span></li>`);
  if (CONFIG.REFERENCE_KEY) items.push(html`<li data-band-paid><span class="band__top"><i class="band__ico">${icon('receipt', 18)}</i></span><b class="num">0</b><span>payments verified</span></li>`);
  mount(el, html`${items}`);
  loadClips().then((c) => { const n = c.state === 'ok' || c.state === 'snapshot' ? clipsOf(c.data).length : 0; const b = $('[data-band-clips] b', el); if (b) b.textContent = int(n); });
  if (CONFIG.TREASURY_WALLET || CONFIG.REFERENCE_KEY) loadLedger().then((l) => {
    const t = $('[data-band-treasury] b', el); if (t && l.treasury !== null) t.textContent = sol(l.treasury, 2);
    const pd = $('[data-band-paid] b', el); if (pd) pd.textContent = int(l.receipts.length);
  });
}

function paintViewers(root: HTMLElement, history: Loaded<HistoryPoint[]>, p: PlatformFilter, r: Range) {
  const fig = $<HTMLElement>('[data-chart="viewers"]', root)!;
  const host = $('[data-viewers]', root)!;
  host.querySelector('.empty')?.remove();
  const pts = (history.state === 'ok' || history.state === 'snapshot' ? history.data : [])
    .filter((h) => Date.parse(h.t) >= Date.now() - RANGE_HOURS[r] * 3600_000)
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const title = p === 'all' ? 'Viewers over time' : `${PLATFORM_NAME[p]} viewers over time`;
  fig.querySelector('.chart__title span')!.textContent = title;
  (fig.querySelector('.legend') as HTMLElement | null)?.toggleAttribute('hidden', p !== 'all');
  if (pts.length < 2) {
    (fig.querySelector('.chart__plot') as HTMLElement).innerHTML = '';
    fig.insertAdjacentHTML('beforeend', (history.state === 'error' ? empty(ERROR_LIST) : empty(EMPTY_LIST)).value);
    fig.querySelector('.chart__table')!.innerHTML = '';
    return;
  }
  fig.querySelectorAll('.empty').forEach((e) => e.remove());
  const series = (p === 'all' ? (['twitch', 'kick'] as const) : [p]).map((k) => ({ key: k, label: PLATFORM_NAME[k], color: PLATFORM_VAR[k], values: pts.map((h) => h[k] ?? 0) }));
  const times = pts.map((h) => Date.parse(h.t));
  const totals = pts.map((h) => series.reduce((a, s) => a + (h[s.key] ?? 0), 0));
  const peak = Math.max(...totals), pi = totals.indexOf(peak);
  const tick = r === '7d' ? day : hm;
  renderArea(fig, {
    times, series, format: compact,
    timeLabel: (t) => `${day(t)}, ${hm(t)}`, tickLabel: tick,
    summary: `${title}, last ${r.replace('h', ' hours').replace('7d', '7 days')}. Peak ${int(peak)} at ${day(times[pi])} ${hm(times[pi])}. Latest ${int(totals.at(-1)!)}.`,
  });
}

function paintWhere(root: HTMLElement, live: Loaded<LiveFile>, p: PlatformFilter) {
  const s = filterStreams(streamsOf(live), p);
  const figP = $<HTMLElement>('[data-chart="by-platform"]', root)!, figL = $<HTMLElement>('[data-chart="by-lang"]', root)!;
  for (const f of [figP, figL]) f.querySelectorAll('.empty').forEach((e) => e.remove());
  if (!s.length) {
    for (const f of [figP, figL]) { (f.querySelector('.chart__plot') as HTMLElement).innerHTML = ''; f.querySelector('.chart__table')!.innerHTML = ''; }
    figP.insertAdjacentHTML('beforeend', (live.state === 'error' ? empty(ERROR_LIST) : empty(EMPTY_LIST)).value);
    return;
  }
  const bp = byPlatform(s);
  const plats = (p === 'all' ? (['twitch', 'kick'] as const) : [p]).map((k) => ({ label: PLATFORM_NAME[k], value: bp[k], color: PLATFORM_VAR[k] }));
  renderBars(figP, plats, { format: compact, share: true, summary: `Viewers by platform: ${plats.map((x) => `${x.label} ${int(x.value)}`).join(', ')}.` });
  const langs = byLanguage(s).map(([code, v]) => ({ label: languageName(code), value: v, color: p === 'all' ? 'var(--muted)' : PLATFORM_VAR[p] }));
  renderBars(figL, langs, { format: compact, summary: `Six biggest languages: ${langs.map((x) => `${x.label} ${int(x.value)}`).join(', ')}.` });
}

function paintWall(root: HTMLElement, live: Loaded<LiveFile>, p: PlatformFilter) {
  const el = $('[data-wall] [data-body]', root)!;
  const s = filterStreams(streamsOf(live), p).slice(0, 8);
  if (!s.length) { mount(el, live.state === 'error' ? empty(ERROR_LIST, 'empty--tall') : empty(EMPTY_LIST, 'empty--tall')); return; }
  mount(el, html`${staleLine(live)}<div class="wall">${s.map(liveTile)}</div>`);
}

async function paintClips(root: HTMLElement) {
  const el = $('[data-clips] [data-body]', root)!;
  const c = await loadClips();
  const list = c.state === 'ok' || c.state === 'snapshot' ? clipsOf(c.data).slice().sort((a, b) => b.views - a.views).slice(0, 6) : [];
  if (!list.length) { mount(el, c.state === 'error' ? empty(ERROR_LIST) : empty(EMPTY_LIST)); return; }
  const max = list[0].views;
  mount(el, html`${staleLine(c)}<ol class="rows">${list.map((x, i) => clipRow(x, i, max))}</ol>`);
}

const PAUSE_ICON = html`<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="3.5" height="10" rx="1" fill="currentColor"/><rect x="8.5" y="2" width="3.5" height="10" rx="1" fill="currentColor"/></svg>`;

async function paintMoney(root: HTMLElement) {
  const el = $('[data-money] [data-body]', root)!;
  if (!CONFIG.REFERENCE_KEY && !CONFIG.TREASURY_WALLET) { mount(el, empty('Payments open when CUT is configured.')); return; }
  mount(el, html`${frame({ id: 'paid-day', icon: 'bars', title: 'SOL paid to clippers per day' })}${frame({ id: 'cb-day', icon: 'coin', title: 'Cashback paid per day' })}<div data-figs></div>`);
  const l = await loadLedger();
  if (l.error) $('[data-figs]', el)!.insertAdjacentHTML('beforebegin', empty("Couldn't read receipts from the network. Try again.").value);
  const paid = perDay(l.receipts, (r) => r.blockTime * 1000, (r) => r.lamports / 1e9);
  const cbs = perDay(l.payouts, (p) => Date.parse(p.at), (p) => p.lamports / 1e9);
  const fmt = (v: number) => (v === 0 ? '0' : v < 0.01 ? v.toFixed(4) : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const sumP = paid.reduce((a, d) => a + d.value, 0), sumC = cbs.reduce((a, d) => a + d.value, 0);
  renderColumns($<HTMLElement>('[data-chart="paid-day"]', el)!, paid.map((d) => ({ t: d.t, label: day(d.t), value: d.value })), { color: 'var(--paper)', format: fmt, tick: day, summary: `SOL paid to clippers over the last 30 days: ${fmt(sumP)} SOL in total.` });
  renderColumns($<HTMLElement>('[data-chart="cb-day"]', el)!, cbs.map((d) => ({ t: d.t, label: day(d.t), value: d.value })), { color: 'var(--cut)', height: 110, format: fmt, tick: day, summary: `Cashback paid over the last 30 days: ${fmt(sumC)} SOL in total.` });
  const t = ledgerTotals(l);
  mount($('[data-figs]', el)!, html`<div class="figs">
    ${CONFIG.TREASURY_WALLET ? html`<div class="big"><span>Balance</span><b class="num">${l.treasury === null ? '' : sol(l.treasury, 3)} SOL</b></div>` : ''}
    <div><span>Paid out</span><b>${sol(t.paidOut)} SOL</b></div>
    <div><span>Waiting</span><b>${sol(t.waiting)} SOL</b></div>
    <div><span>Last payout</span><b>${t.last ? age(t.last) : '0'}</b></div>
    ${CONFIG.TREASURY_WALLET ? html`<div><span>Treasury wallet</span><b><a class="mono" href="${solscanAccount(CONFIG.TREASURY_WALLET)}" target="_blank" rel="noopener">${shortAddr(CONFIG.TREASURY_WALLET)}</a> <button class="linkbtn" type="button" data-copy-treasury>Copy</button></b></div>` : ''}
  </div>
  ${t.empty ? html`<p class="paused">${PAUSE_ICON}Cashback is paused. The treasury is empty.</p>` : ''}`);
  $('[data-copy-treasury]', el)?.addEventListener('click', () => copy(CONFIG.TREASURY_WALLET, 'Link copied.'));
}

async function paintMarket(root: HTMLElement) {
  const el = $('[data-market] [data-body]', root)!;
  mount(el, html`<p class="fine">Loading prices from DexScreener.</p>`);
  const m = await loadMarket(10);
  if (!m || !m.rows.length) { mount(el, empty("Couldn't load the market. Try again in a minute.")); return; }
  mount(el, html`${marketTable(m.rows)}<p class="fine" style="margin-top:12px">Prices from DexScreener, updated ${minutesAgo(m.generatedAt)} min ago.</p>`);
}

async function paintTikTok(root: HTMLElement) {
  const el = $('[data-tiktok] [data-body]', root)!;
  const feed = (await loadFeed()).slice(0, 6);
  if (!feed.length) { mount(el, html`${empty('No TikToks yet. Paste the first link.')}<a class="btn btn--sm" href="#/feed">${icon('plus', 14)}Add a TikTok link</a>`); return; }
  mount(el, html`<div class="vrow">${feed.map(tiktokCard)}</div>`);
}

/** A call sheet: who to message next, how big they are, and where each conversation stands. */
async function paintContact(root: HTMLElement, live: Loaded<LiveFile>, p: PlatformFilter, info: Map<string, StreamerInfo>) {
  const el = $('[data-contact] [data-body]', root)!;
  const s = filterStreams(streamsOf(live), p).slice(0, 8);
  if (!s.length) { mount(el, live.state === 'error' ? empty(ERROR_LIST) : empty(EMPTY_LIST)); return; }
  const partners = new Set((await loadLocal<{ platform: string; id: string }[]>('partners.json', [])).map((x) => `${x.platform}:${x.id}`));
  const draw = () => mount(el, html`${pipeline(s)}<ol class="calls">${s.map((x, n) => callRow(x, n, s[0].viewers, info.get(`${x.platform}:${x.id}`), partners.has(`${x.platform}:${x.id}`)))}</ol>`);
  draw();
  el.addEventListener('change', (e) => { if ((e.target as HTMLElement).matches('select[data-status]')) setTimeout(draw, 0); });
}

async function paintToken(root: HTMLElement) {
  const el = $('[data-token] [data-body]', root)!;
  const ca = CONFIG.CONTRACT_ADDRESS;
  let row = null;
  try { row = (await tokenPairs([ca]))[0] ?? null; } catch { /* hide figures */ }
  mount(el, html`<div class="tokenstrip">
    ${row ? html`<dl><div><dt>Price</dt><dd>${usd(row.priceUsd)}</dd></div><div><dt>Market cap</dt><dd>${usdCompact(row.marketCap)}</dd></div><div><dt>Liquidity</dt><dd>${usdCompact(row.liquidity)}</dd></div><div><dt>24h volume</dt><dd>${usdCompact(row.volume24h)}</dd></div><div><dt>24 h</dt><dd>${change(row.change24h)}</dd></div></dl>` : ''}
    <div class="card__a">
      <button class="btn btn--sm" type="button" data-copy-ca>Contract <span class="mono">${shortAddr(ca)}</span></button>
      ${CONFIG.X_URL ? html`<a class="btn btn--ghost btn--sm" href="${safeUrl(CONFIG.X_URL)}" target="_blank" rel="noopener">X</a>` : ''}
      ${CONFIG.TELEGRAM_URL ? html`<a class="btn btn--ghost btn--sm" href="${safeUrl(CONFIG.TELEGRAM_URL)}" target="_blank" rel="noopener">Telegram</a>` : ''}
      ${CONFIG.CHART_URL ? html`<a class="btn btn--ghost btn--sm" href="${safeUrl(CONFIG.CHART_URL)}" target="_blank" rel="noopener">Chart</a>` : ''}
    </div></div>`);
  $('[data-copy-ca]', el)!.addEventListener('click', () => copy(ca, 'Contract copied.'));
}

// ── How it works: four clips on a real timeline, each on its own lane ──────────
function howItWorks(): SafeHtml {
  const steps = [
    ['V1', 'radar', 'Find a moment', 'Radar lists the streams live right now, and the clips already going round. Or drop in a recording you already have.', '00:00:00:00'],
    ['V2', 'cut', 'Cut it', 'Trim, reframe to 9:16, add captions, pick a look, export. Your browser does the work. Nothing is uploaded.', '00:00:15:00'],
    ['A1', 'post', 'Post it', 'Log in with TikTok, queue the clip with a caption and a time. CUT reminds you when it is due. Publishing happens in TikTok.', '00:00:30:00'],
    ['$', 'coin', 'Get paid, then get more', 'The streamer opens your pay link and sends the clip price straight to your wallet. CUT adds a 3.5% cashback from the treasury once the payment checks out.', '00:00:45:00'],
  ];
  const ticks = Array.from({ length: 61 }, (_, i) => html`<i class="${i % 15 === 0 ? 'major' : i % 5 === 0 ? 'mid' : ''}" style="left:${(i / 60) * 100}%"></i>`);
  return html`<section class="flow" aria-labelledby="flow-h">
    <div class="flow__head"><h2 id="flow-h">${icon('film', 18)}How it works</h2><p>Four steps, from a live moment to a paid clip.</p></div>
    <div class="flow__board">
      <div class="flow__ruler" aria-hidden="true">${ticks}${steps.map((st, i) => html`<span class="flow__tc" style="left:${i * 25}%">${st[4]}</span>`)}</div>
      <ol class="flow__lanes">${steps.map(([lane, ic, h, p], i) => html`<li class="flow__lane" style="--i:${i}">
        <span class="flow__name" aria-hidden="true">${lane}</span>
        <div class="flow__clip ${i === 3 ? 'flow__clip--cut' : ''}">
          <span class="flow__ico">${icon(ic, 20)}</span>
          <div><h3><span class="flow__n num">0${i + 1}</span>${h}</h3><p>${p}</p></div>
        </div>
      </li>`)}</ol>
      <span class="flow__head-line" aria-hidden="true"><span>+3.5%</span></span>
    </div>
  </section>`;
}

// ── One payment. One cashback: the flow of money, with a live worked example ──
function onePayment(): SafeHtml {
  return html`<section class="money2" aria-labelledby="money-h" data-money2>
    <div class="money2__head">
      <h2 id="money-h">${icon('coin', 18)}One payment. One cashback.</h2>
      <p>CUT never holds the streamer's money. The treasury balance is public. When it is empty, cashback pauses. The clip payment doesn't.</p>
    </div>
    <div class="money2__grid">
      <div class="flowmap" aria-hidden="true">
        <div class="node node--streamer">${icon('user', 20)}<b>Streamer</b><span>pays the clip price</span></div>
        <div class="wire wire--pay"><span class="wire__lbl"><b class="num" data-m-price>1</b> SOL clip price</span><i></i></div>
        <div class="node node--clipper">${icon('cut', 20)}<b>Clipper</b><span>receives <b class="num" data-m-total>1.035</b> SOL</span></div>
        <div class="wire wire--cb"><span class="wire__lbl"><b class="num" data-m-cb>0.035</b> SOL after ${CONFIG.DELAY_HOURS} h</span><i></i></div>
        <div class="node node--treasury">${icon('vault', 20)}<b>CUT treasury</b><span>pays 3.5% on top</span></div>
      </div>
      <div class="calc">
        <label class="field"><span>Try a clip price (SOL)</span><input class="input num calc__in" type="number" inputmode="decimal" min="0" step="0.05" value="1" data-m-in></label>
        <input type="range" min="0" max="20" step="0.05" value="1" data-m-range aria-label="Clip price in SOL">
        <dl class="calc__out">
          <div><dt>Streamer pays</dt><dd><b class="num" data-m-o1>1</b> SOL plus the network fee</dd></div>
          <div><dt>Clipper receives</dt><dd><b class="num" data-m-o2>1</b> SOL straight away</dd></div>
          <div class="calc__cb"><dt>Cashback from CUT</dt><dd><b class="num" data-m-o3>0.035</b> SOL after ${CONFIG.DELAY_HOURS} hours</dd></div>
        </dl>
        <p class="fine" data-m-note>Cashback is capped at ${CONFIG.PER_PAYMENT_CAP_SOL} SOL per payment and ${CONFIG.PER_DAY_CAP_SOL} SOL per clipper per day.</p>
      </div>
    </div>
    <ol class="money2__lines">
      <li>${icon('send', 16)}The streamer pays the clip price, straight to the clipper's wallet.</li>
      <li>${icon('coin', 16)}CUT pays the clipper 3.5% on top, from the treasury, after ${CONFIG.DELAY_HOURS} hours.</li>
      <li>${icon('receipt', 16)}Every payment and every cashback is a public transaction.</li>
    </ol>
  </section>`;
}

/** Wires the worked example to the real fee math (integer lamports, same caps as the payout). */
function wireMoney(root: HTMLElement) {
  const box = $('[data-money2]', root);
  if (!box) return;
  const inp = $<HTMLInputElement>('[data-m-in]', box)!, rng = $<HTMLInputElement>('[data-m-range]', box)!;
  const set = (sel: string, v: string) => box.querySelectorAll(sel).forEach((e) => { e.textContent = v; });
  const update = (raw: string) => {
    const lamports = parseSol(raw) ?? 0;
    const cap = Math.round(CONFIG.PER_PAYMENT_CAP_SOL * 1e9);
    const eligible = lamports >= Math.round(CONFIG.MIN_PRICE_SOL * 1e9);
    const cb = eligible ? cashbackLamports(lamports, CONFIG.CASHBACK_BPS, cap) : 0;
    const price = lamportsToSolString(lamports), cbS = lamportsToSolString(cb), total = lamportsToSolString(lamports + cb);
    set('[data-m-price], [data-m-o1], [data-m-o2]', price); set('[data-m-cb], [data-m-o3]', cbS); set('[data-m-total]', total);
    const note = $('[data-m-note]', box)!;
    note.textContent = !eligible && lamports > 0
      ? `Payments below ${CONFIG.MIN_PRICE_SOL} SOL don't earn cashback.`
      : cb === cap ? `This hits the cap: cashback is capped at ${CONFIG.PER_PAYMENT_CAP_SOL} SOL per payment.`
        : `Cashback is capped at ${CONFIG.PER_PAYMENT_CAP_SOL} SOL per payment and ${CONFIG.PER_DAY_CAP_SOL} SOL per clipper per day.`;
    box.classList.toggle('is-capped', cb === cap);
    if (!reducedMotion()) box.querySelectorAll<HTMLElement>('.wire i').forEach((w) => w.animate([{ backgroundPosition: '0 0' }, { backgroundPosition: '48px 0' }], { duration: 500, easing: 'ease-out' }));
  };
  inp.addEventListener('input', () => { rng.value = inp.value; update(inp.value); });
  rng.addEventListener('input', () => { inp.value = rng.value; update(rng.value); });
  update(inp.value);
}
