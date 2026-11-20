const nf = new Intl.NumberFormat('en-US');
export const int = (n: number) => nf.format(Math.round(n));

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return trim(n / 1e9) + 'B';
  if (a >= 1e6) return trim(n / 1e6) + 'M';
  if (a >= 1e4) return trim(n / 1e3) + 'K';
  return int(n);
}
const trim = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '');

export function sol(lamports: number, digits = 3): string {
  const v = lamports / 1e9;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function usd(n: number): string {
  if (!isFinite(n)) return '';
  if (n === 0) return '$0';
  const a = Math.abs(n);
  if (a >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  // small prices: keep 4 significant figures
  return '$' + n.toPrecision(4).replace(/0+$/, '');
}
export const usdCompact = (n: number) => '$' + compact(n);

export function minutesAgo(iso: string | number, now = Date.now()): number {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  return Math.max(0, Math.round((now - t) / 60000));
}

/** "12 min ago", "3 h ago", "2 d ago" */
export function age(iso: string | number, now = Date.now()): string {
  const m = minutesAgo(iso, now);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "2 h 14 m" for a live duration */
export function liveFor(iso: string, now = Date.now()): string {
  const m = minutesAgo(iso, now);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m` : `${m} m`;
}

/** clip length: 0:27 */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** SMPTE-style timecode HH:MM:SS:FF at 25 fps */
export function timecode(sec: number, fps = 25): string {
  const total = Math.max(0, sec);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = Math.floor(total % 60);
  const f = Math.floor((total % 1) * fps);
  return [h, m, s, f].map((v) => String(v).padStart(2, '0')).join(':');
}

export const shortAddr = (a: string) => (a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

/** ISO 8601 duration (PT1M2S) to seconds */
export function isoDuration(d: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(d || '');
  if (!m) return NaN;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}

const LANG = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'language' }) : null;
export function languageName(code: string): string {
  if (!code || code === 'other') return 'Other';
  try { return LANG?.of(code) ?? code; } catch { return code; }
}
