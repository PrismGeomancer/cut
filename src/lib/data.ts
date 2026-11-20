import { CONFIG } from '../config';
import { getJSON, setJSON } from './storage';
import { PREVIEW, PREVIEW_BASE } from '../preview';

export type Loaded<T> =
  | { state: 'ok'; data: T; generatedAt?: string; fetchedAt: number }
  | { state: 'snapshot'; data: T; generatedAt?: string; fetchedAt: number } // live failed, older copy shown
  | { state: 'empty' }   // source not configured or never produced a snapshot
  | { state: 'error' };  // failed and nothing to fall back to

/** Minute-based cache buster: one fresh request per minute per file. */
export const bust = (now = Date.now()) => `t=${Math.floor(now / 60000)}`;

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  } finally { clearTimeout(timer); }
}

const inflight = new Map<string, Promise<Loaded<any>>>();

/** A file on the data branch. Keeps the last good copy so a failed refresh shows its age. */
export function loadData<T>(name: string, base = CONFIG.DATA_BASE_URL): Promise<Loaded<T>> {
  if (!base) return Promise.resolve({ state: 'empty' });
  const key = `${base}/${name}`;
  const hit = inflight.get(key);
  if (hit) return hit;
  const p = (async (): Promise<Loaded<T>> => {
    const snapKey = `snap:${name}`;
    try {
      const data = await fetchJson<T>(`${base.replace(/\/$/, '')}/${name}?${bust()}`);
      const generatedAt = (data as any)?.generatedAt;
      setJSON(snapKey, { data, generatedAt, fetchedAt: Date.now() });
      return { state: 'ok', data, generatedAt, fetchedAt: Date.now() };
    } catch {
      const snap = getJSON<{ data: T; generatedAt?: string; fetchedAt: number } | null>(snapKey, null);
      return snap ? { state: 'snapshot', ...snap } : { state: 'error' };
    }
  })();
  inflight.set(key, p);
  setTimeout(() => inflight.delete(key), 30_000);
  return p;
}

/** A file shipped with the site in /public/data. */
export async function loadLocal<T>(name: string, fallback: T): Promise<T> {
  try { return await fetchJson<T>(`${PREVIEW ? PREVIEW_BASE : './data'}/${name}?${bust()}`); } catch { return fallback; }
}

export const ageOf = (l: Loaded<any>) =>
  l.state === 'ok' || l.state === 'snapshot' ? (l.generatedAt ? Date.parse(l.generatedAt) : l.fetchedAt) : 0;
