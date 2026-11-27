import { icon } from '../ui/icons';
import { CONFIG } from '../config';
import { $, html, mount } from '../ui/dom';
import { empty, staleLine, EMPTY_LIST, ERROR_LIST, dot } from '../ui/empty';
import { img } from '../ui/img';
import { clipRow, shortCard, clipThisHref } from '../ui/parts';
import { compact, liveFor, languageName } from '../lib/format';
import { loadLive, streamsOf, thumbAt, PLATFORM_NAME, type Stream, type PlatformFilter } from '../lib/live';
import { loadClips, clipsOf } from '../lib/clips';
import { loadShorts, shortsOf } from '../lib/shorts';
import { safeUrl } from '../ui/dom';

type Tab = 'live' | 'clips' | 'shorts';

export async function render(root: HTMLElement, params: URLSearchParams) {
  let tab: Tab = (['live', 'clips', 'shorts'].includes(params.get('tab') ?? '') ? params.get('tab') : 'live') as Tab;
  const focus = params.get('focus') ?? '';
  let q = '', platform: PlatformFilter = 'all', sort: 'viewers' | 'new' = 'viewers';

  mount(root, html`
    <header class="page-head"><h1><span class="h-ico">${icon('radar', 26)}</span>Radar</h1><p>What's live and what's going round.</p></header>
    <div class="tabs" role="tablist" aria-label="Radar lists">
      ${(['live', 'clips', 'shorts'] as Tab[]).map((t) => html`<button role="tab" type="button" id="tab-${t}" aria-controls="panel" aria-selected="${String(t === tab)}" data-tab="${t}">${icon({ live: 'live', clips: 'film', shorts: 'play' }[t], 16)}${{ live: 'Live now', clips: 'Top clips', shorts: 'Shorts' }[t]}</button>`)}
    </div>
    <div class="toolbar" data-toolbar></div>
    <section id="panel" role="tabpanel" aria-labelledby="tab-${tab}" data-panel></section>`);

  const [live, clips, shorts] = await Promise.all([loadLive(), loadClips(), loadShorts()]);
  const panel = $('[data-panel]', root)!, bar = $('[data-toolbar]', root)!;

  const toolbar = () => {
    mount(bar, html`
      <label class="sr-only" for="radar-q">Search</label><span class="searchbox">${icon('search', 16)}
      <input class="input" id="radar-q" type="search" placeholder="Search streamers or titles" value="${q}" autocomplete="off"></span>
      ${tab === 'live' ? html`<div class="seg" role="group" aria-label="Platform">${(['all', 'twitch', 'kick'] as const).map((p) => html`<button type="button" data-p="${p}" aria-pressed="${String(p === platform)}">${p === 'all' ? 'All' : PLATFORM_NAME[p]}</button>`)}</div>` : ''}
      <div class="seg" role="group" aria-label="Sort">${(['viewers', 'new'] as const).map((s) => html`<button type="button" data-s="${s}" aria-pressed="${String(s === sort)}">${s === 'viewers' ? 'Most watched' : 'Newest'}</button>`)}</div>`);
    const input = $<HTMLInputElement>('#radar-q', bar)!;
    input.addEventListener('input', () => { q = input.value; list(); });
    bar.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => { platform = b.dataset.p as PlatformFilter; toolbar(); list(); }));
    bar.querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) => b.addEventListener('click', () => { sort = b.dataset.s as any; toolbar(); list(); }));
  };

  const match = (...s: string[]) => !q || s.some((x) => x?.toLowerCase().includes(q.toLowerCase()));

  const list = () => {
    if (tab === 'live') {
      let s = streamsOf(live).filter((x) => (platform === 'all' || x.platform === platform) && match(x.name, x.title));
      s = s.sort((a, b) => (sort === 'viewers' ? b.viewers - a.viewers : Date.parse(b.startedAt) - Date.parse(a.startedAt)));
      if (!s.length) return mount(panel, live.state === 'error' ? empty(ERROR_LIST, 'empty--tall') : empty(EMPTY_LIST, 'empty--tall'));
      mount(panel, html`${staleLine(live)}<div class="tablewrap"><table class="data"><thead><tr><th scope="col">Stream</th><th scope="col">Platform</th><th scope="col" class="num">Viewers</th><th scope="col">Language</th><th scope="col">Live for</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${s.map((x) => liveRow(x, `${x.platform}:${x.id}` === focus))}</tbody></table></div>`);
      const f = panel.querySelector<HTMLElement>('.is-focus');
      if (f) { f.scrollIntoView({ block: 'center' }); f.querySelector<HTMLElement>('a,button')?.focus({ preventScroll: true }); }
    } else if (tab === 'clips') {
      let c = clipsOf(clips.state === 'ok' || clips.state === 'snapshot' ? clips.data : []).filter((x) => match(x.title, x.broadcaster, x.creator));
      c = c.sort((a, b) => (sort === 'viewers' ? b.views - a.views : Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      if (!c.length) return mount(panel, clips.state === 'error' ? empty(ERROR_LIST, 'empty--tall') : empty(EMPTY_LIST, 'empty--tall'));
      const max = Math.max(...c.map((x) => x.views));
      mount(panel, html`${staleLine(clips)}<p class="muted" style="margin-bottom:16px">The most watched Twitch clips of the last 24 hours.</p><ol class="rows">${c.map((x, i) => clipRow(x, i, max))}</ol>`);
    } else {
      let s = shortsOf((shorts as any).data).filter((x) => match(x.title, x.channel));
      s = s.sort((a, b) => (sort === 'viewers' ? b.views - a.views : Date.parse(b.publishedAt) - Date.parse(a.publishedAt)));
      const lede = CONFIG.LIVE_CATEGORY ? html`<p class="muted" style="margin-bottom:16px">The most watched YouTube Shorts about the biggest stream right now.</p>` : '';
      if (!s.length) return mount(panel, html`${lede}${shorts.state === 'error' ? empty(ERROR_LIST, 'empty--tall') : empty(EMPTY_LIST, 'empty--tall')}`);
      mount(panel, html`${staleLine(shorts)}${lede}<div class="grid916">${s.map(shortCard)}</div>`);
    }
  };

  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab as Tab;
    root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    panel.setAttribute('aria-labelledby', `tab-${tab}`);
    history.replaceState(null, '', `#/radar?tab=${tab}`);
    toolbar(); list();
  }));
  toolbar(); list();
}

