import { icon } from '../ui/icons';
import { CONFIG } from '../config';
import { $, html, mount, reducedMotion, type SafeHtml } from '../ui/dom';
import { empty } from '../ui/empty';
import { copy } from '../ui/toast';
import { lamportsToSolString, parseSol } from '../lib/fees';
import { buildPayLink, isPublicKey } from '../lib/payLink';
import { normaliseClipUrl } from '../lib/memo';
import { loadLedger, ledgerTotals, type Ledger } from '../lib/treasury';
import { hoursLeft, type Status } from '../lib/eligibility';
import { age, int, sol, shortAddr } from '../lib/format';
import { solscanTx, solscanAccount } from '../lib/payment';
import { walletKey } from '../lib/wallet';
import { paySection, cashbackFor } from './pay';

type Tab = 'pay' | 'get' | 'receipts' | 'board' | 'rules';
const LABEL: Record<Tab, string> = { pay: 'Pay a clipper', get: 'Get paid', receipts: 'Receipts', board: 'Leaderboard', rules: 'Rules' };
const ICON: Record<Tab, string> = { pay: 'send', get: 'link', receipts: 'receipt', board: 'trend', rules: 'info' };
const HELP: Record<Tab, string> = {
  pay: 'For streamers. Send the clip price straight to the clipper.',
  get: 'For clippers. Make a link the streamer can pay.',
  receipts: 'Every CUT payment, read from Solana.',
  board: 'Clippers ranked by SOL received.',
  rules: 'How the cashback works, and its limits.',
};

export function render(root: HTMLElement, params: URLSearchParams) {
  let tab: Tab = (Object.keys(LABEL).includes(params.get('tab') ?? '') ? params.get('tab') : 'pay') as Tab;
  mount(root, html`
    <header class="page-head page-head--split">
      <div><h1><span class="h-ico">${icon('coin', 26)}</span>Earn</h1><p>Pay a clip. Get paid for one. Every payment leaves a public receipt.</p></div>
      <ul class="headstats" data-tstats aria-label="The treasury"></ul>
    </header>
    <div class="earntabs" role="tablist" aria-label="Earn">${(Object.keys(LABEL) as Tab[]).map((t) => html`<button role="tab" type="button" id="etab-${t}" aria-selected="${String(t === tab)}" data-tab="${t}">
      <span class="earntabs__ico">${icon(ICON[t], 18)}</span><span class="earntabs__t"><b>${LABEL[t]}</b><span>${HELP[t]}</span></span></button>`)}</div>
    <section role="tabpanel" data-panel class="earnpanel"></section>`);
  const panel = $('[data-panel]', root)!;
  let off: (() => void) | undefined;

  // treasury band (hidden when the treasury isn't configured)
  if (CONFIG.TREASURY_WALLET || CONFIG.REFERENCE_KEY) loadLedger().then((l) => {
    const t = ledgerTotals(l);
    mount($('[data-tstats]', root)!, html`
      ${l.treasury !== null ? html`<li class="is-on"><b class="num">${sol(l.treasury, 2)}</b><span>SOL in the treasury</span></li>` : ''}
      <li><b class="num">${sol(t.paidOut, 2)}</b><span>SOL cashback paid</span></li>
      <li><b class="num">${sol(t.waiting, 3)}</b><span>SOL waiting</span></li>
      <li><b class="num">${int(l.receipts.length)}</b><span>payments verified</span></li>
      ${t.empty ? html`<li><b>Paused</b><span>Cashback is paused. The treasury is empty.</span></li>` : ''}`);
  });

  const paint = (animate = false) => {
    off?.(); off = undefined;
    panel.setAttribute('aria-labelledby', `etab-${tab}`);
    if (tab === 'pay') off = paySection(panel, new URLSearchParams());
    else if (tab === 'get') getPaid(panel);
    else if (tab === 'receipts') receipts(panel);
    else if (tab === 'board') board(panel);
    else rules(panel);
    if (animate && !reducedMotion()) panel.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
  };
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab as Tab;
    root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    history.replaceState(null, '', `#/earn?tab=${tab}`);
    paint(true);
  }));
  paint();
  return () => off?.();
}

