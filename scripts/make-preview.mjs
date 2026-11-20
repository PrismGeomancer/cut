// Generates PREVIEW-ONLY mockup data and images into ./preview (served only by preview builds).
// Every name is invented. Run: npm run preview:data
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import sharp from 'sharp';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { evaluate } from '../src/lib/eligibility.ts';
import { PREVIEW_TREASURY, PREVIEW_REFERENCE } from '../src/preview.ts';

const OUT = 'preview', D = `${OUT}/data`, I = `${OUT}/img`;
rmSync(OUT, { recursive: true, force: true }); // also clears preview/data/.real
mkdirSync(D, { recursive: true }); mkdirSync(I, { recursive: true });

// seeded random so the preview is stable between runs
let seed = 20261119;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const range = (a, b) => a + rnd() * (b - a);
const now = Date.now(), iso = (t) => new Date(t).toISOString();

// ── Images ────────────────────────────────────────────────
const PALETTES = [
  ['#0f2a44', '#1f5f8b', '#f2a65a', '#e8e4da'], ['#2b1b3d', '#6b3fa0', '#ff7a59', '#f6e7d8'], ['#10302a', '#1f7a5c', '#d9f99d', '#e8e4da'],
  ['#3a1f1a', '#a4452c', '#ffd166', '#fdf0d5'], ['#1a1d2e', '#3d4a8f', '#7dd3fc', '#e0f2fe'], ['#2d2a1a', '#8a7a2c', '#fde68a', '#fffbeb'],
  ['#1b2b34', '#2f6f73', '#f28482', '#f6f1e9'], ['#241a2e', '#7c3a5c', '#f5c2e7', '#fdf4ff'], ['#0d1f2d', '#14546b', '#ffb703', '#e8e4da'],
  ['#2a2222', '#6d4c41', '#ffab91', '#fbe9e7'],
];
const person = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-34" r="22" fill="${c}"/><path d="M-46 30 Q-44 -6 0 -8 Q44 -6 46 30 Z" fill="${c}"/></g>`;
const cam = (W, H, p) => { const w = W * 0.26, h = w * 0.75, x = W * 0.03, y = H - h - H * 0.05;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${p[0]}" stroke="${p[3]}" stroke-opacity=".5" stroke-width="2"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#lamp)"/>${person(x + w / 2, y + h * 0.92, w / 120, p[1])}`; };

const SCENES = {
  shooter: (W, H, p) => `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    <path d="M0 ${H * .62} L${W * .2} ${H * .48} L${W * .38} ${H * .58} L${W * .6} ${H * .42} L${W * .82} ${H * .55} L${W} ${H * .47} V${H} H0Z" fill="${p[1]}"/>
    <path d="M0 ${H * .75} L${W * .3} ${H * .66} L${W * .7} ${H * .72} L${W} ${H * .64} V${H} H0Z" fill="${p[0]}"/>
    <g stroke="${p[3]}" stroke-width="3" opacity=".9"><path d="M${W / 2 - 22} ${H / 2}h14M${W / 2 + 8} ${H / 2}h14M${W / 2} ${H / 2 - 22}v14M${W / 2} ${H / 2 + 8}v14"/></g>
    <circle cx="${W - 70}" cy="70" r="46" fill="${p[0]}" fill-opacity=".7" stroke="${p[3]}" stroke-opacity=".6"/><circle cx="${W - 70}" cy="70" r="5" fill="${p[2]}"/>
    <rect x="${W * .62}" y="${H - 48}" width="${W * .3}" height="12" rx="6" fill="${p[0]}" fill-opacity=".7"/><rect x="${W * .62}" y="${H - 48}" width="${W * .2}" height="12" rx="6" fill="${p[2]}"/>`,
  chatting: (W, H, p) => `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    <rect x="${W * .62}" y="${H * .12}" width="${W * .26}" height="${H * .42}" rx="6" fill="${p[2]}" opacity=".35"/>
    <rect x="${W * .08}" y="${H * .18}" width="${W * .18}" height="${H * .26}" rx="4" fill="${p[1]}"/>
    <circle cx="${W * .2}" cy="${H * .62}" r="${H * .16}" fill="${p[2]}" opacity=".25"/>
    ${person(W * .46, H * 1.02, H / 170, p[0])}<rect y="${H * .86}" width="${W}" height="${H * .14}" fill="${p[0]}"/>
    <rect x="${W * .76}" y="${H * .2}" width="${W * .2}" height="${H * .66}" rx="6" fill="${p[0]}" fill-opacity=".55"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${W * .78}" y="${H * .25 + i * H * .095}" width="${W * (.08 + rnd() * .08)}" height="8" rx="4" fill="${p[3]}" opacity=".55"/>`).join('')}`,
  racing: (W, H, p) => `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="${W * .5}" cy="${H * .5}" r="${H * .18}" fill="${p[2]}" opacity=".8"/>
    <path d="M0 ${H * .55} H${W} V${H} H0Z" fill="${p[0]}"/><path d="M${W * .44} ${H * .55} L${W * .56} ${H * .55} L${W * .95} ${H} L${W * .05} ${H}Z" fill="${p[1]}"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${W * .5 - 2 - i * 3} ${H * (.6 + i * .1)} h${4 + i * 6} l${2 + i} ${H * .05} h-${8 + i * 8}z" fill="${p[3]}"/>`).join('')}
    <text x="${W - 40}" y="${H - 36}" text-anchor="end" font-family="Helvetica, Arial" font-weight="700" font-size="${H * .12}" fill="${p[3]}">${Math.round(range(140, 290))}</text>`,
  strategy: (W, H, p) => { let g = `<rect width="${W}" height="${H}" fill="${p[0]}"/>`; const s = W / 16;
    for (let x = 0; x < 16; x++) for (let y = 0; y < 10; y++) g += `<rect x="${x * s + 1}" y="${y * s + 1}" width="${s - 2}" height="${s - 2}" fill="${rnd() > .7 ? p[1] : rnd() > .9 ? p[2] : p[0]}" opacity="${.5 + rnd() * .5}"/>`;
    for (let i = 0; i < 14; i++) g += `<circle cx="${rnd() * W}" cy="${rnd() * H}" r="${4 + rnd() * 6}" fill="${i % 3 ? p[3] : p[2]}"/>`;
    return g + `<rect x="${W - 190}" y="16" width="174" height="60" rx="6" fill="${p[0]}" stroke="${p[3]}" stroke-opacity=".4"/>`; },
  music: (W, H, p) => `<rect width="${W}" height="${H}" fill="url(#sky)"/>
    <path d="M${W * .3} 0 L${W * .18} ${H} H${W * .42}Z" fill="${p[2]}" opacity=".18"/><path d="M${W * .7} 0 L${W * .58} ${H} H${W * .82}Z" fill="${p[3]}" opacity=".14"/>
    ${Array.from({ length: 28 }, (_, i) => { const h = H * (.08 + rnd() * .45); return `<rect x="${W * .1 + i * W * .029}" y="${H * .78 - h}" width="${W * .02}" height="${h}" rx="3" fill="${i % 4 ? p[3] : p[2]}" opacity=".85"/>`; }).join('')}
    <rect y="${H * .8}" width="${W}" height="${H * .2}" fill="${p[0]}"/>`,
  art: (W, H, p) => `<rect width="${W}" height="${H}" fill="${p[3]}"/>
    ${Array.from({ length: 9 }, () => `<path d="M${rnd() * W} ${rnd() * H} C ${rnd() * W} ${rnd() * H}, ${rnd() * W} ${rnd() * H}, ${rnd() * W} ${rnd() * H}" stroke="${pick(p.slice(0, 3))}" stroke-width="${8 + rnd() * 26}" fill="none" stroke-linecap="round" opacity=".85"/>`).join('')}
    <rect x="${W * .7}" y="${H * .08}" width="${W * .26}" height="${H * .1}" rx="6" fill="${p[0]}" opacity=".85"/>`,
  irl: (W, H, p) => { let g = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
    let x = 0; while (x < W) { const w = 40 + rnd() * 80, h = H * (.25 + rnd() * .5); g += `<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="${p[0]}"/>`;
      for (let wy = H - h + 12; wy < H - 10; wy += 18) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (rnd() > .55) g += `<rect x="${wx}" y="${wy}" width="6" height="8" fill="${p[2]}" opacity=".8"/>`; x += w + 4; }
    return g + `<circle cx="${W * .8}" cy="${H * .18}" r="${H * .07}" fill="${p[3]}" opacity=".9"/>`; },
  board: (W, H, p) => { let g = `<rect width="${W}" height="${H}" fill="${p[0]}"/>`; const s = H * .1, ox = W / 2 - s * 4, oy = H * .1;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) g += `<rect x="${ox + x * s}" y="${oy + y * s}" width="${s}" height="${s}" fill="${(x + y) % 2 ? p[1] : p[3]}"/>`;
    for (let i = 0; i < 12; i++) g += `<circle cx="${ox + (Math.floor(rnd() * 8) + .5) * s}" cy="${oy + (Math.floor(rnd() * 8) + .5) * s}" r="${s * .32}" fill="${i % 2 ? p[0] : p[2]}" stroke="${p[3]}" stroke-width="2"/>`;
    return g; },
};
const SCENE_KEYS = Object.keys(SCENES);

function svg(W, H, sceneKey, p, { withCam = true, vertical = false } = {}) {
  const body = SCENES[sceneKey](W, H, p);
  const capbar = vertical ? `<rect x="${W * .1}" y="${H * .62}" width="${W * .8}" height="${H * .09}" rx="12" fill="#14171A" opacity=".92"/>
    <rect x="${W * .18}" y="${H * .645}" width="${W * .64}" height="${H * .016}" rx="6" fill="#E8E4DA"/><rect x="${W * .28}" y="${H * .675}" width="${W * .44}" height="${H * .016}" rx="6" fill="#E8E4DA"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>
    <radialGradient id="lamp" cx=".7" cy=".2" r=".9"><stop offset="0" stop-color="${p[2]}" stop-opacity=".45"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
    ${body}${withCam && !['chatting', 'irl'].includes(sceneKey) ? cam(W, H, p) : ''}<rect width="${W}" height="${H}" fill="url(#shade)"/>${capbar}</svg>`;
}
const img = (file, W, H, s) => sharp(Buffer.from(s)).resize(W, H).webp({ quality: 78 }).toFile(`${I}/${file}`);

// ── Names and titles (all invented) ───────────────────────
const NAMES = ['nightowl_vex', 'MarlowPlays', 'kiri_codes', 'BrassMonkeyTV', 'luma_lark', 'Octavian_GG', 'pixelpeach', 'TheQuietRook', 'junebugjams', 'ferro_fox', 'solsticesam', 'Captain_Kettle', 'noodlewave', 'Ravenmoor', 'tidepooltony', 'hexhaven', 'minty_mae', 'grimdark_greg', 'cobaltcass', 'wafflehouse_walt', 'zeroping_zoe', 'birchbark', 'velvetvandal', 'OrbitOtter', 'plumpudding', 'SableStreams', 'ditto_dan', 'emberlynn', 'fizzbuzzer', 'gravelgrin', 'hazelnutHQ', 'irisinmotion', 'jadejumper', 'kestrel_k', 'lowtide_leo', 'moxiemoss', 'nova_nibbles', 'opal_ops', 'quartzquinn', 'rustbucket_ray'];
const TITLES = {
  shooter: ['ranked grind to top 500, no breaks', 'new season day one, clutch or kick', 'solo queue therapy session', '1v5 or I eat a lemon'],
  chatting: ['just chatting + reacting to your clips', 'morning coffee and bad takes', 'storytime: the worst flight of my life', 'Q&A, ask me anything (within reason)'],
  racing: ['wet track, no assists, pray for me', 'chasing a sub-1:30 lap tonight', 'endurance race hour 6 of 12'],
  strategy: ['late game comeback attempts only', 'teaching chat the opening that wins', 'one more turn, I promise'],
  music: ['live beats, requests open', 'making a track from your messages', 'late night synth session'],
  art: ['painting chat\'s pets, $0 commissions', 'speed sketch challenge, 10 min each', 'cozy drawing stream'],
  irl: ['walking the night market', 'first time in the city, guide me', 'street food tier list live'],
  board: ['blitz until I win three in a row', 'puzzles with chat, loser picks music', 'grinding rated, tilt meter rising'],
};
const LANGS = ['en', 'en', 'en', 'en', 'es', 'es', 'pt', 'de', 'fr', 'ja', 'ko', 'it', 'tr', 'ru'];
const CLIP_TITLES = ['he did NOT see that coming', 'chat called it 10 seconds early', 'the loudest scream on the internet', 'perfect timing, zero planning', 'this is why we never trust the bridge', 'the comeback nobody believed in', 'the cat walked on the keyboard mid-fight', 'one frame from disaster', 'he read chat out loud. mistake.', 'the 200 IQ play (accidental)', 'lag at the worst possible moment', 'speechless for 9 full seconds'];

// ── Streams ───────────────────────────────────────────────
const streams = [];
for (let i = 0; i < 40; i++) {
  const scene = SCENE_KEYS[i % SCENE_KEYS.length], p = PALETTES[i % PALETTES.length];
  const platform = i % 3 === 1 ? 'kick' : 'twitch'; rnd();
  const name = NAMES[i];
  streams.push({
    platform, id: String(41000 + i * 7), name, login: name.toLowerCase(), title: pick(TITLES[scene]),
    viewers: Math.round(61000 / (i + 1) ** 0.95 * range(0.85, 1.15)), startedAt: iso(now - range(18, 420) * 60000),
    language: LANGS[i % LANGS.length], url: `https://www.${platform === 'twitch' ? 'twitch.tv' : 'kick.com'}/${name.toLowerCase()}`,
    avatar: `./preview/img/avatar-${String(i).padStart(2, '0')}.webp`, thumbnail: `./preview/img/live-${String(i).padStart(2, '0')}.webp`,
    _scene: scene, _p: p,
  });
}
streams.sort((a, b) => b.viewers - a.viewers);
await Promise.all(streams.map((s) => img(s.thumbnail.split('/').pop(), 880, 496, svg(880, 496, s._scene, s._p))));
await Promise.all(streams.map((s, i) => {
  const p = s._p;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient></defs>
    <rect width="128" height="128" fill="url(#g)"/><circle cx="96" cy="30" r="20" fill="${p[2]}" opacity=".6"/>
    <text x="64" y="84" text-anchor="middle" font-family="Helvetica, Arial" font-weight="700" font-size="54" fill="${p[3]}">${s.name[0].toUpperCase()}</text></svg>`)).webp({ quality: 80 }).toFile(`${I}/${s.avatar.split('/').pop()}`);
}));

writeFileSync(`${D}/live.json`, JSON.stringify({ generatedAt: iso(now - 3 * 60000), category: 'Just Chatting', streams: streams.map(({ _scene, _p, ...s }) => s) }));
writeFileSync(`${D}/streamers.json`, JSON.stringify({ generatedAt: iso(now), streamers: streams.map((s, i) => ({
  platform: s.platform, id: s.id, name: s.name, login: s.login, avatar: s.avatar, language: s.language,
  broadcasterType: s.platform === 'twitch' ? (i < 9 ? 'partner' : i % 3 ? 'affiliate' : '') : '',
})) }));

// ── History: 7 days every 10 minutes ──────────────────────
const hist = [];
for (let t = now - 7 * 86400000; t <= now; t += 10 * 60000) {
  const h = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
  const day = 1 + 0.06 * Math.sin(t / 86400000 * 0.9), cycle = 0.62 + 0.38 * Math.sin(((h - 8) / 24) * Math.PI * 2);
  const tw = Math.round(560000 * cycle * day * range(0.97, 1.03)), kk = Math.round(210000 * (0.6 + 0.4 * Math.sin(((h - 10) / 24) * Math.PI * 2)) * day * range(0.95, 1.05));
  hist.push({ t: iso(t), viewers: tw + kk, streams: Math.round(300 * cycle + 40), twitch: tw, kick: kk });
}
writeFileSync(`${D}/history.json`, JSON.stringify(hist));

// ── Clips ─────────────────────────────────────────────────
const clips = [];
for (let i = 0; i < 24; i++) {
  const s = streams.filter((x) => x.platform === 'twitch')[i % 14];
  const file = `clip-${String(i).padStart(2, '0')}.webp`;
  await img(file, 480, 272, svg(480, 272, s._scene, PALETTES[(i + 3) % PALETTES.length]));
  clips.push({ id: `PreviewClip${i}`, url: `https://clips.twitch.tv/PreviewClip${i}`, embedUrl: `https://clips.twitch.tv/embed?clip=PreviewClip${i}`,
    title: CLIP_TITLES[i % CLIP_TITLES.length], broadcaster: s.name, creator: `${pick(['clip', 'cut', 'snip', 'trim'])}${pick(['_lord', 'master', '_queen', 'ster', '_bot9'])}${Math.floor(range(1, 99))}`,
    views: Math.round(184000 / (i + 1) ** 1.05 * range(0.9, 1.1)), createdAt: iso(now - range(0.5, 23.5) * 3600000), thumbnail: `./preview/img/${file}`, duration: +range(8, 58).toFixed(1), language: s.language });
}
clips.sort((a, b) => b.views - a.views);
writeFileSync(`${D}/clips.json`, JSON.stringify({ generatedAt: iso(now - 12 * 60000), clips }));

