import { loadData, type Loaded } from './data';
import { PREVIEW } from '../preview';

export type Platform = 'twitch' | 'kick' | 'youtube' | 'tiktok';
export const PLATFORM_NAME: Record<Platform, string> = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube', tiktok: 'TikTok' };
/** Fixed colour order, never cycled, never repainted by a filter. */
export const PLATFORM_VAR: Record<Platform, string> = { twitch: 'var(--twitch)', kick: 'var(--kick)', youtube: 'var(--yt)', tiktok: 'var(--paper)' };

export interface Stream {
  platform: 'twitch' | 'kick';
  id: string; name: string; login?: string; title: string; viewers: number;
  startedAt: string; language: string; url: string; avatar: string; thumbnail: string; game?: string; generated?: boolean;
}
export interface LiveFile { generatedAt: string; category: string; streams: Stream[] }
export interface HistoryPoint { t: string; viewers: number; streams: number; twitch: number; kick: number }
export interface StreamerInfo { platform: 'twitch' | 'kick'; id: string; name: string; avatar: string; broadcasterType: '' | 'partner' | 'affiliate'; language: string; login?: string }

/** Demo mode only: the sample files are frozen in time, so slide their clock to "now" and the range buttons always have data. */
export async function loadLive(): Promise<Loaded<LiveFile>> {
  const l = await loadData<LiveFile>('live.json');
  if (!PREVIEW || (l.state !== 'ok' && l.state !== 'snapshot')) return l;
  const delta = Date.now() - Date.parse(l.data.generatedAt);
  const shift = (t: string) => new Date(Date.parse(t) + delta).toISOString();
  return { ...l, data: { ...l.data, generatedAt: shift(l.data.generatedAt), streams: l.data.streams.map((x) => ({ ...x, startedAt: shift(x.startedAt) })) } };
}

/** Demo mode: 7 days of sample history ending now (daily wave, evening peak, a little noise). Deterministic. */
function sampleHistory(): HistoryPoint[] {
  const STEP = 15 * 60_000, N = 7 * 96, now = Math.floor(Date.now() / STEP) * STEP;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const out: HistoryPoint[] = [];
  for (let i = N - 1; i >= 0; i--) {
    const t = now - i * STEP, h = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60, dow = new Date(t).getUTCDay();
    const wave = 1 + 0.32 * Math.sin(((h - 14) / 24) * 2 * Math.PI) + (dow === 0 || dow === 6 ? 0.12 : 0);
    const kickShare = 0.2 + 0.03 * Math.sin(t / 3.6e6 / 9) + rnd() * 0.01;
    const viewers = Math.round(1_280_000 * wave * (1 + rnd() * 0.05));
    const kick = Math.round(viewers * kickShare);
    out.push({ t: new Date(t).toISOString(), viewers, streams: Math.round(viewers / 2600 + rnd() * 6), twitch: viewers - kick, kick });
  }
  return out;
}

export const loadHistory = async (): Promise<Loaded<HistoryPoint[]>> =>
  PREVIEW ? { state: 'ok', data: sampleHistory(), fetchedAt: Date.now() } : loadData<HistoryPoint[]>('history.json');
export const loadStreamers = () => loadData<{ generatedAt: string; streamers: StreamerInfo[] } | StreamerInfo[]>('streamers.json');

export type PlatformFilter = 'all' | 'twitch' | 'kick';
export type Range = '6h' | '24h' | '7d';
export const RANGE_HOURS: Record<Range, number> = { '6h': 6, '24h': 24, '7d': 168 };

export const streamsOf = (l: Loaded<LiveFile>) => (l.state === 'ok' || l.state === 'snapshot' ? l.data.streams ?? [] : []);

export function filterStreams(s: Stream[], p: PlatformFilter) {
  return (p === 'all' ? s : s.filter((x) => x.platform === p)).slice().sort((a, b) => b.viewers - a.viewers);
}

export function byPlatform(s: Stream[]) {
  const out = { twitch: 0, kick: 0 };
  for (const x of s) out[x.platform] += x.viewers;
  return out;
}

export function byLanguage(s: Stream[], top = 6) {
  const m = new Map<string, number>();
  for (const x of s) m.set(x.language || 'other', (m.get(x.language || 'other') ?? 0) + x.viewers);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

/** Twitch thumbnails are templates; Kick ones are fixed URLs. */
export function thumbAt(url: string, w: number, h: number) {
  return url.replace('{width}', String(w)).replace('{height}', String(h)).replace('%{width}', String(w)).replace('%{height}', String(h));
}

export function aboutUrl(s: { platform: string; login?: string; name: string; url?: string }): string {
  const handle = encodeURIComponent((s.login || s.name).toLowerCase());
  if (s.platform === 'twitch') return `https://www.twitch.tv/${handle}/about`;
  if (s.platform === 'kick') return `https://kick.com/${handle}/about`;
  return s.url || '';
}
