// Pure. Used by the site, the payout script and the tests. No I/O, no clock reads.
import type { Receipt } from './receipts';
import { cashbackLamports, solToLamports } from './fees';

export interface Rules {
  CASHBACK_BPS: number;
  MIN_PRICE_SOL: number;
  DELAY_HOURS: number;
  PER_PAYMENT_CAP_SOL: number;
  PER_DAY_CAP_SOL: number;
  PAIR_DAILY_COUNT: number;
  TREASURY_RESERVE_SOL: number;
}

export interface Payout { paymentSig: string; payoutSig: string; clipId: string; clipper: string; lamports: number; at: string }

export type Reason = 'same wallet' | 'over the cap' | 'already paid' | 'below the minimum' | 'treasury empty' | 'blocked';

export type Status =
  | { status: 'paid'; lamports: number; payoutSig: string }
  | { status: 'waiting'; lamports: number; dueAt: number; due: boolean } // dueAt in unix seconds
  | { status: 'not eligible'; reason: Reason; lamports: 0 };

export interface Context {
  rules: Rules;
  now: number;                    // unix seconds
  blocklist: string[];
  payouts: Payout[];              // cashback.json
  treasuryLamports: number | null; // null = unknown (treated as able to cover)
}

const day = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

/**
 * One status per receipt. Receipts are processed oldest first so "first valid payment"
 * and the daily caps are deterministic regardless of the order they were fetched in.
 */
export function evaluate(receipts: Receipt[], ctx: Context): Map<string, Status> {
  const { rules } = ctx;
  const out = new Map<string, Status>();
  const paidBySig = new Map(ctx.payouts.map((p) => [p.paymentSig, p]));
  const blocked = new Set(ctx.blocklist);
  const minLamports = solToLamports(rules.MIN_PRICE_SOL);
  const perPaymentCap = solToLamports(rules.PER_PAYMENT_CAP_SOL);
  const perDayCap = solToLamports(rules.PER_DAY_CAP_SOL);
  const delay = rules.DELAY_HOURS * 3600;

  const clipEarned = new Set<string>();
  const clipperDay = new Map<string, number>(); // clipper|day -> lamports committed
  const pairDay = new Map<string, number>();    // payer|payee|day -> count committed

  // Treasury budget available for due, unpaid cashback.
  let budget = ctx.treasuryLamports === null ? Infinity : Math.max(0, ctx.treasuryLamports - solToLamports(rules.TREASURY_RESERVE_SOL));

  const ordered = [...receipts].sort((a, b) => a.blockTime - b.blockTime || a.signature.localeCompare(b.signature));
  for (const r of ordered) {
    const no = (reason: Reason): Status => ({ status: 'not eligible', reason, lamports: 0 });
    const payout = paidBySig.get(r.signature);

    if (!payout) {
      if (blocked.has(r.payer) || blocked.has(r.payee)) { out.set(r.signature, no('blocked')); continue; }
      if (r.payer === r.payee) { out.set(r.signature, no('same wallet')); continue; }
      if (r.lamports < minLamports) { out.set(r.signature, no('below the minimum')); continue; }
      if (clipEarned.has(r.clipId)) { out.set(r.signature, no('already paid')); continue; }
    }

    const d = day(r.blockTime);
    const ck = `${r.payee}|${d}`, pk = `${r.payer}|${r.payee}|${d}`;
    let amount = cashbackLamports(r.lamports, rules.CASHBACK_BPS, perPaymentCap);

    if (payout) {
      // A payout on chain is a fact; count it against the caps and move on.
      clipEarned.add(r.clipId);
      clipperDay.set(ck, (clipperDay.get(ck) ?? 0) + payout.lamports);
      pairDay.set(pk, (pairDay.get(pk) ?? 0) + 1);
      out.set(r.signature, { status: 'paid', lamports: payout.lamports, payoutSig: payout.payoutSig });
      continue;
    }

    if ((pairDay.get(pk) ?? 0) >= rules.PAIR_DAILY_COUNT) { out.set(r.signature, no('over the cap')); continue; }
    const left = perDayCap - (clipperDay.get(ck) ?? 0);
    if (left <= 0) { out.set(r.signature, no('over the cap')); continue; }
    amount = Math.min(amount, left);

    const dueAt = r.blockTime + delay;
    const due = ctx.now >= dueAt;
    if (due) {
      if (budget < amount) { out.set(r.signature, no('treasury empty')); continue; }
      budget -= amount;
    }
    clipEarned.add(r.clipId);
    clipperDay.set(ck, (clipperDay.get(ck) ?? 0) + amount);
    pairDay.set(pk, (pairDay.get(pk) ?? 0) + 1);
    out.set(r.signature, { status: 'waiting', lamports: amount, dueAt, due });
  }
  return out;
}

/** Hours until a waiting payment is checked, rounded up (0 once due). */
export const hoursLeft = (s: Extract<Status, { status: 'waiting' }>, now: number) => Math.max(0, Math.ceil((s.dueAt - now) / 3600));