// ── Vertical: Shorts and TikTok ───────────────────────────
const shorts = [], feed = [];
for (let i = 0; i < 12; i++) {
  const file = `short-${String(i).padStart(2, '0')}.webp`;
  await img(file, 360, 640, svg(360, 640, SCENE_KEYS[(i + 2) % SCENE_KEYS.length], PALETTES[(i + 5) % PALETTES.length], { withCam: false, vertical: true }));
  shorts.push({ id: `preview${i}`, title: `${CLIP_TITLES[(i + 4) % CLIP_TITLES.length]} #shorts`, channel: `${NAMES[(i * 3) % 40]} clips`, views: Math.round(2400000 / (i + 1) ** 0.9), publishedAt: iso(now - range(3, 160) * 3600000), thumbnail: `./preview/img/${file}`, duration: Math.round(range(14, 59)) });
}
for (let i = 0; i < 10; i++) {
  const file = `tt-${String(i).padStart(2, '0')}.webp`;
  await img(file, 360, 640, svg(360, 640, SCENE_KEYS[(i + 5) % SCENE_KEYS.length], PALETTES[(i + 1) % PALETTES.length], { withCam: false, vertical: true }));
  const author = `${pick(['clipsby', 'daily', 'best', 'raw'])}${pick(['moments', 'cuts', 'streamclips', 'highlights'])}${i}`;
  feed.push({ url: `https://www.tiktok.com/@${author}/video/${7300000000000000000 + i * 1234567}`, addedAt: iso(now - i * 5 * 3600000), title: `${CLIP_TITLES[(i + 7) % CLIP_TITLES.length]} 😭 #streamer #clips`.replace(' 😭', ''), author: `@${author}`, authorUrl: `https://www.tiktok.com/@${author}`, thumbnail: `./preview/img/${file}` });
}
writeFileSync(`${D}/shorts.json`, JSON.stringify({ generatedAt: iso(now - 40 * 60000), query: 'Just Chatting', shorts }));
writeFileSync(`${D}/feed.json`, JSON.stringify(feed));

