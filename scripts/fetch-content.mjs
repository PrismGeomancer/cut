// Runs in GitHub Actions with secrets from Actions secrets. Writes JSON into OUT_DIR
// (a checkout of the `data` branch); the workflow commits it. No secret is ever written out.
//
// Endpoints (checked against current docs):
//   Twitch  POST https://id.twitch.tv/oauth2/token (client_credentials)
//           GET  https://api.twitch.tv/helix/games?name=
//           GET  https://api.twitch.tv/helix/streams?game_id=&first=100&after=
//           GET  https://api.twitch.tv/helix/clips?game_id=&started_at=&ended_at=&first=100
//           GET  https://api.twitch.tv/helix/users?id=  (up to 100)
//   Kick    POST https://id.kick.com/oauth/token (client_credentials)
//           GET  https://api.kick.com/public/v2/categories?name=
//           GET  https://api.kick.com/public/v2/livestreams?category_id=&limit=  (returned oldest first; we sort)
//   YouTube GET  https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&order=viewCount
//           GET  https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=
//   DexScreener GET https://api.dexscreener.com/token-boosts/top/v1, /tokens/v1/solana/{addresses}
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.OUT_DIR || 'data-out';
// one category or several, comma separated (e.g. "Grand Theft Auto VI,Grand Theft Auto V")
const CATEGORIES = (process.env.LIVE_CATEGORY || '').split(',').map((s) => s.trim()).filter(Boolean);
const CATEGORY = CATEGORIES.join(', ');
const SCHEDULE = process.env.SCHEDULE || ''; // github.event.schedule
const ONLY = process.env.ONLY || '';         // manual runs: live,clips,shorts
mkdirSync(OUT, { recursive: true });

const want = (job) => {
  if (ONLY) return ONLY.split(',').includes(job);
  if (!SCHEDULE) return true;
  return { live: '*/10 * * * *', clips: '5,35 * * * *', shorts: '20 * * * *' }[job] === SCHEDULE || (job === 'live');
};

const read = (f, fallback) => { try { return JSON.parse(readFileSync(join(OUT, f), 'utf8')); } catch { return fallback; } };
const write = (f, v) => { writeFileSync(join(OUT, f), JSON.stringify(v)); console.log(`wrote ${f}`); };
async function j(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${new URL(url).host}${new URL(url).pathname}`);
  return r.json();
}

// ── Twitch ────────────────────────────────────────────────
let twitchToken = null;
async function twitch(path) {
  const id = process.env.TWITCH_CLIENT_ID, secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Twitch credentials missing');
  if (!twitchToken) {
    const t = await j('https://id.twitch.tv/oauth2/token', { method: 'POST', body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }) });
    twitchToken = t.access_token;
  }
  return j(`https://api.twitch.tv/helix/${path}`, { headers: { 'Client-Id': id, Authorization: `Bearer ${twitchToken}` } });
}
async function twitchGameIds() {
  if (!CATEGORIES.length) return [];
  const g = await twitch(`games?${CATEGORIES.map((n) => `name=${encodeURIComponent(n)}`).join('&')}`);
  return (g.data ?? []).map((x) => x.id);
}
async function twitchStreams(gameIds) {
  const out = [];
  let after = '';
  const games = gameIds.map((id) => `&game_id=${id}`).join('');
  for (let i = 0; i < 5; i++) {
    const r = await twitch(`streams?first=100${games}${after ? `&after=${after}` : ''}`);
    out.push(...r.data);
    after = r.pagination?.cursor;
    if (!after) break;
  }
  return out.map((s) => ({
    platform: 'twitch', id: s.user_id, name: s.user_name, login: s.user_login, title: s.title, viewers: s.viewer_count,
    startedAt: s.started_at, language: s.language, url: `https://www.twitch.tv/${s.user_login}`, avatar: '', thumbnail: s.thumbnail_url,
    gameId: s.game_id, game: s.game_name,
  }));
}
async function twitchUsers(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await twitch(`users?${ids.slice(i, i + 100).map((x) => `id=${x}`).join('&')}`);
    out.push(...r.data);
  }
  return out;
}