// ── Get paid ────────────────────────────────────────────────
function getPaid(el: HTMLElement) {
  mount(el, html`<div class="payx">
    <form class="payx__form" novalidate data-form>
      <label class="field field--big"><span>Your wallet</span><input class="input mono" name="to" autocomplete="off" spellcheck="false" value="${walletKey() ?? ''}" required><small class="hint" data-h="to">Where the streamer's payment goes.</small></label>
      <label class="field field--big"><span>Clip link</span><input class="input" name="clip" type="url" inputmode="url" required><small class="hint" data-h="clip">The https link to the clip you made.</small></label>
      <label class="field field--big"><span>Price (SOL)</span><span class="money-in"><input class="input num" name="price" inputmode="decimal" required><em>SOL</em></span><small class="hint" data-h="price">The streamer pays this, straight to your wallet.</small></label>
      <div class="payx__go"><button class="btn btn--cut btn--lg" type="submit">${icon('link', 16)}Create pay link</button></div>
    </form>
    <aside class="txcard txcard--link" data-out>
      <div class="txcard__head"><span>${icon('eye', 16)}What the streamer sees</span></div>
      <div class="txcard__amount"><span>Pay this clipper</span><b class="num" data-g-price>0</b><em>SOL</em></div>
      <dl class="txcard__sum">
        <div><dt>For the clip</dt><dd data-g-clip>Paste the clip link</dd></div>
        <div><dt>To wallet</dt><dd class="mono" data-g-to>Your wallet</dd></div>
        <div class="txcard__cb"><dt>Your cashback from CUT</dt><dd><b class="num" data-g-cb>0</b> SOL after ${CONFIG.DELAY_HOURS} h</dd></div>
      </dl>
      <div data-link></div>
    </aside>
  </div>`);
  const form = $<HTMLFormElement>('[data-form]', el)!;
  const read = () => { const f = new FormData(form); return { to: String(f.get('to')).trim(), clip: String(f.get('clip')).trim(), price: String(f.get('price')).trim() }; };
  const preview = () => {
    const v = read(), l = parseSol(v.price) ?? 0;
    $('[data-g-price]', el)!.textContent = lamportsToSolString(l);
    $('[data-g-cb]', el)!.textContent = lamportsToSolString(cashbackFor(l));
    $('[data-g-to]', el)!.textContent = isPublicKey(v.to) ? shortAddr(v.to) : 'Your wallet';
    $('[data-g-clip]', el)!.textContent = normaliseClipUrl(v.clip)?.replace('https://', '') ?? 'Paste the clip link';
  };
  form.addEventListener('input', preview);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = read();
    const bad = { to: !isPublicKey(v.to), clip: !normaliseClipUrl(v.clip), price: !((parseSol(v.price) ?? 0) > 0) };
    const msg = { to: "That isn't a Solana address.", clip: 'Use the https link to the clip.', price: 'Enter a price above 0, like 0.25.' };
    for (const [k, b] of Object.entries(bad)) {
      form.querySelector(`[name=${k}]`)!.setAttribute('aria-invalid', String(b));
      const h = $(`[data-h="${k}"]`, el)!; if (b) { h.textContent = msg[k as keyof typeof msg]; h.classList.add('is-bad'); } else h.classList.remove('is-bad');
    }
    if (bad.to || bad.clip || bad.price) return;
    const link = buildPayLink(location.href.split('#')[0], v.to, v.clip, lamportsToSolString(parseSol(v.price)!));
    mount($('[data-link]', el)!, html`<div class="linkbox"><p>${icon('check', 16)}Pay link ready. Send it to the streamer.</p><p class="addr">${link}</p><button class="btn btn--sm" type="button" data-copy>${icon('copy', 14)}Copy link</button></div>`);
    $('[data-copy]', el)!.addEventListener('click', () => copy(link, 'Link copied.'));
  });
  preview();
}

