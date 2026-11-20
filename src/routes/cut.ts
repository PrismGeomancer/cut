import { icon } from '../ui/icons';
import { $, html, mount, type SafeHtml } from '../ui/dom';
import { toast } from '../ui/toast';
import { timecode } from '../lib/format';
import { putClip } from '../lib/storage';
import { monoAudio, envelope, pickPeaks, rmsWindows } from '../editor/loudness';
import { drawCaption, captionPng, type Caption } from '../editor/captions';
import { buildArgs, type Corner, type FrameMode, type Look } from '../editor/export';
import { Timeline } from '../editor/timeline';

type Step = 'source' | 'trim' | 'frame' | 'captions' | 'look' | 'export';
const STEPS: [Step, string][] = [['source', 'Source'], ['trim', 'Trim'], ['frame', 'Frame'], ['captions', 'Captions'], ['look', 'Look'], ['export', 'Export']];
const MB = 1024 * 1024;

export function render(root: HTMLElement, params: URLSearchParams) {
  const source = params.get('source') ?? '';
  let file: File | null = null, url = '';
  let step: Step = 'source';
  let inT = 0, outT = 0, duration = 0, hasAudio = true, canLoud = false;
  let frame: FrameMode = 'fill', corner: Corner = 'br';
  const look: Look = { contrast: 1, saturation: 1, grain: 0, vignette: 0, speed: 1 };
  let captions: Caption[] = [];
  let markers: number[] = [];
  let credit = source;
  let result: Blob | null = null;
  let raf = 0;

  mount(root, html`
    <header class="page-head"><h1><span class="h-ico">${icon('cut', 26)}</span>Cut</h1><p>Drop in a recording. Mark the moment. Export a vertical clip.</p>
      ${source ? html`<p style="color:var(--paper)">Source: ${source}. Record it, then drop the file here.</p>` : ''}</header>
    <div class="editor">
      <div class="editor__stage" data-stage></div>
      <div class="editor__tools">
        <div class="stepnav" role="tablist" aria-label="Steps">${STEPS.map(([k, l]) => html`<button type="button" role="tab" data-step="${k}" aria-selected="${String(k === step)}">${l}</button>`)}</div>
        <div class="toolpane" data-pane role="tabpanel"></div>
      </div>
      <div class="editor__timeline">
        <div class="tlbar"><div class="card__a"><button class="btn btn--sm" type="button" data-play disabled>Play</button><span class="mono" data-tc aria-live="off">00:00:00:00</span></div>
          <span class="fine">Drag the white edges to trim. Click to move the playhead.</span></div>
        <canvas class="tlc" data-tl aria-label="Timeline. Use the Trim step to set In and Out with the keyboard." role="img"></canvas>
      </div>
    </div>`);

  const stage = $('[data-stage]', root)!, pane = $('[data-pane]', root)!, tcEl = $('[data-tc]', root)!, playBtn = $<HTMLButtonElement>('[data-play]', root)!;
  const video = document.createElement('video');
  video.playsInline = true; video.preload = 'auto'; video.muted = false;
  const canvas = document.createElement('canvas');
  canvas.width = 540; canvas.height = 960;
  const ctx = canvas.getContext('2d')!;
  const tl = new Timeline($<HTMLCanvasElement>('[data-tl]', root)!, { duration: 0, t: 0, inT: 0, outT: 0, wave: null, markers: [], captions: [] }, {
    seek: (t) => { video.currentTime = t; },
    trim: (a, b) => { inT = a; outT = b; tl.set({ inT, outT }); if (step === 'trim') paintPane(); },
  });

  // ── Stage ───────────────────────────────────────────────
  const dropZone = () => {
    mount(stage, html`<label class="drop" data-drop>
      <span class="drop__ico">${icon('film', 32)}</span><b>Drop a recording here</b><p>or choose a file. MP4 or WebM. It stays on your device.</p><p class="fine">Works best under 10 minutes.</p>
      <input type="file" accept="video/mp4,video/webm" class="sr-only" data-file><span class="btn btn--sm" aria-hidden="true">Choose a file</span></label>`);
    const d = $('[data-drop]', stage)!, input = $<HTMLInputElement>('[data-file]', stage)!;
    input.addEventListener('change', () => input.files?.[0] && open(input.files[0]));
    d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('is-over'); });
    d.addEventListener('dragleave', () => d.classList.remove('is-over'));
    d.addEventListener('drop', (e) => { e.preventDefault(); d.classList.remove('is-over'); const f = e.dataTransfer?.files?.[0]; if (f) open(f); });
  };

  const open = (f: File) => {
    if (!/^video\/(mp4|webm)$/.test(f.type) && !/\.(mp4|webm)$/i.test(f.name)) { toast("That file didn't open. Try MP4 or WebM."); return; }
    file = f; result = null; markers = []; captions = [];
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f);
    video.src = url;
    video.onerror = () => { toast("That file didn't open. Try MP4 or WebM."); file = null; dropZone(); };
    video.onloadedmetadata = async () => {
      duration = video.duration; inT = 0; outT = Math.min(duration, 60);
      hasAudio = true; // the export maps audio as optional (0:a:0?), so a silent file still encodes
      canLoud = false;
      mount(stage, html`<div class="preview" data-preview></div>`);
      $('[data-preview]', stage)!.append(video, canvas);
      playBtn.disabled = false;
      tl.set({ duration, inT, outT, t: 0, markers, captions });
      step = 'trim'; paintSteps(); paintPane();
      video.currentTime = 0;
      // waveform for the A1 lane
      try {
        const { pcm, sampleRate } = await monoAudio(f);
        const rms = rmsWindows(pcm, sampleRate, 0.25);
        (tl as any).rms = rms;
        tl.set({ wave: envelope(rms, 600) });
        canLoud = true;
      } catch { canLoud = false; tl.set({ wave: null }); }
      if (step === 'trim') paintPane();
    };
  };

  const drawFrame = () => {
    const W = canvas.width, H = canvas.height, vw = video.videoWidth, vh = video.videoHeight;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (!vw) return;
    ctx.filter = `contrast(${look.contrast}) saturate(${look.saturation})`;
    const cover = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
      const s = Math.max(dw / sw, dh / sh), cw = dw / s, ch = dh / s;
      ctx.drawImage(video, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, dx, dy, dw, dh);
    };
    if (frame === 'fill') cover(0, 0, vw, vh, 0, 0, W, H);
    else if (frame === 'blur') {
      ctx.filter += ' blur(16px)'; cover(0, 0, vw, vh, -20, -20, W + 40, H + 40);
      ctx.filter = `contrast(${look.contrast}) saturate(${look.saturation})`;
      const s = Math.min(W / vw, H / vh); ctx.drawImage(video, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
    } else {
      const topH = H * 0.6;
      cover(0, 0, vw, vh, 0, 0, W, topH);
      const cx = corner.includes('r') ? vw * 2 / 3 : 0, cy = corner.includes('b') ? vh * 2 / 3 : 0;
      cover(cx, cy, vw / 3, vh / 3, 0, topH, W, H - topH);
    }
    ctx.filter = 'none';
    if (look.vignette > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.75 * look.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (look.grain > 0) {
      const n = Math.round(1800 * look.grain);
      for (let i = 0; i < n; i++) { ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)'; ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
    }
    const t = video.currentTime;
    const cap = captions.find((c) => t >= c.start && t <= c.end && c.text.trim());
    if (cap) drawCaption(ctx, cap.text, W, H);
  };

  const loop = () => {
    drawFrame();
    tcEl.textContent = timecode(video.currentTime);
    tl.set({ t: video.currentTime });
    if (!video.paused && video.currentTime >= outT) { video.pause(); video.currentTime = inT; }
    if (!video.paused) raf = requestAnimationFrame(loop);
  };
  video.addEventListener('seeked', () => { cancelAnimationFrame(raf); loop(); });
  video.addEventListener('play', () => { playBtn.textContent = 'Pause'; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); });
  video.addEventListener('pause', () => { playBtn.textContent = 'Play'; });
  playBtn.addEventListener('click', () => {
    if (video.paused) { video.playbackRate = look.speed; if (video.currentTime < inT || video.currentTime >= outT) video.currentTime = inT; video.play(); } else video.pause();
  });
  const redraw = () => { cancelAnimationFrame(raf); loop(); };

  // ── Steps ───────────────────────────────────────────────
  const paintSteps = () => root.querySelectorAll('[data-step]').forEach((b) => b.setAttribute('aria-selected', String((b as HTMLElement).dataset.step === step)));
  root.querySelectorAll<HTMLElement>('[data-step]').forEach((b) => b.addEventListener('click', () => { step = b.dataset.step as Step; paintSteps(); paintPane(); }));

  const needFile = (body: () => SafeHtml) => (file ? body() : html`<p class="muted">Drop a recording here</p>`);
  const slider = (key: keyof Look, label: string, min: number, max: number, stepv: number, show: (v: number) => string) =>
    html`<label class="field"><span>${label} <b class="num" style="color:var(--paper);float:right" data-out="${key}">${show(look[key])}</b></span><input type="range" min="${min}" max="${max}" step="${stepv}" value="${look[key]}" data-look="${key}"></label>`;

  const paintPane = () => {
    if (step === 'source') {
      mount(pane, html`${file ? html`<div class="kv" style="grid-template-columns:1fr 1fr"><div><span>File</span><b style="font-family:var(--sans);overflow:hidden;text-overflow:ellipsis">${file.name}</b></div><div><span>Size</span><b>${(file.size / MB).toFixed(1)} MB</b></div></div>
          ${file.size > 500 * MB ? html`<p class="fine" style="color:var(--paper)">Works best under 10 minutes.</p>` : ''}
          <button class="btn btn--ghost btn--sm" type="button" data-replace>Choose a file</button>` : html`<p class="muted">Drop a recording here</p>`}
        <label class="field"><span>Source credit (optional)</span><input class="input" data-credit value="${credit}" autocomplete="off"></label>
        <p class="fine">Added to your caption. Name the streamer.</p>`);
      $('[data-credit]', pane)!.addEventListener('input', (e) => { credit = (e.target as HTMLInputElement).value; });
      $('[data-replace]', pane)?.addEventListener('click', () => { video.pause(); file = null; dropZone(); paintPane(); });
    } else if (step === 'trim') {
      mount(pane, needFile(() => html`<div class="kv"><div><span>In</span><b>${timecode(inT)}</b></div><div><span>Out</span><b>${timecode(outT)}</b></div><div><span>Length</span><b>${timecode(outT - inT)}</b></div></div>
        <div class="card__a"><button class="btn btn--sm" type="button" data-set-in>In at playhead</button><button class="btn btn--sm" type="button" data-set-out>Out at playhead</button></div>
        <div class="formgrid" style="grid-template-columns:1fr 1fr"><label class="field"><span>In</span><input class="input num" type="number" min="0" step="0.1" value="${inT.toFixed(1)}" data-in></label><label class="field"><span>Out</span><input class="input num" type="number" min="0" step="0.1" value="${outT.toFixed(1)}" data-out-t></label></div>
        <div style="border-top:1px solid var(--line);padding-top:16px;display:grid;gap:10px">
          <button class="btn" type="button" data-loud ${canLoud ? '' : 'disabled'}>${icon('wave', 16)}Find loud moments</button>
          <p class="fine">Marks the loudest peaks in the audio. It doesn't know what's funny. It knows what's loud.</p>
          <div data-moments>${markers.length ? html`<div class="card__a">${markers.map((m) => html`<button class="btn btn--ghost btn--sm mono" type="button" data-jump="${m}">${timecode(m).slice(3)}</button>`)}</div>` : ''}</div>
        </div>`));
      if (!file) return;
      $('[data-set-in]', pane)!.addEventListener('click', () => { inT = Math.min(video.currentTime, outT - 0.5); tl.set({ inT }); paintPane(); });
      $('[data-set-out]', pane)!.addEventListener('click', () => { outT = Math.max(video.currentTime, inT + 0.5); tl.set({ outT }); paintPane(); });
      $('[data-in]', pane)!.addEventListener('change', (e) => { inT = Math.max(0, Math.min(+(e.target as HTMLInputElement).value, outT - 0.5)); tl.set({ inT }); paintPane(); });
      $('[data-out-t]', pane)!.addEventListener('change', (e) => { outT = Math.min(duration, Math.max(+(e.target as HTMLInputElement).value, inT + 0.5)); tl.set({ outT }); paintPane(); });
      $('[data-loud]', pane)!.addEventListener('click', () => {
        const rms = (tl as any).rms as Float32Array | undefined;
        const picks = rms ? pickPeaks(rms, { count: 8, minSpacing: 16 }) : [];
        markers = picks.map((i) => i * 0.25);
        tl.set({ markers });
        if (!markers.length) mount($('[data-moments]', pane)!, html`<p class="muted">Nothing stood out. Try a longer recording.</p>`); else paintPane();
      });
      pane.querySelectorAll<HTMLElement>('[data-jump]').forEach((b) => b.addEventListener('click', () => {
        const m = +b.dataset.jump!; video.currentTime = m; inT = Math.max(0, m - 8); outT = Math.min(duration, m + 7); tl.set({ inT, outT }); paintPane();
      }));
    } else if (step === 'frame') {
      mount(pane, html`<div class="radios" role="radiogroup" aria-label="Frame">${([['fill', 'Fill'], ['blur', 'Blur background'], ['stacked', 'Stacked']] as const).map(([v, l]) => html`<label><input type="radio" name="frame" value="${v}" ${v === frame ? 'checked' : ''}>${l}</label>`)}</div>
        <p class="fine">Stacked puts the game on top and the facecam below.</p>
        ${frame === 'stacked' ? html`<label class="field"><span>Facecam</span><select class="input" data-corner>${([['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']] as const).map(([v, l]) => html`<option value="${v}" ${v === corner ? 'selected' : ''}>${l}</option>`)}</select></label>` : ''}`);
      pane.querySelectorAll<HTMLInputElement>('input[name=frame]').forEach((r) => r.addEventListener('change', () => { frame = r.value as FrameMode; paintPane(); redraw(); }));
      $('[data-corner]', pane)?.addEventListener('change', (e) => { corner = (e.target as HTMLSelectElement).value as Corner; redraw(); });
    } else if (step === 'captions') {
      mount(pane, html`<button class="btn btn--sm" type="button" data-add ${file ? '' : 'disabled'}>${icon('plus', 14)}Add line</button>
        ${captions.length ? html`<div class="caps">${captions.map((c) => html`<div class="cap" data-cap="${c.id}">
          <input class="input num" type="number" step="0.1" min="0" value="${c.start.toFixed(1)}" data-k="start" aria-label="Start">
          <input class="input num" type="number" step="0.1" min="0" value="${c.end.toFixed(1)}" data-k="end" aria-label="End">
          <input class="input" value="${c.text}" data-k="text" aria-label="Text" maxlength="90">
          <button class="linkbtn" type="button" data-del>Remove</button></div>`)}</div>
          <div class="cap fine" style="margin-top:-4px"><span>Start</span><span>End</span><span>Text</span><span></span></div>` : html`<p class="muted">No captions yet. Add a line at the playhead.</p>`}`);
      $('[data-add]', pane)!.addEventListener('click', () => {
        const s = video.currentTime;
        captions = [...captions, { id: crypto.randomUUID(), start: s, end: Math.min(duration, s + 2), text: '' }].sort((a, b) => a.start - b.start);
        tl.set({ captions }); paintPane();
        pane.querySelector<HTMLInputElement>(`[data-cap] [data-k=text]`)?.focus();
      });
      pane.querySelectorAll<HTMLElement>('[data-cap]').forEach((row) => {
        const c = captions.find((x) => x.id === row.dataset.cap)!;
        row.querySelectorAll<HTMLInputElement>('input').forEach((i) => i.addEventListener('input', () => {
          if (i.dataset.k === 'text') c.text = i.value; else (c as any)[i.dataset.k!] = Math.max(0, +i.value);
          tl.set({ captions }); redraw();
        }));
        row.querySelector('[data-del]')!.addEventListener('click', () => { captions = captions.filter((x) => x !== c); tl.set({ captions }); paintPane(); redraw(); });
      });
    } else if (step === 'look') {
      mount(pane, html`${slider('contrast', 'Contrast', 0.6, 1.6, 0.05, (v) => v.toFixed(2))}${slider('saturation', 'Saturation', 0, 2, 0.05, (v) => v.toFixed(2))}
        ${slider('grain', 'Grain', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}${slider('vignette', 'Vignette', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
        ${slider('speed', 'Speed', 0.5, 2, 0.05, (v) => `${v.toFixed(2)}×`)}`);
      pane.querySelectorAll<HTMLInputElement>('[data-look]').forEach((r) => r.addEventListener('input', () => {
        const k = r.dataset.look as keyof Look; look[k] = +r.value;
        const out = pane.querySelector(`[data-out=${k}]`)!;
        out.textContent = k === 'speed' ? `${look[k].toFixed(2)}×` : k === 'grain' || k === 'vignette' ? `${Math.round(look[k] * 100)}%` : look[k].toFixed(2);
        if (k === 'speed') video.playbackRate = look.speed;
        redraw();
      }));
    } else {
      mount(pane, needFile(() => html`<button class="btn btn--cut" type="button" data-export>${icon('download', 16)}Export 1080×1920 MP4</button>
        <div data-prog hidden><div class="progress"><i></i></div><p class="fine num" data-pct style="margin-top:6px"></p></div>
        <div data-done></div>`));
      $('[data-export]', pane)?.addEventListener('click', doExport);
      if (result) showDone();
    }
  };

  const showDone = () => {
    if (!result) return;
    mount($('[data-done]', pane)!, html`<p>Done. ${(result.size / MB).toFixed(1)} MB.</p><div class="card__a" style="margin-top:10px"><button class="btn btn--sm" type="button" data-dl>Download</button><button class="btn btn--sm" type="button" data-queue>Queue to post</button></div>`);
    const name = (file?.name.replace(/\.[^.]+$/, '') ?? 'clip') + '-cut';
    $('[data-dl]', pane)!.addEventListener('click', () => {
      const u = URL.createObjectURL(result!);
      Object.assign(document.createElement('a'), { href: u, download: `${name}.mp4` }).click();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    });
    $('[data-queue]', pane)!.addEventListener('click', async () => {
      try {
        await putClip({ id: crypto.randomUUID(), name, size: result!.size, createdAt: Date.now(), blob: result!, credit: credit.trim() || undefined });
        location.hash = '#/post';
      } catch { toast('Not enough memory for this file. Trim it shorter first.'); }
    });
  };

  const doExport = async () => {
    if (!file) return;
    const btn = $<HTMLButtonElement>('[data-export]', pane)!, prog = $('[data-prog]', pane)!, bar = $('.progress i', pane) as HTMLElement, pct = $('[data-pct]', pane)!;
    btn.disabled = true; prog.hidden = false; pct.textContent = 'Encoding 0%';
    let ff: any;
    try {
      const { loadFFmpeg } = await import('../editor/ffmpeg');
      ff = await loadFFmpeg();
      const onP = ({ progress }: { progress: number }) => { const n = Math.max(0, Math.min(100, Math.round(progress * 100))); bar.style.width = `${n}%`; pct.textContent = `Encoding ${n}%`; };
      ff.on('progress', onP);
      const ext = /webm$/i.test(file.name) || file.type === 'video/webm' ? 'webm' : 'mp4';
      await ff.writeFile(`in.${ext}`, new Uint8Array(await file.arrayBuffer()));
      const caps = captions.filter((c) => c.text.trim() && c.end > inT && c.start < outT);
      for (let i = 0; i < caps.length; i++) await ff.writeFile(`cap${i}.png`, await captionPng(caps[i].text));
      const code = await ff.exec(buildArgs({ inT, outT, frame, corner, look, captions: caps, hasAudio }, `in.${ext}`, 'out.mp4'));
      ff.off('progress', onP);
      if (code !== 0) throw new Error('exit ' + code);
      const data = await ff.readFile('out.mp4');
      result = new Blob([data], { type: 'video/mp4' });
      await ff.deleteFile(`in.${ext}`).catch(() => {});
      bar.style.width = '100%'; pct.textContent = 'Encoding 100%';
      showDone();
    } catch (e: any) {
      toast(/memory|OOM|allocation/i.test(String(e?.message ?? e)) ? 'Not enough memory for this file. Trim it shorter first.' : 'Export stopped. Nothing was saved.');
      prog.hidden = true;
    } finally { btn.disabled = false; }
  };

  dropZone();
  paintPane();
  return () => { cancelAnimationFrame(raf); video.pause(); if (url) URL.revokeObjectURL(url); };
}
