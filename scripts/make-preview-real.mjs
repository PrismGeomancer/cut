// Swaps the preview's generated content for REAL public content wherever a keyless, official source exists.
// Run after preview:data:  npm run preview:real
//
//  - YouTube Shorts: YouTube oEmbed (keyless) gives the real title, channel and thumbnail.
//  - TikTok: real public video links with their real captions. TikTok's oEmbed no longer returns
//    thumbnails, and scraping TikTok is out, so cards show the caption and play TikTok's own embed.
//  - Twitch/Kick streamers, avatars, live thumbnails and clips: only through the official APIs.
//    Put TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET (and optionally KICK_CLIENT_ID / KICK_CLIENT_SECRET)
//    in .env.local and this script runs the real fetcher into the preview. Real streamers are never
//    combined with invented partner tags or contact links.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const D = 'preview/data';
if (!existsSync(D)) { console.error('Run npm run preview:data first.'); process.exit(1); }

// .env.local (KEY=value lines), never committed
if (existsSync('.env.local')) for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

// ── YouTube Shorts (real) ─────────────────────────────────
const SHORTS = ['5mNrZIzbehM', 'qMZQPExt3nw', 'HLDdTwF93-o', 'wkR-kWmH5rM', '0kkG8HM04Ps', 's5CUl4wlPvs', '0QNCUZhznxw', 'KWxP4-T7nSc', 'KObvYKwS-E4', '-SShv4ySBZk', 'TOWpPrZnA5g', 'k9gDfjpjwu8'];
const shorts = [];
for (const id of SHORTS) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/shorts/${id}`)}&format=json`);
    if (!r.ok) { console.warn('short gone:', id); continue; }
    const o = await r.json();
    // oEmbed has no view count or date; the card hides what it doesn't have
    shorts.push({ id, title: o.title, channel: o.author_name, thumbnail: `https://i.ytimg.com/vi/${id}/oar2.jpg` });
  } catch (e) { console.warn('short failed:', id, e.message); }
}
writeFileSync(`${D}/shorts.json`, JSON.stringify({ generatedAt: new Date().toISOString(), query: 'GTA', shorts }));
console.log(`shorts: ${shorts.length} real`);

// ── TikTok (real links, real captions) ────────────────────
const feed = JSON.parse(readFileSync('public/data/feed.json', 'utf8')).filter((f) => f.title);
writeFileSync(`${D}/feed.json`, JSON.stringify(feed));
console.log(`tiktok: ${feed.length} real`);

// ── Twitch / Kick (real, needs keys) ──────────────────────
if (process.env.TWITCH_CLIENT_ID || process.env.KICK_CLIENT_ID) {
  // first real run: drop the generated streams, history and clips so nothing invented mixes with real
  // people. Later runs keep history.json, so the viewers chart grows one point per run.
  if (!existsSync(`${D}/.real`)) for (const f of ['live.json', 'streamers.json', 'history.json', 'clips.json']) rmSync(`${D}/${f}`, { force: true });
  writeFileSync(`${D}/.real`, new Date().toISOString());
  execFileSync(process.execPath, ['scripts/fetch-content.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, OUT_DIR: D, ONLY: 'live,clips', LIVE_CATEGORY: process.env.LIVE_CATEGORY || 'Grand Theft Auto VI,Grand Theft Auto V' },
  });
  // real people: no invented partner tags or contact links
  writeFileSync(`${D}/partners.json`, '[]');
  writeFileSync(`${D}/contacts.json`, '[]');
  let kick = 'real';
  if (!process.env.KICK_CLIENT_ID) { generatedKick(); kick = 'generated'; }
  writeFileSync(`${D}/sources.json`, JSON.stringify({ streams: 'real', kick }));
  console.log('streamers: real, from the official APIs');
} else {
  console.log('streamers: still generated. Add TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET to .env.local for real ones.');
}

