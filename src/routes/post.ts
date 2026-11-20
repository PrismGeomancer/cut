import { icon } from '../ui/icons';
import { $, html, mount } from '../ui/dom';
import { empty } from '../ui/empty';
import { toast } from '../ui/toast';
import { currentSession, logout } from '../lib/tiktokSession';
import { getJSON, setJSON, listClips, getClip, type StoredClip } from '../lib/storage';
import { loginUrl, paintTikTok } from '../ui/nav';
import { PREVIEW } from '../preview';

export interface QueueItem { id: string; clipId: string; clipName: string; caption: string; hashtags: string; at: number; posted?: boolean }
const QKEY = 'post:queue';
const HOUR = 3600_000;
const previewQueue = (): QueueItem[] => [
  ['clip-nightowl', 'the 1v5 nobody believed in via nightowl_vex', '#clips #streamer', -2 * HOUR, false],
  ['clip-marlow', 'he read chat out loud. mistake. via MarlowPlays', '#justchatting', 3 * HOUR, false],
  ['clip-kiri', 'one frame from disaster via kiri_codes', '#gaming #clips', 26 * HOUR, false],
  ['clip-brass', 'speechless for 9 full seconds via BrassMonkeyTV', '#fyp #stream', 74 * HOUR, false],
  ['clip-luma', 'chat called it 10 seconds early via luma_lark', '#clips', -30 * HOUR, true],
].map(([clipId, caption, hashtags, dt, posted], i) => ({ id: `p${i}`, clipId: clipId as string, clipName: clipId as string, caption: caption as string, hashtags: hashtags as string, at: Date.now() + (dt as number), posted: posted as boolean }));
export const queue = () => { const q = getJSON<QueueItem[]>(QKEY, []); return PREVIEW && !q.length && !getJSON('post:preview-cleared', false) ? previewQueue() : q; };
const saveQueue = (q: QueueItem[]) => { if (PREVIEW && !q.length) setJSON('post:preview-cleared', true); return setJSON(QKEY, q); };

const timers: number[] = [];
function schedule() {
  timers.splice(0).forEach(clearTimeout);
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const q of queue()) {
    const ms = q.at - Date.now();
    if (!q.posted && ms > 0 && ms < 2 ** 31 - 1) timers.push(window.setTimeout(() => new Notification('CUT', { body: `Time to post: ${q.caption}`, icon: './brand/favicon-64.png' }), ms));
  }
}

