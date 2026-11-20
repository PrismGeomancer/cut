import { icon } from '../ui/icons';
import { $, html, mount } from '../ui/dom';
import { empty, EMPTY_LIST } from '../ui/empty';
import { clipCard, shortCard, tiktokCard } from '../ui/parts';
import { loadFeed, addLink, tiktokId, type FeedItem } from '../lib/feed';
import { loadClips, clipsOf, type Clip } from '../lib/clips';
import { loadShorts, shortsOf, type Short } from '../lib/shorts';

type Tab = 'all' | 'tiktok' | 'twitch' | 'shorts';
const LABEL: Record<Tab, string> = { all: 'All', tiktok: 'TikTok', twitch: 'Twitch clips', shorts: 'Shorts' };

export async function render(root: HTMLElement) {
  let tab: Tab = 'all';
  mount(root, html`
    <header class="page-head"><h1><span class="h-ico">${icon('feed', 26)}</span>Feed</h1><p>Clips from clippers and the platforms they post on.</p></header>
    <form class="toolbar" data-add style="margin-top:24px" novalidate>
      <label class="sr-only" for="tt-url">TikTok link</label>
      <input class="input" id="tt-url" type="url" inputmode="url" placeholder="Paste a TikTok link" autocomplete="off" required style="max-width:420px">
      <button class="btn" type="submit">${icon('plus', 16)}Add</button>
      <span class="fine" data-help>Videos play from TikTok. CUT doesn't host them.</span>
    </form>
    <div class="tabs" role="tablist" aria-label="Feed">${(Object.keys(LABEL) as Tab[]).map((t) => html`<button role="tab" type="button" aria-selected="${String(t === tab)}" data-tab="${t}">${icon(({ all: 'feed', tiktok: 'play', twitch: 'film', shorts: 'play' } as const)[t], 16)}${LABEL[t]}</button>`)}</div>
    <section role="tabpanel" data-panel></section>`);

  let feed: FeedItem[] = await loadFeed();
  const [c, s] = await Promise.all([loadClips(), loadShorts()]);
  const clips: Clip[] = c.state === 'ok' || c.state === 'snapshot' ? clipsOf(c.data) : [];
  const shorts: Short[] = s.state === 'ok' || s.state === 'snapshot' ? shortsOf(s.data) : [];
  const panel = $('[data-panel]', root)!;

  const paint = () => {
    const tt = feed.length ? html`<div class="grid916 grid916--tt">${feed.map(tiktokCard)}</div>` : empty('No TikToks yet. Paste the first link.', 'empty--tall');
    const tw = clips.length ? html`<div class="grid169">${clips.map(clipCard)}</div>` : empty(EMPTY_LIST, 'empty--tall');
    const sh = shorts.length ? html`<div class="grid916">${shorts.map(shortCard)}</div>` : empty(EMPTY_LIST, 'empty--tall');
    if (tab === 'tiktok') mount(panel, tt);
    else if (tab === 'twitch') mount(panel, tw);
    else if (tab === 'shorts') mount(panel, sh);
    else mount(panel, html`
      <h2 style="font-size:20px;margin-bottom:16px">TikTok</h2>${tt}
      <h2 style="font-size:20px;margin:32px 0 16px">Twitch clips</h2>${tw}
      <h2 style="font-size:20px;margin:32px 0 16px">Shorts</h2>${sh}`);
  };
  paint();

  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab as Tab;
    root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    paint();
  }));

  const form = $<HTMLFormElement>('[data-add]', root)!, input = $<HTMLInputElement>('#tt-url', root)!, help = $('[data-help]', root)!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!tiktokId(input.value)) {
      input.setAttribute('aria-invalid', 'true');
      help.textContent = "That link didn't resolve. Check it's a public TikTok video.";
      return;
    }
    input.removeAttribute('aria-invalid');
    const item = await addLink(input.value);
    if (!item) { help.textContent = "That link didn't resolve. Check it's a public TikTok video."; return; }
    help.textContent = 'Saved in this browser.';
    input.value = '';
    feed = await loadFeed();
    paint();
  });
}