// ── PREVIEW ONLY: invented Kick channels when there are no Kick keys ─────────
// Fictional names, generated images, flagged `generated: true`, replaced on every run.
function generatedKick() {
  const live = JSON.parse(readFileSync(`${D}/live.json`, 'utf8'));
  const twitch = live.streams.filter((s) => s.platform === 'twitch' && !s.generated);
  const twitchTotal = twitch.reduce((a, s) => a + s.viewers, 0);
  const topTwitch = Math.max(...twitch.map((s) => s.viewers));
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const NAMES = ['vexmoor', 'saltlakesam', 'nitro_nadia', 'brickhouse_bo', 'coldcase_cal', 'velvetvice', 'roadkill_rex', 'sunsetstrip_sy', 'm1ami_mo', 'pinkflamingo_pj', 'harborhank', 'leonidaluke', 'gatorgrace', 'neonnova_k', 'keyskid', 'palmettopete', 'bayoubella', 'swampking_s', 'hurricane_hal', 'cruiser_cris', 'duval_dex', 'causeway_cj', 'overpass_ollie', 'lowrider_lu', 'sandbar_sid', 'mangrove_max', 'heatwave_hex', 'tollbooth_tim', 'marina_mae', 'boardwalk_bri', 'riptide_ria', 'canal_cole', 'stucco_steph', 'jetski_jules', 'pelican_pax', 'humid_hugo', 'citrus_cy', 'swamp_rat_sol', 'kingpin_kit', 'gulfstream_g'];
  const TITLES = ['GTA 6 day one, full story no skips', 'Leonida road trip, chat picks the turns', 'first heist attempt, wish me luck', 'GTA VI 100% run starts now', 'cop chases only, no fast travel', 'exploring Vice City until I fall asleep', 'GTA 6 with the boys, chaos guaranteed', 'photo mode tour of the whole map'];
  const LANGS = ['en', 'en', 'en', 'es', 'es', 'pt', 'de', 'tr', 'fr', 'ar'];
  const total = Math.round(twitchTotal * 0.27), n = NAMES.length;
  const weights = NAMES.map((_, i) => 1 / (i + 1) ** 0.9), wsum = weights.reduce((a, b) => a + b, 0);
  const kick = NAMES.map((name, i) => ({
    platform: 'kick', id: `gk${i}`, name, login: name, title: TITLES[i % TITLES.length],
    // capped below the biggest real stream, so real streams lead the monitor and the wall
    viewers: Math.max(40, Math.round(Math.min((total * weights[i]) / wsum, topTwitch * (0.5 - i * 0.004)) * (0.9 + rnd() * 0.2))),
    startedAt: new Date(Date.now() - (20 + rnd() * 600) * 60000).toISOString(), language: LANGS[i % LANGS.length],
    url: '', avatar: `./preview/img/avatar-${String(i % 40).padStart(2, '0')}.webp`, thumbnail: `./preview/img/live-${String(i % 40).padStart(2, '0')}.webp`,
    game: i % 7 === 6 ? 'Grand Theft Auto V' : 'Grand Theft Auto VI', generated: true,
  }));
  live.streams = [...live.streams.filter((s) => !s.generated && s.platform !== 'kick'), ...kick].sort((a, b) => b.viewers - a.viewers);
  writeFileSync(`${D}/live.json`, JSON.stringify(live));
  const info = JSON.parse(readFileSync(`${D}/streamers.json`, 'utf8'));
  info.streamers = [...info.streamers.filter((s) => s.platform !== 'kick'), ...kick.map((s) => ({ platform: 'kick', id: s.id, name: s.name, login: s.login, avatar: s.avatar, broadcasterType: '', language: s.language }))];
  writeFileSync(`${D}/streamers.json`, JSON.stringify(info));
  // history: Kick follows Twitch at about 27% with a little drift
  const hist = JSON.parse(readFileSync(`${D}/history.json`, 'utf8')).map((h, i) => {
    const k = Math.round(h.twitch * (0.25 + 0.04 * Math.sin(i / 5)));
    return { ...h, kick: k, viewers: h.twitch + k };
  });
  writeFileSync(`${D}/history.json`, JSON.stringify(hist));
  console.log(`kick: ${kick.length} generated channels (preview only)`);
}