const fmt = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function render(root: HTMLElement) {
  const paint = async () => {
    const s = currentSession();
    const clips: StoredClip[] = await listClips().catch(() => []);
    const q = queue().sort((a, b) => a.at - b.at);
    const due = q.filter((x) => !x.posted && x.at <= Date.now());
    const canNotify = typeof Notification !== 'undefined';
    const perm = canNotify ? Notification.permission : 'denied';
    const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const days = Array.from({ length: 14 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

    mount(root, html`
      <header class="page-head"><h1><span class="h-ico">${icon('post', 26)}</span>Post</h1><p>Queue your clips. CUT reminds you when one is due.</p></header>
      <div class="split">
        <section>
          ${due.length ? html`<div class="summary" role="status" style="margin-bottom:20px">${due.map((d) => html`<div><span>Time to post: ${d.caption}</span><b>${fmt(d.at)}</b></div>`)}</div>` : ''}
          <div class="cal" aria-label="Next two weeks">
            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => html`<div class="h">${d}</div>`)}
            ${days.map((d) => {
              const n = q.filter((x) => new Date(x.at).toDateString() === d.toDateString());
              return html`<div class="${d.toDateString() === now.toDateString() ? 'is-today' : ''}"><span class="n">${d.getDate()}</span><span class="q">${n.map((x) => html`<i title="${x.caption}" style="${x.posted ? 'background:var(--faint)' : ''}"></i>`)}</span><span class="sr-only">${n.length} queued</span></div>`;
            })}
          </div>
          <h2 style="font-size:20px;margin:28px 0 12px">Queue</h2>
          ${q.length ? html`<ol class="rows">${q.map((x) => html`<li class="row" style="grid-template-columns:minmax(0,1fr) auto">
            <div class="row__main"><span class="row__title">${x.caption || x.clipName}</span><span class="row__sub"><span class="num">${fmt(x.at)}</span><span>${x.hashtags}</span><span>${x.posted ? 'Posted' : ''}</span></span></div>
            <div class="row__act" style="flex-wrap:wrap">
              <a class="btn btn--sm" href="https://www.tiktok.com/upload" target="_blank" rel="noopener">${icon('upload', 14)}Open TikTok upload</a>
              <button class="btn btn--ghost btn--sm" type="button" data-dl="${x.clipId}">${icon('download', 14)}Download</button>
              ${x.posted ? '' : html`<button class="btn btn--ghost btn--sm" type="button" data-posted="${x.id}">${icon('check', 14)}Mark posted</button>`}
              <button class="btn btn--ghost btn--sm" type="button" data-remove="${x.id}">${icon('trash', 14)}Remove</button></div></li>`)}</ol>`
            : empty('Nothing queued. Export a clip in Cut first.')}
          <p class="fine" style="margin-top:20px">CUT reminds you at the time you set. Publishing happens in TikTok.</p>
        </section>
        <aside>
          ${s ? html`<p style="margin-bottom:16px">Logged in as ${s.display_name} <button class="linkbtn" type="button" data-logout>Log out</button></p>`
            : html`<p style="margin-bottom:12px">Log in with TikTok to queue clips.</p>${loginUrl() ? html`<a class="btn btn--cut" href="${loginUrl()}">Log in with TikTok</a>` : ''}`}
          <form class="formgrid" data-form style="margin-top:20px" ${s ? '' : 'inert aria-disabled="true"'}>
            <label class="field"><span>Clip</span><select class="input" name="clip" required>${clips.length ? clips.map((c) => html`<option value="${c.id}">${c.name}</option>`) : html`<option value="">Nothing queued. Export a clip in Cut first.</option>`}</select></label>
            <label class="field"><span>Caption</span><textarea class="input" name="caption" rows="3" maxlength="2200" required></textarea></label>
            <label class="field"><span>Hashtags</span><input class="input" name="hashtags" autocomplete="off"></label>
            <label class="field"><span>Time</span><input class="input" name="at" type="datetime-local" required></label>
            <div><button class="btn ${s ? 'btn--cut' : ''}" type="submit" ${s && clips.length ? '' : 'disabled'}>${icon('post', 16)}Queue it</button></div>
          </form>
          ${canNotify && perm !== 'granted' ? html`<button class="btn btn--ghost btn--sm" type="button" data-notify style="margin-top:20px;white-space:normal;height:auto;padding:8px 12px;text-align:left">${icon('bell', 16)}Allow reminders so CUT can tell you when a clip is due.</button>` : ''}
        </aside>
      </div>`);

    $('[data-logout]', root)?.addEventListener('click', () => { logout(); paintTikTok(); paint(); });
    $('[data-notify]', root)?.addEventListener('click', async () => { await Notification.requestPermission(); schedule(); paint(); });
    $<HTMLFormElement>('[data-form]', root)?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const clip = clips.find((c) => c.id === f.get('clip'));
      const at = Date.parse(String(f.get('at')));
      if (!clip || !isFinite(at)) return;
      const credit = clip.credit ? ` via ${clip.credit}` : '';
      const caption = String(f.get('caption')).trim();
      saveQueue([...queue(), { id: crypto.randomUUID(), clipId: clip.id, clipName: clip.name, caption: caption.endsWith(credit) || !credit ? caption : caption + credit, hashtags: String(f.get('hashtags')).trim(), at }]);
      toast('Clip queued.'); schedule(); paint();
    });
    root.querySelectorAll<HTMLElement>('[data-posted]').forEach((b) => b.addEventListener('click', () => { saveQueue(queue().map((x) => (x.id === b.dataset.posted ? { ...x, posted: true } : x))); paint(); }));
    root.querySelectorAll<HTMLElement>('[data-remove]').forEach((b) => b.addEventListener('click', () => { saveQueue(queue().filter((x) => x.id !== b.dataset.remove)); paint(); }));
    root.querySelectorAll<HTMLElement>('[data-dl]').forEach((b) => b.addEventListener('click', async () => {
      const c = await getClip(b.dataset.dl!);
      if (!c) return;
      const url = URL.createObjectURL(c.blob);
      Object.assign(document.createElement('a'), { href: url, download: `${c.name}.mp4` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }));
  };
  schedule();
  await paint();
}