// ── Receipts ────────────────────────────────────────────────
const STATUS_ICON = {
  waiting: html`<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/><path d="M6 3.5V6l1.8 1.2" fill="none" stroke="currentColor"/></svg>`,
  paid: html`<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="var(--cut)"/><path d="M3.6 6.2l1.6 1.6 3.2-3.3" fill="none" stroke="#fff" stroke-width="1.4"/></svg>`,
  no: html`<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor"/><path d="M3 9l6-6" stroke="currentColor"/></svg>`,
};
function pill(s: Status | undefined, now: number): SafeHtml {
  if (!s) return html``;
  if (s.status === 'paid') return html`<span class="spill spill--paid">${STATUS_ICON.paid}Paid</span>`;
  if (s.status === 'waiting') return html`<span class="spill">${STATUS_ICON.waiting}Waiting (${hoursLeft(s, now)} h check)</span>`;
  return html`<span class="spill spill--no">${STATUS_ICON.no}Not eligible: ${s.reason}</span>`;
}

async function receipts(el: HTMLElement) {
  const lede = 'Read from Solana. Nothing here is typed in by hand.';
  mount(el, html`<p class="muted earnpanel__lede">${lede}</p><div data-body><p class="fine">Reading receipts from Solana.</p></div>`);
  const body = $('[data-body]', el)!;
  if (!CONFIG.REFERENCE_KEY) { mount(body, empty('Payments open when CUT is configured.', 'empty--tall')); return; }
  const l = await loadLedger();
  if (l.error) { mount(body, html`${empty("Couldn't read receipts from the network. Try again.")}<button class="btn btn--sm" type="button" data-retry>Try again</button>`); $('[data-retry]', body)!.addEventListener('click', () => { loadLedger(true); receipts(el); }); return; }
  if (!l.receipts.length) { mount(body, empty('No payments yet. The first receipt will show up here.', 'empty--tall')); return; }
  const now = Math.floor(Date.now() / 1000);
  type F = 'all' | 'paid' | 'waiting' | 'not eligible';
  let f: F = 'all', q = '', limit = 25;
  const count = (k: F) => (k === 'all' ? l.receipts.length : l.receipts.filter((r) => l.statuses.get(r.signature)?.status === k).length);
  const volume = l.receipts.reduce((a, r) => a + r.lamports, 0);
  const draw = () => {
    const needle = q.trim();
    const rows = l.receipts.filter((r) => (f === 'all' || l.statuses.get(r.signature)?.status === f) && (!needle || r.clipId.includes(needle) || r.payer.includes(needle) || r.payee.includes(needle)));
    mount(body, html`
      <ul class="minband">
        <li><b class="num">${int(l.receipts.length)}</b><span>payments</span></li>
        <li><b class="num">${sol(volume, 2)}</b><span>SOL paid to clippers</span></li>
        <li class="is-on"><b class="num">${sol(l.payouts.reduce((a, p) => a + p.lamports, 0), 3)}</b><span>SOL cashback paid</span></li>
        <li><b class="num">${sol(ledgerTotals(l).waiting, 3)}</b><span>SOL waiting</span></li>
      </ul>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Status">${(['all', 'paid', 'waiting', 'not eligible'] as F[]).map((k) => html`<button type="button" data-f="${k}" aria-pressed="${String(k === f)}">${k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)} <span class="seg__n num">${count(k)}</span></button>`)}</div>
        <span class="searchbox">${icon('search', 16)}<label class="sr-only" for="rc-q">Search by wallet or clip id</label><input class="input" id="rc-q" type="search" placeholder="Wallet or clip id" value="${q}" autocomplete="off" spellcheck="false"></span>
      </div>
      ${rows.length ? html`<div class="tablewrap"><table class="data data--receipts"><thead><tr><th scope="col">Time</th><th scope="col">Clip</th><th scope="col">Streamer</th><th scope="col">Clipper</th><th scope="col" class="num">Price</th><th scope="col" class="num">Cashback</th><th scope="col">Status</th><th scope="col">Receipt</th></tr></thead>
        <tbody>${rows.slice(0, limit).map((r) => {
          const s = l.statuses.get(r.signature);
          return html`<tr><td class="tnum"><b>${new Date(r.blockTime * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b> <span class="muted">${new Date(r.blockTime * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></td>
            <td class="mono">${r.clipId}</td>
            <td><a class="mono" href="${solscanAccount(r.payer)}" target="_blank" rel="noopener">${shortAddr(r.payer)}</a></td>
            <td><a class="mono" href="${solscanAccount(r.payee)}" target="_blank" rel="noopener">${shortAddr(r.payee)}</a></td>
            <td class="num"><b>${sol(r.lamports, 4)}</b> SOL</td>
            <td class="num">${s && s.lamports ? html`<b class="cbnum">${sol(s.lamports, 5)}</b> SOL` : html`<span class="muted">0</span>`}</td>
            <td>${pill(s, now)}</td>
            <td><div class="card__a"><a class="textlink" href="${solscanTx(r.signature)}" target="_blank" rel="noopener">Receipt<span class="sr-only"> for ${r.clipId}</span></a>${s?.status === 'paid' ? html`<a class="textlink" href="${solscanTx(s.payoutSig)}" target="_blank" rel="noopener">Cashback</a>` : ''}</div></td></tr>`;
        })}</tbody></table></div>` : empty('No receipts match.')}
      ${rows.length > limit ? html`<button class="btn cast__more" type="button" data-more>${icon('plus', 14)}Show ${Math.min(25, rows.length - limit)} more</button>` : ''}`);
    body.querySelectorAll<HTMLElement>('[data-f]').forEach((b) => b.addEventListener('click', () => { f = b.dataset.f as F; limit = 25; draw(); }));
    const inp = $<HTMLInputElement>('#rc-q', body)!;
    inp.addEventListener('input', () => { q = inp.value; const p = inp.selectionStart; draw(); const i2 = $<HTMLInputElement>('#rc-q', body)!; i2.focus(); i2.setSelectionRange(p, p); });
    $('[data-more]', body)?.addEventListener('click', () => { limit += 25; draw(); });
  };
  draw();
}