// ── Kick ──────────────────────────────────────────────────
let kickToken = null;
async function kick(path) {
  const id = process.env.KICK_CLIENT_ID, secret = process.env.KICK_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Kick credentials missing');
  if (!kickToken) {
    const t = await j('https://id.kick.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }) });
    kickToken = t.access_token;
  }
  return j(`https://api.kick.com/public/${path}`, { headers: { Authorization: `Bearer ${kickToken}`, Accept: 'application/json' } });
}
async function kickStreams() {
  let cat = '';
  if (CATEGORIES.length) {
    const c = await kick(`v2/categories?name=${CATEGORIES.map(encodeURIComponent).join(',')}`);
    cat = (c.data ?? []).filter((x) => CATEGORIES.some((n) => n.toLowerCase() === x.name.toLowerCase())).map((x) => x.id).slice(0, 25).join(',');
    if (!cat) return [];
  }
  const r = await kick(`v2/livestreams?limit=1000${cat ? `&category_id=${cat}` : ''}`);
  return (r.data ?? []).sort((a, b) => b.viewer_count - a.viewer_count).slice(0, 100).map((s) => ({
    platform: 'kick', id: String(s.broadcaster_user?.id ?? s.id), name: s.broadcaster_user?.username ?? s.channel?.slug, login: s.channel?.slug,
    title: s.title, viewers: s.viewer_count, startedAt: s.started_at, language: s.language_code || 'other',
    url: `https://kick.com/${s.channel?.slug}`, avatar: s.broadcaster_user?.profile_picture ?? '', thumbnail: s.thumbnail ?? '', game: s.category?.name ?? '',
  }));
}

// ── Jobs ──────────────────────────────────────────────────
async function live() {
  const prev = read('live.json', null);
  const [tw, kk] = await Promise.allSettled([twitchGameIds().then(twitchStreams), kickStreams()]);
  if (tw.status === 'rejected') console.warn('twitch:', tw.reason.message);
  if (kk.status === 'rejected') console.warn('kick:', kk.reason.message);
  // a failed platform keeps its previous rows rather than dropping to zero
  const keep = (p) => (prev?.streams ?? []).filter((s) => s.platform === p);
  const twitchRows = tw.status === 'fulfilled' ? tw.value : keep('twitch');
  const kickRows = kk.status === 'fulfilled' ? kk.value : keep('kick');
  if (tw.status === 'rejected' && kk.status === 'rejected') throw new Error('both live sources failed');

  // avatars and broadcaster type
  const users = tw.status === 'fulfilled' ? await twitchUsers(twitchRows.map((s) => s.id)).catch(() => []) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const s of twitchRows) s.avatar = byId.get(s.id)?.profile_image_url ?? s.avatar ?? '';
  const streams = [...twitchRows, ...kickRows].sort((a, b) => b.viewers - a.viewers);
  const generatedAt = new Date().toISOString();
  write('live.json', { generatedAt, category: CATEGORY, streams: streams.map(({ gameId, ...s }) => s) });

  const prevStreamers = read('streamers.json', { streamers: [] }).streamers ?? [];
  const info = [
    ...twitchRows.map((s) => { const u = byId.get(s.id); return { platform: 'twitch', id: s.id, name: s.name, login: s.login, avatar: s.avatar, broadcasterType: u?.broadcaster_type ?? prevStreamers.find((p) => p.id === s.id)?.broadcasterType ?? '', language: s.language }; }),
    ...kickRows.map((s) => ({ platform: 'kick', id: s.id, name: s.name, login: s.login, avatar: s.avatar, broadcasterType: '', language: s.language })),
  ];
  write('streamers.json', { generatedAt, streamers: info });

  const sum = (p) => streams.filter((s) => s.platform === p).reduce((a, s) => a + s.viewers, 0);
  const week = Date.now() - 7 * 86400_000;
  const history = read('history.json', []).filter((h) => Date.parse(h.t) >= week);
  history.push({ t: generatedAt, viewers: sum('twitch') + sum('kick'), streams: streams.length, twitch: sum('twitch'), kick: sum('kick') });
  write('history.json', history);

  // biggest category for clips when LIVE_CATEGORY is empty
  return twitchRows[0]?.gameId ?? '';
}