// ── Contacts and partners ─────────────────────────────────
writeFileSync(`${D}/contacts.json`, JSON.stringify(streams.slice(0, 6).map((s) => ({ platform: s.platform, id: s.id, name: s.name, links: [{ label: 'Business links', url: `https://linktr.ee/${s.login}` }] }))));
writeFileSync(`${D}/partners.json`, JSON.stringify([streams[3], streams[7]].map((s) => ({ platform: s.platform, id: s.id }))));
writeFileSync(`${D}/blocklist.json`, '[]');

// ── Ledger: 30 days of payments, run through the real eligibility rules ──
const wallet = () => Keypair.generate().publicKey.toBase58();
const sig = () => bs58.encode(Uint8Array.from({ length: 64 }, () => Math.floor(rnd() * 256)));
const streamerWallets = Array.from({ length: 9 }, wallet), clipperWallets = Array.from({ length: 16 }, wallet);
const receipts = [];
for (let d = 29; d >= 0; d--) {
  const n = Math.max(0, Math.round(range(0, 3.2) + (29 - d) / 9));
  for (let k = 0; k < n; k++) {
    const payee = pick(clipperWallets.slice(0, 6 + Math.floor((29 - d) / 3)));
    const payer = rnd() < 0.04 ? payee : pick(streamerWallets);
    const price = rnd() < 0.08 ? 0.02 : +pick([0.05, 0.1, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 0.75, 1, 1.5]).toFixed(2);
    receipts.push({ signature: sig(), blockTime: Math.floor((now - d * 86400000 - range(0, 20) * 3600000) / 1000), payer, payee, lamports: Math.round(price * 1e9), clipId: Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('') });
  }
}
receipts.sort((a, b) => b.blockTime - a.blockTime);
const rules = { CASHBACK_BPS: 350, MIN_PRICE_SOL: 0.05, DELAY_HOURS: 24, PER_PAYMENT_CAP_SOL: 0.5, PER_DAY_CAP_SOL: 2, PAIR_DAILY_COUNT: 3, TREASURY_RESERVE_SOL: 0.1 };
const nowS = Math.floor(now / 1000);
const st = evaluate(receipts, { rules, now: nowS, blocklist: [], payouts: [], treasuryLamports: null });
// due cashback older than one payout cycle counts as paid
const payouts = receipts.filter((r) => { const s = st.get(r.signature); return s.status === 'waiting' && s.due && nowS - s.dueAt > 3 * 3600; })
  .map((r) => ({ paymentSig: r.signature, payoutSig: sig(), clipId: r.clipId, clipper: r.payee, lamports: st.get(r.signature).lamports, at: iso((st.get(r.signature).dueAt + 3 * 3600) * 1000) }));
writeFileSync(`${D}/cashback.json`, JSON.stringify(payouts));
writeFileSync(`${D}/paused.json`, '{"paused":false}');
writeFileSync(`${D}/ledger.json`, JSON.stringify({ treasury: 18_430_000_000, treasuryWallet: PREVIEW_TREASURY, reference: PREVIEW_REFERENCE, receipts }));
console.log(`preview: ${streams.length} streams, ${clips.length} clips, ${shorts.length} shorts, ${feed.length} TikToks, ${receipts.length} receipts, ${payouts.length} payouts`);