// ── Leaderboard ─────────────────────────────────────────────
function rankRows(l: Ledger) {
  const by = new Map<string, { clips: number; received: number; cashback: number; last: number }>();
  for (const r of l.receipts) {
    const e = by.get(r.payee) ?? { clips: 0, received: 0, cashback: 0, last: 0 };
    e.clips++; e.received += r.lamports; e.last = Math.max(e.last, r.blockTime);
    const s = l.statuses.get(r.signature);
    if (s?.status === 'paid') e.cashback += s.lamports;
    by.set(r.payee, e);
  }
  return [...by.entries()].sort((a, b) => b[1].received - a[1].received);
}

async function board(el: HTMLElement) {
  mount(el, html`<p class="muted earnpanel__lede">Clippers ranked by SOL received through CUT.</p><div data-body><p class="fine">Reading receipts from Solana.</p></div>`);
  const body = $('[data-body]', el)!;
  if (!CONFIG.REFERENCE_KEY) { mount(body, empty('No payments yet. The first clipper will show up here.', 'empty--tall')); return; }
  const l = await loadLedger();
  if (l.error) { mount(body, empty("Couldn't read receipts from the network. Try again.")); return; }
  const rows = rankRows(l);
  if (!rows.length) { mount(body, empty('No payments yet. The first clipper will show up here.', 'empty--tall')); return; }
  const max = rows[0][1].received;
  const [first, second, third] = rows;
  const podium = [second, first, third].filter(Boolean).map((r) => {
    const rank = rows.indexOf(r) + 1;
    return html`<li class="pod pod--${rank}">
      <span class="pod__rank num">${rank}</span>
      <a class="pod__who mono" href="${solscanAccount(r[0])}" target="_blank" rel="noopener">${shortAddr(r[0])}</a>
      <b class="pod__sol num">${sol(r[1].received, 2)}<em>SOL</em></b>
      <dl><div><dt>Clips paid</dt><dd class="num">${r[1].clips}</dd></div><div><dt>Cashback paid</dt><dd class="num">${sol(r[1].cashback, 3)}</dd></div></dl>
      <span class="pod__block" aria-hidden="true"></span>
    </li>`;
  });
  mount(body, html`
    <ol class="podium" aria-label="Top three clippers">${podium}</ol>
    <div class="tablewrap"><table class="data data--board"><thead><tr><th scope="col">#</th><th scope="col">Clipper</th><th scope="col">SOL received</th><th scope="col" class="num">Clips paid</th><th scope="col" class="num">Cashback paid</th><th scope="col">Last paid</th></tr></thead>
      <tbody>${rows.map(([w, e], i) => html`<tr><td class="num muted">${i + 1}</td><td><a class="mono" href="${solscanAccount(w)}" target="_blank" rel="noopener">${shortAddr(w)}</a></td>
        <td><div class="barcell"><span class="barcell__bar"><i style="width:${((e.received / max) * 100).toFixed(1)}%"></i></span><b class="num">${sol(e.received, 3)}</b></div></td>
        <td class="num">${e.clips}</td><td class="num"><span class="cbnum">${sol(e.cashback, 4)}</span></td><td class="muted">${age(e.last * 1000)}</td></tr>`)}</tbody></table></div>`);
}