async function clips(gameIdHint) {
  let ids = await twitchGameIds();
  if (!ids.length && gameIdHint) ids = [gameIdHint];
  if (!ids.length) { console.warn('clips: no game id'); return; }
  const end = new Date(), start = new Date(end.getTime() - 24 * 3600_000);
  // Get Clips takes one game_id per call; merge and keep the 100 most viewed
  const all = [];
  for (const id of ids) {
    const r = await twitch(`clips?game_id=${id}&first=100&started_at=${start.toISOString()}&ended_at=${end.toISOString()}`);
    all.push(...r.data);
  }
  all.sort((a, b) => b.view_count - a.view_count);
  write('clips.json', {
    generatedAt: end.toISOString(),
    clips: all.slice(0, 100).map((c) => ({ id: c.id, url: c.url, embedUrl: c.embed_url, title: c.title, broadcaster: c.broadcaster_name, creator: c.creator_name, views: c.view_count, createdAt: c.created_at, thumbnail: c.thumbnail_url, duration: c.duration, language: c.language })),
  });
}

const isoSeconds = (d) => { const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d || ''); return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : Infinity; };
async function shorts() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !CATEGORY) { console.warn('shorts: needs YOUTUBE_API_KEY and LIVE_CATEGORY'); return; }
  // YouTube search has no Shorts-only filter: videoDuration=short means under 4 minutes,
  // so we read each video's real duration with videos.list and keep 60 s or less.
  const after = new Date(Date.now() - 7 * 86400_000).toISOString();
  const s = await j(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&order=viewCount&maxResults=50&publishedAfter=${after}&q=${encodeURIComponent((CATEGORIES[0] ?? '') + ' #shorts')}&key=${key}`);
  const ids = s.items.map((i) => i.id.videoId).filter(Boolean);
  if (!ids.length) { write('shorts.json', { generatedAt: new Date().toISOString(), query: CATEGORY, shorts: [] }); return; }
  const v = await j(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${ids.join(',')}&key=${key}`);
  const list = v.items.map((x) => ({
    id: x.id, title: x.snippet.title, channel: x.snippet.channelTitle, views: Number(x.statistics.viewCount ?? 0),
    publishedAt: x.snippet.publishedAt, duration: isoSeconds(x.contentDetails.duration),
    thumbnail: x.snippet.thumbnails?.high?.url ?? x.snippet.thumbnails?.medium?.url ?? '',
  })).filter((x) => x.duration <= 60).sort((a, b) => b.views - a.views);
  write('shorts.json', { generatedAt: new Date().toISOString(), query: CATEGORY, shorts: list });
}

async function market() {
  const boosts = await j('https://api.dexscreener.com/token-boosts/top/v1');
  const addrs = [...new Set(boosts.filter((b) => b.chainId === 'solana').map((b) => b.tokenAddress))].slice(0, 30);
  const pairs = addrs.length ? await j(`https://api.dexscreener.com/tokens/v1/solana/${addrs.join(',')}`) : [];
  const best = new Map();
  for (const p of pairs) { const a = p.baseToken?.address; if (a && (!best.has(a) || (p.liquidity?.usd ?? 0) > (best.get(a).liquidity?.usd ?? 0))) best.set(a, p); }
  const rows = [...best.values()].map((p) => ({ address: p.baseToken.address, symbol: p.baseToken.symbol, name: p.baseToken.name, icon: p.info?.imageUrl ?? '', priceUsd: +p.priceUsd || 0, change24h: +p.priceChange?.h24 || 0, volume24h: +p.volume?.h24 || 0, liquidity: +p.liquidity?.usd || 0, marketCap: +(p.marketCap ?? p.fdv ?? 0), url: p.url })).sort((a, b) => b.volume24h - a.volume24h).slice(0, 12);
  write('market.json', { generatedAt: new Date().toISOString(), rows });
}

let failed = 0;
const run = async (name, fn) => { try { return await fn(); } catch (e) { failed++; console.error(`${name} failed:`, e.message); } };
let hint = '';
if (want('live')) hint = (await run('live', live)) ?? '';
if (want('live')) await run('market', market);
if (want('clips')) await run('clips', () => clips(hint));
if (want('shorts')) await run('shorts', shorts);
if (!existsSync(join(OUT, 'paused.json'))) write('paused.json', { paused: false });
process.exitCode = failed && failed >= 3 ? 1 : 0;
