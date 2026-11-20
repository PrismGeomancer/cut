import { CONFIG } from '../config';
import { loadData } from './data';
import { evaluate, type Payout, type Status } from './eligibility';
import { fetchAllReceipts, type Receipt } from './receipts';
import { balance, connection } from './payment';
import { loadLocal, fetchJson } from './data';
import { PREVIEW, PREVIEW_BASE } from '../preview';

export interface Ledger {
  receipts: Receipt[];
  statuses: Map<string, Status>;
  payouts: Payout[];
  treasury: number | null; // lamports
  paused: boolean;
  error: boolean;
}

let cached: Promise<Ledger> | null = null;

/** Everything the Earn page and the Desk need, read from Solana and the data branch. */
export function loadLedger(force = false): Promise<Ledger> {
  if (cached && !force) return cached;
  cached = (async () => {
    if (PREVIEW) {
      // preview mode: a generated ledger instead of the chain
      let [l, payouts] = await Promise.all([fetchJson<{ treasury: number; receipts: Receipt[] }>(`${PREVIEW_BASE}/ledger.json`), fetchJson<Payout[]>(`${PREVIEW_BASE}/cashback.json`)]);
      // the sample ledger is frozen in time: slide receipts and payouts together so "last 30 days" and the 24 h delay still make sense
      const delta = Math.floor(Date.now() / 1000) - Math.max(...l.receipts.map((r) => r.blockTime));
      l.receipts = l.receipts.map((r) => ({ ...r, blockTime: r.blockTime + delta }));
      payouts = payouts.map((x) => ({ ...x, at: new Date(Date.parse(x.at) + delta * 1000).toISOString() }));
      const statuses = evaluate(l.receipts, { rules: CONFIG, now: Math.floor(Date.now() / 1000), blocklist: [], payouts, treasuryLamports: l.treasury });
      return { receipts: l.receipts, statuses, payouts, treasury: l.treasury, paused: false, error: false };
    }
    const [cb, paused, blocklist, treasury] = await Promise.all([
      loadData<Payout[]>('cashback.json'),
      loadData<{ paused: boolean }>('paused.json'),
      loadLocal<string[]>('blocklist.json', []),
      balance(CONFIG.TREASURY_WALLET),
    ]);
    const payouts = cb.state === 'ok' || cb.state === 'snapshot' ? cb.data : [];
    const isPaused = (paused.state === 'ok' || paused.state === 'snapshot') && !!paused.data?.paused;
    let receipts: Receipt[] = [];
    let error = false;
    if (CONFIG.REFERENCE_KEY) {
      try { receipts = await fetchAllReceipts(await connection(), CONFIG.REFERENCE_KEY, 5); } catch { error = true; }
    }
    const statuses = evaluate(receipts, {
      rules: CONFIG, now: Math.floor(Date.now() / 1000), blocklist, payouts,
      treasuryLamports: treasury,
    });
    return { receipts, statuses, payouts, treasury, paused: isPaused, error };
  })();
  return cached;
}

export function ledgerTotals(l: Ledger) {
  let waiting = 0;
  for (const s of l.statuses.values()) if (s.status === 'waiting') waiting += s.lamports;
  const paidOut = l.payouts.reduce((a, p) => a + p.lamports, 0);
  const last = l.payouts.map((p) => p.at).sort().at(-1) ?? '';
  const reserve = Math.round(CONFIG.TREASURY_RESERVE_SOL * 1e9);
  const empty = l.treasury !== null && l.treasury - reserve <= 0;
  return { waiting, paidOut, last, empty: empty || l.paused };
}

/** Sum per UTC day for the last `days` days, oldest first, zero days included. */
export function perDay<T>(items: T[], at: (t: T) => number, value: (t: T) => number, days = 30, now = Date.now()) {
  const out: { day: string; t: number; value: number }[] = [];
  const end = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const t = end - i * 86400000;
    const day = new Date(t).toISOString().slice(0, 10);
    idx.set(day, out.length);
    out.push({ day, t, value: 0 });
  }
  for (const it of items) {
    const d = new Date(at(it)).toISOString().slice(0, 10);
    const i = idx.get(d);
    if (i !== undefined) out[i].value += value(it);
  }
  return out;
}
