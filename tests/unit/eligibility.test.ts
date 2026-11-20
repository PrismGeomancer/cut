import { describe, it, expect } from 'vitest';
import { evaluate, hoursLeft, type Rules, type Payout } from '../../src/lib/eligibility';
import type { Receipt } from '../../src/lib/receipts';

const rules: Rules = { CASHBACK_BPS: 350, MIN_PRICE_SOL: 0.05, DELAY_HOURS: 24, PER_PAYMENT_CAP_SOL: 0.5, PER_DAY_CAP_SOL: 2, PAIR_DAILY_COUNT: 3, TREASURY_RESERVE_SOL: 0.1 };
const T0 = Date.UTC(2026, 10, 1, 12) / 1000;
const SOL = 1e9;
let n = 0;
const r = (o: Partial<Receipt> = {}): Receipt => ({ signature: `sig${++n}`, blockTime: T0, payer: 'Streamer', payee: 'Clipper', lamports: 1 * SOL, clipId: `clip${n}`.padEnd(12, '0'), ...o });
const ctx = (o: any = {}) => ({ rules, now: T0 + 25 * 3600, blocklist: [], payouts: [] as Payout[], treasuryLamports: 100 * SOL, ...o });

describe('eligibility', () => {
  it('waits for the delay, then is due', () => {
    const a = r();
    const early = evaluate([a], ctx({ now: T0 + 3600 })).get(a.signature)!;
    expect(early).toMatchObject({ status: 'waiting', due: false, lamports: 0.035 * SOL });
    expect(hoursLeft(early as any, T0 + 3600)).toBe(23);
    expect(evaluate([a], ctx()).get(a.signature)).toMatchObject({ status: 'waiting', due: true });
  });
  it('self-payment never earns', () => {
    const a = r({ payer: 'X', payee: 'X' });
    expect(evaluate([a], ctx()).get(a.signature)).toMatchObject({ status: 'not eligible', reason: 'same wallet' });
  });
  it('blocked wallets never earn (payer or payee)', () => {
    const a = r({ payee: 'Bad' }), b = r({ payer: 'Bad' });
    const m = evaluate([a, b], ctx({ blocklist: ['Bad'] }));
    expect(m.get(a.signature)).toMatchObject({ reason: 'blocked' });
    expect(m.get(b.signature)).toMatchObject({ reason: 'blocked' });
  });
  it('enforces the minimum price', () => {
    const a = r({ lamports: 0.049 * SOL }), b = r({ lamports: 0.05 * SOL });
    const m = evaluate([a, b], ctx());
    expect(m.get(a.signature)).toMatchObject({ reason: 'below the minimum' });
    expect(m.get(b.signature)).toMatchObject({ status: 'waiting', lamports: 1_750_000 });
  });
  it('each clip earns once, on its first valid payment', () => {
    const a = r({ clipId: 'aaaaaaaaaaaa', blockTime: T0 }), b = r({ clipId: 'aaaaaaaaaaaa', blockTime: T0 + 60 });
    const m = evaluate([b, a], ctx());
    expect(m.get(a.signature)).toMatchObject({ status: 'waiting' });
    expect(m.get(b.signature)).toMatchObject({ reason: 'already paid' });
  });
  it('caps each payment', () => {
    const a = r({ lamports: 50 * SOL });
    expect(evaluate([a], ctx()).get(a.signature)).toMatchObject({ lamports: 0.5 * SOL });
  });
  it('caps a clipper per day (partial, then over the cap)', () => {
    const big = (i: number) => r({ lamports: 20 * SOL, payer: `S${i}`, blockTime: T0 + i });
    const list = [big(1), big(2), big(3), big(4), big(5)];
    const m = evaluate(list, ctx());
    const amounts = list.map((x) => m.get(x.signature)!.lamports);
    expect(amounts).toEqual([0.5, 0.5, 0.5, 0.5, 0].map((v) => v * SOL));
    expect(m.get(list[4].signature)).toMatchObject({ reason: 'over the cap' });
    // next UTC day resets
    const next = r({ lamports: 20 * SOL, payer: 'S9', blockTime: T0 + 86400 });
    expect(evaluate([...list, next], ctx({ now: T0 + 3 * 86400 })).get(next.signature)).toMatchObject({ status: 'waiting', lamports: 0.5 * SOL });
  });
  it('caps payments per streamer and clipper pair per day', () => {
    const list = [1, 2, 3, 4].map((i) => r({ blockTime: T0 + i }));
    const m = evaluate(list, ctx());
    expect(list.map((x) => m.get(x.signature)!.status)).toEqual(['waiting', 'waiting', 'waiting', 'not eligible']);
    expect(m.get(list[3].signature)).toMatchObject({ reason: 'over the cap' });
  });
  it('pauses when the treasury minus the reserve cannot cover it', () => {
    const a = r(), b = r({ payer: 'S2' });
    const m = evaluate([a, b], ctx({ treasuryLamports: 0.1 * SOL + 0.04 * SOL }));
    expect(m.get(a.signature)).toMatchObject({ status: 'waiting', due: true });
    expect(m.get(b.signature)).toMatchObject({ reason: 'treasury empty' });
    // not yet due: not affected by the treasury
    const c = r({ blockTime: T0 + 24 * 3600 });
    expect(evaluate([c], ctx({ treasuryLamports: 0 })).get(c.signature)).toMatchObject({ status: 'waiting', due: false });
  });
  it('a recorded payout is paid and counts against the caps', () => {
    const a = r({ clipId: 'bbbbbbbbbbbb' }), b = r({ clipId: 'bbbbbbbbbbbb', blockTime: T0 + 5 });
    const payouts = [{ paymentSig: a.signature, payoutSig: 'P', clipId: a.clipId, clipper: 'Clipper', lamports: 35_000_000, at: '' }];
    const m = evaluate([a, b], ctx({ payouts }));
    expect(m.get(a.signature)).toEqual({ status: 'paid', lamports: 35_000_000, payoutSig: 'P' });
    expect(m.get(b.signature)).toMatchObject({ reason: 'already paid' });
  });
});
