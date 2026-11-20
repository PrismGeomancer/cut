import { icon } from '../ui/icons';
import { CONFIG } from '../config';
import { $, html, mount } from '../ui/dom';
import { toast } from '../ui/toast';
import { cashbackLamports, lamportsToSolString, parseSol } from '../lib/fees';
import { isPublicKey, parsePayLink } from '../lib/payLink';
import { clipIdFromUrl, normaliseClipUrl, buildMemo } from '../lib/memo';
import { connect, hasWallet, onWallet, walletKey } from '../lib/wallet';
import { signAndSend, solscanTx } from '../lib/payment';
import { shortAddr } from '../lib/format';
import { PREVIEW } from '../preview';

export function render(root: HTMLElement, params: URLSearchParams) {
  mount(root, html`<header class="page-head"><h1><span class="h-ico">${icon('send', 26)}</span>Pay a clipper</h1><p>Pay a clip. Get paid for one. Every payment leaves a public receipt.</p></header><section data-pay style="padding:28px 0 56px"></section>`);
  return paySection($('[data-pay]', root)!, params);
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Cashback the clipper could get for this price, using the same integer math as the payout. */
export function cashbackFor(lamports: number) {
  if (lamports < Math.round(CONFIG.MIN_PRICE_SOL * 1e9)) return 0;
  return cashbackLamports(lamports, CONFIG.CASHBACK_BPS, Math.round(CONFIG.PER_PAYMENT_CAP_SOL * 1e9));
}

/** Shared by #/pay?to=&clip=&price= and the Earn tab. Shows exactly what will be sent before any signature. */
export function paySection(el: HTMLElement, params: URLSearchParams) {
  const link = parsePayLink(params);
  const pre = { to: params.get('to') ?? '', clip: params.get('clip') ?? '', price: params.get('price') ?? '' };
  const fromLink = link.ok;
  const invalid = !link.ok && (pre.to || pre.clip || pre.price) ? link.errors : [];
  mount(el, html`<div class="payx">
    <form class="payx__form" novalidate data-form>
      ${fromLink ? html`<p class="payx__from">${icon('link', 16)}This pay link was made by the clipper. Check the details, then sign.</p>` : ''}
      <label class="field field--big"><span>Clipper wallet</span><input class="input mono" name="to" autocomplete="off" spellcheck="false" value="${pre.to}" aria-invalid="${String(invalid.includes('to'))}" aria-describedby="h-to" required><small id="h-to" class="hint" data-h="to">The Solana address that receives the clip price.</small></label>
      <label class="field field--big"><span>Clip link</span><input class="input" name="clip" type="url" inputmode="url" value="${pre.clip}" aria-invalid="${String(invalid.includes('clip'))}" aria-describedby="h-clip" required><small id="h-clip" class="hint" data-h="clip">The https link to the clip you're paying for.</small></label>
      <label class="field field--big"><span>Price (SOL)</span><span class="money-in"><input class="input num" name="price" inputmode="decimal" value="${pre.price}" aria-invalid="${String(invalid.includes('price'))}" aria-describedby="h-price" required><em>SOL</em></span><small id="h-price" class="hint" data-h="price">You set the price. Nothing is added on top except the network fee.</small></label>
      <div class="payx__wallet" data-wallet-row></div>
      <div class="payx__go"><button class="btn btn--cut btn--lg" type="submit" data-sign>${icon('send', 16)}Sign and pay</button><p class="fine" data-why role="status"></p></div>
      <div data-after></div>
    </form>
    <aside class="txcard" aria-live="polite">
      <div class="txcard__head"><span>${icon('receipt', 16)}Transaction preview</span><span class="txcard__net">Solana mainnet</span></div>
      <div class="txcard__amount"><span>Clipper receives</span><b class="num" data-t-price>0</b><em>SOL</em></div>
      <ol class="txcard__ix">
        <li><span class="txcard__n">1</span><div><b>Transfer</b><span><b class="num" data-t-price2>0</b> SOL to <span class="mono" data-t-to>clipper wallet</span></span><span class="fine">Carries CUT's public reference key, read only, so the payment can be found later.</span></div></li>
        <li><span class="txcard__n">2</span><div><b>Memo</b><span class="mono" data-t-memo>cut:v1:…</span><span class="fine">Names the clip. The id is the first 12 characters of the link's SHA-256.</span></div></li>
      </ol>
      <dl class="txcard__sum">
        <div><dt>You pay</dt><dd><b class="num" data-t-pay>0</b> SOL plus the network fee</dd></div>
        <div class="txcard__cb"><dt>CUT can pay the clipper a 3.5% cashback (see Rules)</dt><dd><b class="num" data-t-cb>0</b> SOL</dd></div>
      </dl>
      <p class="txcard__foot">Every payment and every cashback is a public transaction.</p>
    </aside>
  </div>`);

  const form = $<HTMLFormElement>('[data-form]', el)!, btn = $<HTMLButtonElement>('[data-sign]', el)!, why = $('[data-why]', el)!;
  const set = (sel: string, v: string) => el.querySelectorAll(sel).forEach((e) => { e.textContent = v; });
  const read = () => {
    const f = new FormData(form);
    return { to: String(f.get('to')).trim(), clip: String(f.get('clip')).trim(), price: String(f.get('price')).trim() };
  };
  const paintWallet = () => {
    const w = walletKey();
    mount($('[data-wallet-row]', el)!, w
      ? html`<span class="payx__wok">${icon('wallet', 16)}Paying from <span class="mono">${shortAddr(w)}</span></span>`
      : html`<span class="payx__wno">${icon('wallet', 16)}No wallet connected</span><button class="btn btn--sm" type="button" data-connect>Connect wallet</button>`);
    $('[data-connect]', el)?.addEventListener('click', async () => {
      if (!hasWallet()) { toast('Connect a wallet to continue.'); return; }
      try { if (await connect()) toast('Wallet connected.'); } catch { toast('Signature cancelled. Nothing was sent.'); }
    });
  };
  const paint = async () => {
    const v = read();
    const lamports = parseSol(v.price);
    const okTo = isPublicKey(v.to), okClip = !!normaliseClipUrl(v.clip), okPrice = !!lamports && lamports > 0;
    const ok = okTo && okClip && okPrice;
    const clipId = okClip ? await clipIdFromUrl(v.clip) : null;
    const price = lamports ? lamportsToSolString(lamports) : '0';
    set('[data-t-price], [data-t-price2], [data-t-pay]', price);
    set('[data-t-cb]', lamportsToSolString(lamports ? cashbackFor(lamports) : 0));
    set('[data-t-to]', okTo ? shortAddr(v.to) : 'clipper wallet');
    set('[data-t-memo]', clipId ? buildMemo(clipId) : 'cut:v1:…');
    const hints: Record<string, [boolean, string, string]> = {
      to: [okTo || !v.to, 'The Solana address that receives the clip price.', "That isn't a Solana address. Paste the clipper's wallet."],
      clip: [okClip || !v.clip, host(v.clip) ? `Clip on ${host(v.clip)}.` : "The https link to the clip you're paying for.", 'Use the https link to the clip.'],
      price: [okPrice || !v.price, 'You set the price. Nothing is added on top except the network fee.', 'Enter a price above 0, like 0.25.'],
    };
    for (const [k, [good, okText, badText]] of Object.entries(hints)) {
      const h = $(`[data-h="${k}"]`, el)!;
      h.textContent = good ? okText : badText;
      h.classList.toggle('is-bad', !good);
      form.querySelector(`[name=${k}]`)!.setAttribute('aria-invalid', String(!good));
    }
    let reason = '';
    if (PREVIEW) reason = 'Payments are off.';
    else if (!CONFIG.REFERENCE_KEY) reason = 'Payments open when CUT is configured.';
    else if (!walletKey()) reason = 'Connect a wallet first.';
    btn.disabled = !!reason || !ok;
    why.textContent = reason;
    el.querySelector('.txcard')!.classList.toggle('is-ready', ok);
    return ok;
  };
  form.addEventListener('input', () => { paint(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!(await paint()) || !CONFIG.REFERENCE_KEY || PREVIEW) return;
    const v = read();
    if (!walletKey()) {
      if (!hasWallet()) { toast('Connect a wallet to continue.'); return; }
      try { await connect(); } catch { toast('Signature cancelled. Nothing was sent.'); return; }
    }
    btn.disabled = true;
    try {
      const sig = await signAndSend(walletKey()!, v.to, parseSol(v.price)!, v.clip);
      toast('Payment sent. Receipt below.');
      mount($('[data-after]', el)!, html`<p class="payx__done">${icon('check', 16)}Payment sent. <a href="${solscanTx(sig)}" target="_blank" rel="noopener">View receipt.</a></p>`);
    } catch (err: any) {
      const cancelled = /reject|cancel|denied/i.test(String(err?.message ?? err));
      toast(cancelled ? 'Signature cancelled. Nothing was sent.' : 'Payment failed. Nothing was sent.');
    } finally { paint(); }
  });
  const off = onWallet(() => { paintWallet(); paint(); });
  paintWallet(); paint();
  return () => { off(); };
}
