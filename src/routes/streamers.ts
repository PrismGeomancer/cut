import { icon } from '../ui/icons';
import { $, html, mount, safeUrl, reducedMotion, type SafeHtml } from '../ui/dom';
import { empty, staleLine, EMPTY_LIST, ERROR_LIST } from '../ui/empty';
import { img, avatar } from '../ui/img';
import { badge, callRow, clipRow, pipeline, setStatus, statusOf, statusIcon, STATUSES, PIPE, type ContactStatus } from '../ui/parts';
import { compact, int, languageName, liveFor, timecode } from '../lib/format';
import { loadLive, loadStreamers, streamsOf, thumbAt, aboutUrl, PLATFORM_NAME, PLATFORM_VAR, type Stream, type StreamerInfo, type PlatformFilter } from '../lib/live';
import { loadClips, clipsOf, type Clip } from '../lib/clips';
import { loadLocal } from '../lib/data';
import { pitch } from '../lib/pitch';
import { toCsv, downloadText } from '../lib/csv';
import { toast, copy } from '../ui/toast';
import { openModal } from '../ui/modal';

interface Contact { platform: string; id?: string; name?: string; links: { label: string; url: string }[] }
type Sort = 'viewers' | 'new' | 'name';
const PAGE = 40;

export async function render(root: HTMLElement) {
  mount(root, html`
    <header class="page-head page-head--split">
      <div><h1><span class="h-ico">${icon('users', 26)}</span>Streamers</h1><p>Streamers worth a message. Open their page, send the pitch, track the answer.</p></div>
      <ul class="headstats" data-stats aria-label="The list right now"></ul>
    </header>
    <div class="cast">
      <section class="cast__list" aria-label="Pitch list" data-list><p class="fine">Loading the live list.</p></section>
      <aside class="cast__inspector" aria-label="Selected streamer" data-side></aside>
    </div>`);

  const [live, streamers, clips, contacts, partnersRaw] = await Promise.all([
    loadLive(), loadStreamers(), loadClips(),
    loadLocal<Contact[]>('contacts.json', []), loadLocal<{ platform: string; id: string }[]>('partners.json', []),
  ]);
  const info = new Map<string, StreamerInfo>();
  if (streamers.state === 'ok' || streamers.state === 'snapshot') for (const s of Array.isArray(streamers.data) ? streamers.data : streamers.data.streamers ?? []) info.set(`${s.platform}:${s.id}`, s);
  const partners = new Set(partnersRaw.map((p) => `${p.platform}:${p.id}`));
  const allClips: Clip[] = clips.state === 'ok' || clips.state === 'snapshot' ? clipsOf(clips.data) : [];
  const all = streamsOf(live).slice().sort((a, b) => b.viewers - a.viewers);
  const listEl = $('[data-list]', root)!, side = $('[data-side]', root)!, statsEl = $('[data-stats]', root)!;

  if (!all.length) {
    mount(listEl, live.state === 'error' ? empty(ERROR_LIST, 'empty--tall') : empty(EMPTY_LIST, 'empty--tall'));
    side.remove();
    return;
  }

  let q = '', platform: PlatformFilter = 'all', status: ContactStatus | 'all' = 'all', sort: Sort = 'viewers', limit = PAGE;
  let selected = `${all[0].platform}:${all[0].id}`;
  const key = (s: Stream) => `${s.platform}:${s.id}`;
  const contactFor = (s: Stream) => contacts.find((c) => c.platform === s.platform && (c.id === s.id || c.name?.toLowerCase() === s.name.toLowerCase()));

  const stats = () => {
    const touched = all.filter((s) => statusOf(key(s)) !== 'Not contacted').length;
    const agreed = all.filter((s) => statusOf(key(s)) === 'Agreed').length;
    const partnersN = all.filter((s) => info.get(key(s))?.broadcasterType === 'partner').length;
    mount(statsEl, html`
      <li><b class="num">${int(all.length)}</b><span>live now</span></li>
      <li><b class="num">${compact(all.reduce((a, s) => a + s.viewers, 0))}</b><span>watching</span></li>
      <li><b class="num">${int(partnersN)}</b><span>Twitch Partners</span></li>
      <li><b class="num">${int(touched)}</b><span>contacted</span></li>
      <li class="${agreed ? 'is-on' : ''}"><b class="num">${int(agreed)}</b><span>agreed</span></li>`);
  };

  const filtered = () => {
    const needle = q.trim().toLowerCase();
    return all.filter((s) => (platform === 'all' || s.platform === platform)
      && (status === 'all' || statusOf(key(s)) === status)
      && (!needle || s.name.toLowerCase().includes(needle) || s.title.toLowerCase().includes(needle) || (s.game ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => sort === 'viewers' ? b.viewers - a.viewers : sort === 'new' ? Date.parse(b.startedAt) - Date.parse(a.startedAt) : a.name.localeCompare(b.name));
  };

  const drawList = () => {
    const rows = filtered();
    const shown = rows.slice(0, limit);
    mount(listEl, html`
      ${staleLine(live)}
      ${pipeline(all, status)}
      <div class="toolbar cast__tools">
        <span class="searchbox">${icon('search', 16)}<label class="sr-only" for="st-q">Search streamers</label><input class="input" id="st-q" type="search" placeholder="Search streamers or titles" value="${q}" autocomplete="off"></span>
        <div class="seg" role="group" aria-label="Platform">${(['all', 'twitch', 'kick'] as const).map((p) => html`<button type="button" data-p="${p}" aria-pressed="${String(p === platform)}">${p === 'all' ? 'All' : PLATFORM_NAME[p]}</button>`)}</div>
        <label class="sr-only" for="st-sort">Sort</label>
        <select class="input input--auto" id="st-sort">${([['viewers', 'Most watched'], ['new', 'Newest'], ['name', 'Name']] as const).map(([v, l]) => html`<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`)}</select>
        <button class="btn btn--sm" type="button" data-csv>${icon('download', 14)}Export CSV</button>
      </div>
      <p class="cast__count fine" role="status">${rows.length === all.length ? `${int(all.length)} streamers` : `${int(rows.length)} of ${int(all.length)} streamers`}${status !== 'all' ? ` marked ${status.toLowerCase()}` : ''}</p>
      ${shown.length ? html`<ol class="calls calls--page">${shown.map((s, n) => callRow(s, n, rows[0].viewers, info.get(key(s)), partners.has(key(s)), { open: true, selected: key(s) === selected }))}</ol>`
        : empty(status === 'all' ? EMPTY_LIST : `No streamers marked ${status.toLowerCase()} yet.`)}
      ${rows.length > limit ? html`<button class="btn cast__more" type="button" data-more>${icon('plus', 14)}Show ${Math.min(PAGE, rows.length - limit)} more</button>` : ''}
      <p class="fine cast__foot">Statuses are saved in this browser. A streamer shows as a CUT partner only when they are in partners.json.${partners.size ? '' : ' No partners yet.'}</p>`);

    const input = $<HTMLInputElement>('#st-q', listEl)!;
    input.addEventListener('input', () => { q = input.value; limit = PAGE; const pos = input.selectionStart; drawList(); const i2 = $<HTMLInputElement>('#st-q', listEl)!; i2.focus(); i2.setSelectionRange(pos, pos); });
    listEl.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => { platform = b.dataset.p as PlatformFilter; limit = PAGE; drawList(); }));
    listEl.querySelectorAll<HTMLButtonElement>('[data-pipe]').forEach((b) => b.addEventListener('click', () => { status = status === b.dataset.pipe ? 'all' : (b.dataset.pipe as ContactStatus); limit = PAGE; drawList(); }));
    $<HTMLSelectElement>('#st-sort', listEl)!.addEventListener('change', (e) => { sort = (e.target as HTMLSelectElement).value as Sort; drawList(); });
    $('[data-more]', listEl)?.addEventListener('click', () => { limit += PAGE; drawList(); });
    $('[data-csv]', listEl)!.addEventListener('click', () => {
      downloadText('cut-streamers.csv', toCsv(filtered(), [
        { header: 'Streamer', get: (s) => s.name }, { header: 'Platform', get: (s) => PLATFORM_NAME[s.platform] },
        { header: 'Game', get: (s) => s.game ?? '' }, { header: 'Viewers', get: (s) => s.viewers }, { header: 'Language', get: (s) => s.language },
        { header: 'About page', get: (s) => (s.generated ? '' : aboutUrl(s)) }, { header: 'Status', get: (s) => statusOf(key(s)) },
      ]));
      toast('CSV exported.');
    });
  };

  const inspector = (s: Stream): SafeHtml => {
    const k = key(s), i = info.get(k), c = contactFor(s), st = statusOf(k);
    const theirs = allClips.filter((x) => x.broadcaster.toLowerCase() === s.name.toLowerCase()).sort((a, b) => b.views - a.views).slice(0, 4);
    const secs = Math.max(0, (Date.now() - Date.parse(s.startedAt)) / 1000);
    return html`
      <div class="insp">
        <div class="insp__monitor sel sel--on">
          ${img(thumbAt(s.thumbnail, 880, 496), 880, 496, PLATFORM_NAME[s.platform], { eager: true })}
          <span class="burn burn--tc" aria-hidden="true">${timecode(secs)}</span>
          <span class="burn burn--views" aria-hidden="true">${icon('eye', 13)}${compact(s.viewers)}</span>
        </div>
        <div class="insp__id">
          ${avatar(i?.avatar || s.avatar, s.name, 52)}
          <div><h2>${s.name}</h2><div class="insp__badges">${badge(i, partners.has(k))}<span class="plat"><span class="dot" style="--c:${PLATFORM_VAR[s.platform]}" aria-hidden="true"></span>${PLATFORM_NAME[s.platform]}</span></div></div>
        </div>
        <p class="insp__title">${s.title}</p>
        <dl class="insp__facts">
          <div><dt>Watching</dt><dd class="num">${int(s.viewers)}</dd></div>
          <div><dt>Live for</dt><dd>${liveFor(s.startedAt)}</dd></div>
          <div><dt>Game</dt><dd>${(s.game ?? '').replace(/^Grand Theft Auto /, 'GTA ') || PLATFORM_NAME[s.platform]}</dd></div>
          <div><dt>Language</dt><dd>${languageName(i?.language || s.language)}</dd></div>
        </dl>

        <div class="insp__block">
          <h3>Status</h3>
          <ol class="stepper" aria-label="Status for ${s.name}">${STATUSES.map((x, n) => html`<li>
            <button type="button" data-set-status="${x}" aria-pressed="${String(x === st)}" class="${STATUSES.indexOf(st) > n && st !== 'Passed' && x !== 'Passed' ? 'is-done' : ''}">${statusIcon(x)}<span>${PIPE[n].label}</span></button></li>`)}</ol>
        </div>

        <div class="insp__block">
          <h3>Pitch</h3>
          <blockquote class="pitch">${pitch(s.name)}</blockquote>
          <div class="card__a">
            <button class="btn btn--cut btn--sm" type="button" data-copy-pitch>${icon('copy', 14)}Copy pitch</button>
            ${s.generated ? '' : html`<a class="btn btn--ghost btn--sm" href="${aboutUrl({ ...s, login: s.login || i?.login })}" target="_blank" rel="noopener">${icon('user', 14)}Open About page</a>`}
            ${(c?.links ?? []).filter((l) => safeUrl(l.url)).map((l) => html`<a class="btn btn--ghost btn--sm" href="${safeUrl(l.url)}" target="_blank" rel="noopener">${icon('mail', 14)}${l.label}</a>`)}
          </div>
        </div>

        <div class="insp__block">
          <h3>Their top clips</h3>
          ${theirs.length ? html`<ol class="rows rows--mini">${theirs.map((x, n) => clipRow(x, n, theirs[0].views))}</ol>` : empty(EMPTY_LIST)}
        </div>
      </div>`;
  };

  const wideScreen = () => matchMedia('(min-width: 1041px)').matches;
  const drawSide = (animate = false) => {
    const s = all.find((x) => key(x) === selected);
    if (!s) return;
    mount(side, inspector(s));
    if (animate && !reducedMotion()) side.firstElementChild?.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
  };
  const choose = (k: string) => {
    selected = k;
    listEl.querySelectorAll('.call').forEach((li) => li.classList.toggle('is-selected', (li as HTMLElement).dataset.k === k));
    if (wideScreen()) drawSide(true);
    else { const s = all.find((x) => key(x) === k)!; const d = openModal(s.name, inspector(s)); wireSide(d); }
  };
  const wireSide = (host: ParentNode) => {
    host.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const set = t.closest<HTMLElement>('[data-set-status]');
      if (set) {
        const v = set.dataset.setStatus as ContactStatus;
        if (setStatus(selected, v)) toast('Saved in this browser.');
        stats(); drawList();
        if (wideScreen()) drawSide(); else (host as HTMLElement).querySelectorAll<HTMLElement>('[data-set-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setStatus === v)));
        return;
      }
      if (t.closest('[data-copy-pitch]')) { const s = all.find((x) => key(x) === selected)!; copy(pitch(s.name), 'Link copied.'); }
    });
  };

  listEl.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-open]'); if (b) choose(b.dataset.open!); });
  listEl.addEventListener('change', (e) => { if ((e.target as HTMLElement).matches('select[data-status]')) setTimeout(() => { stats(); drawList(); if (wideScreen()) drawSide(); }, 0); });
  wireSide(side);
  stats(); drawList(); if (wideScreen()) drawSide(); else side.hidden = true;
}
