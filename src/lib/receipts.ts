import type { Connection, ParsedTransactionWithMeta } from '@solana/web3.js';
import { parseMemo, parseCashbackMemo } from './memo';

export const MEMO_PROGRAMS = new Set([
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
]);
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';

export interface Receipt {
  signature: string;
  blockTime: number; // unix seconds
  payer: string;     // the streamer
  payee: string;     // the clipper
  lamports: number;
  clipId: string;
}

type AnyIx = { programId: { toString(): string } | string; program?: string; parsed?: any };
const pid = (ix: AnyIx) => (typeof ix.programId === 'string' ? ix.programId : ix.programId.toString());
const key = (k: any) => (typeof k === 'string' ? k : k?.pubkey?.toString?.() ?? k?.toString?.());

/**
 * A transaction counts only if: it succeeded, it has a cut:v1: memo, exactly one
 * System transfer, and the reference key is present as a read-only, non-signer account.
 * Anything else returns null and is ignored.
 */
export function verifyTransaction(tx: ParsedTransactionWithMeta | null | undefined, signature: string, referenceKey: string): Receipt | null {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const ixs = (tx.transaction?.message?.instructions ?? []) as AnyIx[];

  const transfers = ixs.filter((ix) => pid(ix) === SYSTEM_PROGRAM);
  if (transfers.length !== 1) return null;
  const t = transfers[0].parsed;
  if (!t || t.type !== 'transfer' || !t.info) return null;

  const memos = ixs.filter((ix) => MEMO_PROGRAMS.has(pid(ix)));
  if (memos.length !== 1) return null;
  const memoText = typeof memos[0].parsed === 'string' ? memos[0].parsed : null;
  const clipId = parseMemo(memoText);
  if (!clipId) return null;

  const accounts = (tx.transaction.message.accountKeys ?? []) as any[];
  const ref = accounts.find((a) => key(a) === referenceKey);
  if (!ref || ref.signer || ref.writable) return null;

  const lamports = Number(t.info.lamports);
  if (!Number.isSafeInteger(lamports) || lamports <= 0) return null;
  return {
    signature,
    blockTime: tx.blockTime ?? 0,
    payer: String(t.info.source),
    payee: String(t.info.destination),
    lamports,
    clipId,
  };
}

/** For the treasury's history: which payment signatures already have a cashback memo. */
export function cashbackMemoTarget(tx: ParsedTransactionWithMeta | null | undefined): string | null {
  if (!tx || !tx.meta || tx.meta.err) return null;
  for (const ix of (tx.transaction.message.instructions ?? []) as AnyIx[]) {
    if (MEMO_PROGRAMS.has(pid(ix)) && typeof ix.parsed === 'string') {
      const sig = parseCashbackMemo(ix.parsed);
      if (sig) return sig;
    }
  }
  return null;
}

/** One page of receipts, newest first. Pass `before` from the previous page to continue. */
export async function fetchReceipts(conn: Connection, referenceKey: string, opts: { before?: string; limit?: number } = {}) {
  const { PublicKey } = await import('@solana/web3.js');
  const sigs = await conn.getSignaturesForAddress(new PublicKey(referenceKey), { before: opts.before, limit: opts.limit ?? 100 });
  const ok = sigs.filter((s) => !s.err);
  const txs: (ParsedTransactionWithMeta | null)[] = [];
  for (let i = 0; i < ok.length; i += 10) {
    const chunk = ok.slice(i, i + 10);
    const got = await Promise.all(chunk.map((s) => conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })));
    txs.push(...got);
  }
  const receipts = ok.map((s, i) => verifyTransaction(txs[i], s.signature, referenceKey)).filter((r): r is Receipt => !!r);
  return { receipts, nextBefore: sigs.length === (opts.limit ?? 100) ? sigs[sigs.length - 1].signature : undefined };
}

/** Walks every page (the payout script and the Earn page use this). */
export async function fetchAllReceipts(conn: Connection, referenceKey: string, maxPages = 20): Promise<Receipt[]> {
  const all: Receipt[] = [];
  let before: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchReceipts(conn, referenceKey, { before });
    all.push(...page.receipts);
    if (!page.nextBefore) break;
    before = page.nextBefore;
  }
  return all;
}
