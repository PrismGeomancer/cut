import { describe, it, expect } from 'vitest';
import { normaliseClipUrl, clipIdFromUrl, buildMemo, parseMemo, buildCashbackMemo, parseCashbackMemo } from '../../src/lib/memo';

describe('memo', () => {
  it('normalises clip URLs', () => {
    expect(normaliseClipUrl('https://www.TikTok.com/@a/video/123/?is_from_webapp=1#x')).toBe('https://tiktok.com/@a/video/123');
    expect(normaliseClipUrl('https://www.youtube.com/watch?v=abc&t=10')).toBe('https://youtube.com/watch?v=abc');
    expect(normaliseClipUrl('http://tiktok.com/@a/video/1')).toBeNull();
    expect(normaliseClipUrl('not a url')).toBeNull();
  });
  it('gives the same 12-hex id for equivalent URLs', async () => {
    const a = await clipIdFromUrl('https://www.tiktok.com/@a/video/123');
    const b = await clipIdFromUrl('https://tiktok.com/@a/video/123/?x=1');
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(a).toBe(b);
    expect(await clipIdFromUrl('https://tiktok.com/@a/video/124')).not.toBe(a);
  });
  it('builds and parses', () => {
    expect(buildMemo('0123456789ab')).toBe('cut:v1:0123456789ab');
    expect(parseMemo('cut:v1:0123456789ab')).toBe('0123456789ab');
    for (const m of ['cut:v2:0123456789ab', 'cut:v1:0123456789', 'cut:v1:0123456789AB', 'hello', '', null]) expect(parseMemo(m as any)).toBeNull();
    const sig = '5'.repeat(88);
    expect(parseCashbackMemo(buildCashbackMemo(sig))).toBe(sig);
    expect(parseCashbackMemo('cut:v1:cb:0OIl')).toBeNull();
  });
});
