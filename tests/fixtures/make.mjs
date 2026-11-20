// TEST-ONLY fixtures for layout review and Playwright. Never shipped: not in src/ or public/.
// Names are obviously synthetic ("Fixture 01") so they can't be mistaken for real channels.
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
const D = 'tests/fixtures/data'; mkdirSync(D, { recursive: true }); mkdirSync('tests/fixtures/img', { recursive: true });
const now = Date.now(), iso = (t) => new Date(t).toISOString();
const langs = ['en', 'en', 'es', 'pt', 'de', 'fr', 'en', 'ru', 'ja', 'it'];
const streams = Array.from({ length: 24 }, (_, i) => ({
  platform: i % 3 === 2 ? 'kick' : 'twitch', id: String(1000 + i), name: `Fixture${String(i + 1).padStart(2, '0')}`, login: `fixture${i + 1}`,
  title: `Fixture stream title number ${i + 1} with a longer line so truncation shows`, viewers: Math.round(52000 / (i + 1) ** 0.9),
  startedAt: iso(now - (i * 17 + 40) * 60000), language: langs[i % langs.length], url: `https://www.twitch.tv/fixture${i + 1}`,
  avatar: `https://fixture.test/img/a${i % 6}.png`, thumbnail: `https://fixture.test/img/t${i % 8}.png`,
}));
writeFileSync(`${D}/live.json`, JSON.stringify({ generatedAt: iso(now - 4 * 60000), category: 'Fixture', streams }));
writeFileSync(`${D}/streamers.json`, JSON.stringify({ generatedAt: iso(now), streamers: streams.map((s, i) => ({ platform: s.platform, id: s.id, name: s.name, login: s.login, avatar: s.avatar, broadcasterType: s.platform === 'twitch' ? (i % 4 === 0 ? 'partner' : i % 4 === 1 ? 'affiliate' : '') : '', language: s.language })) }));
const hist = [];
for (let t = now - 7 * 86400000; t <= now; t += 30 * 60000) {
  const h = new Date(t).getUTCHours(), base = 180000 + 90000 * Math.sin(((h - 6) / 24) * Math.PI * 2);
  const tw = Math.round(base * (1 + 0.08 * Math.sin(t / 9e6))), kk = Math.round(base * 0.38 * (1 + 0.1 * Math.cos(t / 7e6)));
  hist.push({ t: iso(t), viewers: tw + kk, streams: 300, twitch: tw, kick: kk });
}
writeFileSync(`${D}/history.json`, JSON.stringify(hist));
writeFileSync(`${D}/clips.json`, JSON.stringify({ generatedAt: iso(now), clips: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, url: `https://clips.twitch.tv/c${i}`, embedUrl: `https://clips.twitch.tv/embed?clip=c${i}`, title: `Fixture clip ${i + 1}: the moment everyone clipped`, broadcaster: streams[i % 6].name, creator: `clipper_${i + 1}`, views: Math.round(98000 / (i + 1) ** 1.1), createdAt: iso(now - (i + 1) * 3600000), thumbnail: `https://fixture.test/img/t${(i + 3) % 8}.png`, duration: 12 + i * 3.3, language: 'en' })) }));
writeFileSync(`${D}/shorts.json`, JSON.stringify({ generatedAt: iso(now), shorts: Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, title: `Fixture short ${i + 1}`, channel: `Channel ${i + 1}`, views: 400000 / (i + 1), publishedAt: iso(now - i * 86400000), thumbnail: `https://fixture.test/img/v${i % 4}.png` })) }));
writeFileSync(`${D}/cashback.json`, '[]'); writeFileSync(`${D}/paused.json`, '{"paused":false}');
const tones = ['#3b4a5a', '#5a4a3b', '#2f5246', '#4b3f5e', '#5e5a3a', '#3a3f4a', '#56423f', '#34505a'];
for (let i = 0; i < 8; i++) await sharp({ create: { width: 440, height: 248, channels: 3, background: tones[i] } }).composite([{ input: Buffer.from(`<svg width="440" height="248"><rect x="40" y="150" width="220" height="60" fill="#ffffff22"/><circle cx="360" cy="70" r="40" fill="#00000033"/></svg>`) }]).png().toFile(`tests/fixtures/img/t${i}.png`);
for (let i = 0; i < 6; i++) await sharp({ create: { width: 64, height: 64, channels: 3, background: tones[i + 1] } }).png().toFile(`tests/fixtures/img/a${i}.png`);
for (let i = 0; i < 4; i++) await sharp({ create: { width: 270, height: 480, channels: 3, background: tones[i + 2] } }).png().toFile(`tests/fixtures/img/v${i}.png`);
console.log('fixtures written');
