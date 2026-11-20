import { fetchJson, loadLocal } from './data';
import { getJSON, setJSON } from './storage';

export interface FeedItem { url: string; addedAt: string; title: string; author: string; authorUrl: string; thumbnail: string; mine?: boolean }

const TIKTOK_VIDEO = /^https:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d{8,25})/;
export function tiktokId(url: string): { id: string; user: string } | null {
  const m = TIKTOK_VIDEO.exec(url.trim());
  return m ? { user: m[1], id: m[2] } : null;
}

const MINE = 'feed:mine';
export const myFeed = () => getJSON<FeedItem[]>(MINE, []);

export async function loadFeed(): Promise<FeedItem[]> {
  const repo = await loadLocal<FeedItem[]>('feed.json', []);
  const seen = new Set(repo.map((f) => f.url));
  return [...myFeed().filter((f) => !seen.has(f.url)), ...repo];
}

/**
 * Add a visitor's link. Tries TikTok oEmbed for title and thumbnail; TikTok does not send
 * CORS headers on oEmbed for every origin, so when that fails we keep the link and play
 * it through the embed alone.
 */
export async function addLink(url: string): Promise<FeedItem | null> {
  const t = tiktokId(url);
  if (!t) return null;
  const clean = `https://www.tiktok.com/@${t.user}/video/${t.id}`;
  let item: FeedItem = { url: clean, addedAt: new Date().toISOString(), title: '', author: `@${t.user}`, authorUrl: `https://www.tiktok.com/@${t.user}`, thumbnail: '', mine: true };
  try {
    const o = await fetchJson<any>(`https://www.tiktok.com/oembed?url=${encodeURIComponent(clean)}`, undefined, 8000);
    item = { ...item, title: o.title ?? '', author: o.author_name ?? item.author, authorUrl: o.author_url ?? item.authorUrl, thumbnail: o.thumbnail_url ?? '' };
  } catch { /* embed alone */ }
  const mine = myFeed().filter((f) => f.url !== clean);
  setJSON(MINE, [item, ...mine].slice(0, 100));
  return item;
}

export function removeMine(url: string) { setJSON(MINE, myFeed().filter((f) => f.url !== url)); }
