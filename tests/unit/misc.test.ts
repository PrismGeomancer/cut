import { describe, it, expect } from 'vitest';
import { parsePayLink, buildPayLink, isPublicKey } from '../../src/lib/payLink';
import { pitch } from '../../src/lib/pitch';
import { rmsWindows, pickPeaks, envelope } from '../../src/editor/loudness';
import { linear, niceTicks, linePath, areaPath, stack, barPath, nearest } from '../../src/charts/scale';
import { toCsv } from '../../src/lib/csv';
import { buildArgs } from '../../src/editor/export';
import { parseSession } from '../../src/lib/tiktokSession';

const W = '11111111111111111111111111111111'; // the system program id is a valid public key
const W2 = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

describe('pay links', () => {
  it('validates keys', () => {
    expect(isPublicKey(W)).toBe(true);
    expect(isPublicKey(W2)).toBe(true);
    expect(isPublicKey('0OIl' + W2.slice(4))).toBe(false);
    expect(isPublicKey('abc')).toBe(false);
  });
  it('accepts a valid link and round-trips', () => {
    const link = buildPayLink('https://x.github.io/cut/', W2, 'https://www.tiktok.com/@a/video/1', '0.25');
    const p = parsePayLink(new URLSearchParams(link.split('?')[1]));
    expect(p).toEqual({ ok: true, to: W2, clip: 'https://www.tiktok.com/@a/video/1', lamports: 250_000_000, price: '0.25' });
  });
  it('rejects bad parameters', () => {
    const p = parsePayLink(new URLSearchParams({ to: 'nope', clip: 'http://x.com/a', price: '0' }));
    expect(p).toEqual({ ok: false, errors: ['to', 'clip', 'price'] });
    expect(parsePayLink(new URLSearchParams({ to: W2, clip: 'https://a.b/c', price: '-1' }))).toMatchObject({ ok: false, errors: ['price'] });
  });
});

describe('pitch', () => {
  it('fills the name and keeps the promise honest', () => {
    const t = pitch('Ana');
    expect(t.startsWith('Hi Ana. I clip your streams for TikTok.')).toBe(true);
    expect(t).toContain('3.5% cashback on eligible payments');
    expect(t).not.toMatch(/guarantee/i);
  });
});

describe('loudness', () => {
  it('finds the loud bursts in a synthetic signal with spacing', () => {
    const sr = 8000, sec = 30, s = new Float32Array(sr * sec);
    for (let i = 0; i < s.length; i++) s[i] = 0.02 * Math.sin(i / 3);
    const burst = (t: number, amp: number) => { for (let i = 0; i < sr * 0.5; i++) s[Math.floor(t * sr) + i] = amp * Math.sin(i / 2); };
    burst(5, 0.9); burst(5.3, 0.8); burst(15, 0.6); burst(25, 0.7);
    const rms = rmsWindows(s, sr, 0.25);
    expect(rms.length).toBe(120);
    const peaks = pickPeaks(rms, { count: 5, minSpacing: 8 }).map((i) => i * 0.25);
    expect(peaks.length).toBe(3);
    expect(peaks[0]).toBeGreaterThanOrEqual(5); expect(peaks[0]).toBeLessThan(6);
    expect(peaks[1]).toBeGreaterThanOrEqual(15); expect(peaks[2]).toBeGreaterThanOrEqual(25);
  });
  it('marks nothing in steady noise', () => {
    const rms = new Float32Array(200).fill(0.1);
    expect(pickPeaks(rms)).toEqual([]);
  });
  it('normalises the envelope', () => {
    const e = envelope(new Float32Array([0, 0.5, 1, 0.25]), 2);
    expect(Array.from(e)).toEqual([0.5, 1]);
  });
});

describe('chart scales and paths', () => {
  it('linear maps domain to range', () => {
    const x = linear([0, 10], [100, 200]);
    expect(x(0)).toBe(100); expect(x(5)).toBe(150); expect(x(10)).toBe(200);
  });
  it('nice ticks cover the max', () => {
    expect(niceTicks(0, 87, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0, 1_234_000, 4)).toEqual([0, 500000, 1000000, 1500000]);
    expect(niceTicks(0, 0, 4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
  it('stacks series bottom-up', () => {
    expect(stack([[1, 2], [3, 4]])).toEqual([[[0, 1], [0, 2]], [[1, 4], [2, 6]]]);
  });
  it('builds paths', () => {
    expect(linePath([[0, 0], [10, 5]])).toBe('M0.0,0.0L10.0,5.0');
    expect(areaPath([[0, 0], [10, 0]], [[0, 10], [10, 10]])).toBe('M0.0,0.0L10.0,0.0L10.0,10.0L0.0,10.0Z');
    expect(barPath(0, 0, 0, 10)).toBe('');
    expect(barPath(0, 0, 20, 10, 4, 'h')).toContain('Q20,0 20,4');
    expect(barPath(0, 0, 2, 10, 4, 'h')).toContain('Q2,0 2,2'); // radius shrinks for short bars
  });
  it('finds the nearest index', () => { expect(nearest([0, 10, 20], 14)).toBe(1); });
});

describe('csv', () => {
  it('quotes and neutralises formulas', () => {
    const csv = toCsv([{ a: 'x,y', b: '=HYPERLINK("e")', c: 'say "hi"' }], [{ header: 'A', get: (r) => r.a }, { header: 'B', get: (r) => r.b }, { header: 'C', get: (r) => r.c }]);
    expect(csv).toBe('A,B,C\r\n"x,y","\'=HYPERLINK(""e"")","say ""hi"""');
  });
});

describe('export args', () => {
  it('builds a 1080x1920 H.264 veryfast + AAC + faststart command', () => {
    const a = buildArgs({ inT: 10, outT: 25, frame: 'blur', corner: 'br', look: { contrast: 1.1, saturation: 1, grain: 0.2, vignette: 0.5, speed: 1.25 }, captions: [{ id: '1', start: 12, end: 14, text: 'hi' }], hasAudio: true }, 'in.mp4');
    const s = a.join(' ');
    expect(a.slice(0, 6)).toEqual(['-ss', '10.000', '-to', '25.000', '-i', 'in.mp4']);
    expect(s).toContain('-i cap0.png');
    expect(s).toContain("enable='between(t,1.60,3.20)'");
    expect(s).toContain('-preset veryfast');
    expect(s).toContain('-c:a aac');
    expect(s).toContain('+faststart');
    expect(s).toContain('atempo=1.25');
    expect(s).toContain('1080:1920');
  });
});

describe('tiktok session', () => {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  it('reads a signed session and checks expiry', () => {
    const tok = `${enc({ open_id: 'o', display_name: 'Cutter', avatar_url: '', exp: 2_000_000_000 })}.c2ln`;
    expect(parseSession(tok, 1_700_000_000_000)).toMatchObject({ open_id: 'o', display_name: 'Cutter' });
    expect(parseSession(`${enc({ open_id: 'o', exp: 1 })}.c2ln`, Date.now())).toBeNull();
    expect(parseSession('garbage', Date.now())).toBeNull();
  });
});