function liveRow(s: Stream, isFocus: boolean) {
  return html`<tr class="${isFocus ? 'is-focus' : ''}">
    <th scope="row"><div class="who-cell" style="min-width:320px">
      <a href="${safeUrl(s.url)}" target="_blank" rel="noopener" style="width:120px;flex:none" aria-label="${s.name} on ${PLATFORM_NAME[s.platform]}">${img(thumbAt(s.thumbnail, 440, 248), 440, 248, PLATFORM_NAME[s.platform])}</a>
      <div style="min-width:0;white-space:normal"><b>${s.name}</b><div class="row__sub" style="max-width:44ch">${s.title}</div></div></div></th>
    <td>${dot(s.platform)}${s.game ? html` <span class="tag">${s.game.replace(/^Grand Theft Auto /, 'GTA ')}</span>` : ''}</td>
    <td class="num">${compact(s.viewers)}</td>
    <td>${languageName(s.language)}</td>
    <td class="num">${liveFor(s.startedAt)}</td>
    <td><div class="card__a"><button class="btn btn--ghost btn--sm" type="button" data-watch="${s.platform}:${s.login || s.name}" data-title="${s.name}" data-url="${safeUrl(s.url)}">${icon('play', 14)}Watch</button><a class="btn btn--sm" href="${clipThisHref(s.name)}">${icon('cut', 14)}Clip this</a></div></td>
  </tr>`;
}
