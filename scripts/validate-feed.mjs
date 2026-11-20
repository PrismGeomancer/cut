// Enriches public/data/feed.json through TikTok's oEmbed and removes videos that no longer exist.
// GET https://www.tiktok.com/oembed?url=<video url>   (keyless)
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'public/data/feed.json';
const RE = /^https:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d{8,25})/;
const feed = JSON.parse(readFileSync(FILE, 'utf8'));
const out = [];
for (const item of feed) {
  const m = RE.exec(item.url ?? '');
  if (!m) { console.warn('dropped, not a TikTok video link:', item.url); continue; }
  const url = `https://www.tiktok.com/@${m[1]}/video/${m[2]}`;
  try {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (r.status === 400 || r.status === 404) { console.warn('removed, no longer available:', url); continue; }
    if (!r.ok) { out.push(item); continue; } // transient: keep as is
    const o = await r.json();
    // TikTok's oEmbed now often returns only the player HTML; keep what we already have
    out.push({ url, addedAt: item.addedAt ?? new Date().toISOString(), title: o.title ?? item.title ?? '', author: o.author_name ? `@${o.author_unique_id ?? m[1]}` : item.author ?? `@${m[1]}`, authorUrl: o.author_url ?? item.authorUrl ?? `https://www.tiktok.com/@${m[1]}`, thumbnail: o.thumbnail_url ?? item.thumbnail ?? '' });
  } catch { out.push(item); }
}
writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n');
console.log(`feed.json: ${out.length} of ${feed.length} kept`);