// ── Rules ───────────────────────────────────────────────────
function rules(el: HTMLElement) {
  const c = CONFIG;
  const caps: [string, string, string][] = [
    ['Cashback', `${c.CASHBACK_BPS / 100}%`, 'of the clip price, paid by CUT'],
    ['Waiting time', `${c.DELAY_HOURS} h`, 'after the payment'],
    ['Minimum price', `${c.MIN_PRICE_SOL} SOL`, 'to earn cashback'],
    ['Per payment', `${c.PER_PAYMENT_CAP_SOL} SOL`, 'most cashback on one payment'],
    ['Per clipper per day', `${c.PER_DAY_CAP_SOL} SOL`, 'most cashback in one UTC day'],
    ['Same pair per day', `${c.PAIR_DAILY_COUNT}`, 'payments from one streamer to one clipper'],
  ];
  const reasons: [string, string][] = [
    ['same wallet', 'The streamer and the clipper are the same wallet.'],
    ['below the minimum', `The price is under ${c.MIN_PRICE_SOL} SOL.`],
    ['already paid', 'This clip already earned cashback on an earlier payment.'],
    ['over the cap', 'The clipper hit the daily cap, or this pair hit its daily count.'],
    ['treasury empty', "The treasury can't cover it right now. Payout pauses until it can."],
    ['blocked', 'One of the wallets is on the blocklist.'],
  ];
  mount(el, html`<div class="rulesx">
    <ol class="rules rules--big">
      <li>The streamer pays the clip price, straight to the clipper's wallet.</li>
      <li>CUT pays the clipper a 3.5% cashback from the treasury, ${c.DELAY_HOURS} hours after the payment.</li>
      <li>Cashback is capped at ${c.PER_PAYMENT_CAP_SOL} SOL per payment, ${c.PER_DAY_CAP_SOL} SOL per clipper per day, and ${c.PAIR_DAILY_COUNT} payments per day for the same streamer and clipper.</li>
      <li>Payments below ${c.MIN_PRICE_SOL} SOL don't earn cashback.</li>
      <li>A wallet paying itself doesn't earn cashback. Neither do blocked wallets.</li>
      <li>Each clip earns cashback once.</li>
      <li>When the treasury is empty, cashback pauses. Clip payments don't.</li>
      <li>A signature approves a payment. It doesn't prove who anyone is.</li>
    </ol>
    <div class="rulesx__side">
      <section><h3>${icon('shield', 16)}The limits</h3><ul class="capgrid">${caps.map(([k, v, d]) => html`<li><span>${k}</span><b class="num">${v}</b><small>${d}</small></li>`)}</ul></section>
      <section><h3>${icon('receipt', 16)}What a receipt can say</h3>
        <ul class="legend2">
          <li>${STATUS_ICON.waiting}<div><b>Waiting</b><span>Checked ${c.DELAY_HOURS} hours after the payment, then paid by the next payout run.</span></div></li>
          <li>${STATUS_ICON.paid}<div><b>Paid</b><span>The cashback went out. The receipt links to the payout.</span></div></li>
          ${reasons.map(([r, d]) => html`<li>${STATUS_ICON.no}<div><b>Not eligible: ${r}</b><span>${d}</span></div></li>`)}
        </ul>
      </section>
      ${c.TREASURY_WALLET ? html`<p class="fine">Treasury wallet <a class="mono" href="${solscanAccount(c.TREASURY_WALLET)}" target="_blank" rel="noopener">${shortAddr(c.TREASURY_WALLET)}</a></p>` : ''}
    </div>
  </div>`);
}
