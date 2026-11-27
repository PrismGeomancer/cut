// The 5 second intro: a film leader. Countdown 3, 2, 1 under a sweeping clock wipe, then the logo
// and the tagline, a red seam cuts the tagline, and a diagonal wipe hands over to the site.
// Skippable (button, Esc), once per session, never with reduced motion.
import { html } from './dom';
import { timecode } from '../lib/format';

const DUR = 5000;      // the whole thing
const WIPE_AT = 4400;  // the site mounts here and the wipe uncovers it

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const span = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/** Resolves when the site should mount (at the start of the wipe, or on skip). The overlay removes itself. */
export function playIntro(): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'intro';
    el.setAttribute('role', 'presentation');
    const ticks = Array.from({ length: 51 }, (_, i) => html`<i class="${i % 10 === 0 ? 'major' : i % 5 === 0 ? 'mid' : ''}" style="left:${i * 2}%"></i>`);
    el.innerHTML = html`
      <div class="intro__stage" aria-hidden="true">
        <div class="leader">
          <div class="leader__sweep"></div><i class="leader__h"></i><i class="leader__v"></i><i class="leader__ring"></i><i class="leader__ring leader__ring--in"></i>
          <span class="leader__n">3</span>
        </div>
        <p class="leader__roll">Rolling.</p>
        <div class="intro__reveal">
          <img src="./brand/logo.png" width="148" height="148" alt="">
          <p class="intro__tag"><span class="intro__t1">Cut the clip.</span><span class="intro__t2">Take your cut.</span><i class="intro__seam"></i></p>
        </div>
      </div>
      <div class="intro__foot" aria-hidden="true">
        <div class="intro__ruler">${ticks}<span class="intro__head"><b class="mono">00:00:00:00</b></span></div>
      </div>
      <button class="btn btn--ghost btn--sm intro__skip" type="button">Skip</button>`.value;
    document.body.append(el);

    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const leader = q('.leader'), sweep = q('.leader__sweep'), num = q('.leader__n'), roll = q('.leader__roll');
    const reveal = q('.intro__reveal'), logo = q<HTMLImageElement>('.intro__reveal img'), t1 = q('.intro__t1'), t2 = q('.intro__t2'), seam = q('.intro__seam');
    const head = q('.intro__head'), tc = q('.intro__head b');
    const skip = q<HTMLButtonElement>('.intro__skip');

    const t0 = performance.now();
    let raf = 0, mounted = false, done = false, lastN = 0;
    const mount = () => { if (!mounted) { mounted = true; resolve(); } };
    const finish = (fast = false) => {
      if (done) return;
      done = true; cancelAnimationFrame(raf); removeEventListener('keydown', onKey);
      mount();
      if (fast) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' }).onfinish = () => el.remove();
      else el.remove();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(true); };
    addEventListener('keydown', onKey);
    skip.addEventListener('click', () => finish(true));
    skip.focus({ preventScroll: true });

    const frame = (now: number) => {
      const ms = now - t0, t = ms / 1000;
      // bottom timeline: playhead and timecode run the full length
      head.style.left = `${Math.min(100, (ms / DUR) * 100)}%`;
      tc.textContent = timecode(Math.min(5, t));

      // 0 to 3 s: countdown
      const n = Math.max(1, 3 - Math.floor(t));
      if (n !== lastN) { num.textContent = String(n); lastN = n; }
      const p = t < 3 ? t % 1 : 1;
      sweep.style.setProperty('--a', `${(p * 360).toFixed(1)}deg`);
      num.style.opacity = String(t < 3 ? 1 - span(p, 0.78, 1) : 0);
      num.style.transform = `scale(${1 + 0.22 * (1 - ease(span(p, 0, 0.3)))})`;
      const leaderOut = ease(span(t, 2.85, 3.25));
      leader.style.opacity = String(1 - leaderOut);
      leader.style.transform = `scale(${1 - 0.1 * leaderOut})`;
      roll.style.opacity = String(span(t, 0.2, 0.6) * (1 - span(t, 2.7, 3.0)));

      // 3 to 4.4 s: logo and tagline, then the cut
      const rv = ease(span(t, 3.0, 3.5));
      logo.style.opacity = String(rv); logo.style.transform = `translateY(${(1 - rv) * 14}px) scale(${0.94 + 0.06 * rv})`;
      const tg = ease(span(t, 3.2, 3.65));
      t1.style.opacity = t2.style.opacity = String(tg);
      t1.style.transform = `translateY(${(1 - tg) * 10}px)`;
      const cut = span(t, 3.7, 3.98);
      seam.style.opacity = String(cut > 0 && t < 4.3 ? 1 : 0);
      seam.style.transform = `rotate(-8deg) scaleX(${ease(cut)})`;
      const slip = ease(span(t, 3.78, 4.2));
      t2.style.transform = `translate(${slip * 0.2}em, calc(${(1 - tg) * 10}px + ${slip * 0.035}em))`;
      reveal.style.opacity = '1';

      // 4.4 to 5 s: diagonal wipe off
      if (ms >= WIPE_AT) {
        mount();
        const w = ease(span(ms, WIPE_AT, DUR)) * 118;
        el.style.clipPath = `polygon(${w}% 0, 100% 0, 100% 100%, ${w - 18}% 100%)`;
      }
      if (ms >= DUR) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
