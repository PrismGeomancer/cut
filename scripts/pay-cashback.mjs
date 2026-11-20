// Cashback payout. Run by payout.yml every 3 hours with `tsx` so it shares the site's TypeScript.
// DRY RUN unless PAYOUT_LIVE=true. The treasury key comes from TREASURY_SECRET_KEY and is
// never logged and never written anywhere.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { CONFIG } from '../src/config.ts';
import { evaluate } from '../src/lib/eligibility.ts';
import { fetchAllReceipts, cashbackMemoTarget } from '../src/lib/receipts.ts';
import { buildCashbackMemo } from '../src/lib/memo.ts';
import { solToLamports } from '../src/lib/fees.ts';

const OUT = process.env.OUT_DIR || 'data-out';
const LIVE = process.env.PAYOUT_LIVE === 'true';
const cfg = { ...CONFIG };
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const read = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };

if (!cfg.REFERENCE_KEY || !cfg.TREASURY_WALLET) { console.log('REFERENCE_KEY and TREASURY_WALLET are required. Nothing to do.'); process.exit(0); }
if (read(join(OUT, 'paused.json'), { paused: false }).paused) { console.log('Kill switch: paused.json says paused. Nothing sent.'); process.exit(0); }

const conn = new Connection(cfg.RPC_URL, 'confirmed');
const treasury = new PublicKey(cfg.TREASURY_WALLET);
const ledgerFile = join(OUT, 'cashback.json');
const payouts = read(ledgerFile, []);
const blocklist = read('public/data/blocklist.json', []);

// Idempotency, part 2: payment signatures already answered by a memo in the treasury's history.
const answered = new Set(payouts.map((p) => p.paymentSig));
const recent = await conn.getSignaturesForAddress(treasury, { limit: 500 });
for (const s of recent) {
  if (s.err || !s.memo?.includes('cut:v1:cb:')) continue;
  const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
  const target = cashbackMemoTarget(tx);
  if (target) answered.add(target);
}

const receipts = await fetchAllReceipts(conn, cfg.REFERENCE_KEY, 20);
const balance = await conn.getBalance(treasury, 'confirmed');
const now = Math.floor(Date.now() / 1000);
const statuses = evaluate(receipts, { rules: cfg, now, blocklist, payouts, treasuryLamports: balance });

const due = receipts
  .map((r) => ({ r, s: statuses.get(r.signature) }))
  .filter(({ r, s }) => s?.status === 'waiting' && s.due && !answered.has(r.signature))
  .sort((a, b) => a.r.blockTime - b.r.blockTime);

const maxRun = solToLamports(cfg.MAX_PER_RUN_SOL);
let spent = 0;
console.log(`${receipts.length} receipts, ${due.length} due, treasury ${balance} lamports, ${LIVE ? 'LIVE' : 'dry run'}`);

let signer = null;
if (LIVE && due.length) {
  const raw = process.env.TREASURY_SECRET_KEY;
  if (!raw) { console.error('TREASURY_SECRET_KEY is not set.'); process.exit(1); }
  signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  if (!signer.publicKey.equals(treasury)) { console.error('The secret key does not match TREASURY_WALLET.'); process.exit(1); }
}

for (const { r, s } of due) {
  if (spent + s.lamports > maxRun) { console.log(`MAX_PER_RUN_SOL reached at ${spent} lamports.`); break; }
  console.log(`${LIVE ? 'pay' : 'would pay'} ${s.lamports} lamports to ${r.payee} for ${r.signature}`);
  if (!LIVE) { spent += s.lamports; continue; }
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: treasury, toPubkey: new PublicKey(r.payee), lamports: s.lamports }),
    new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(buildCashbackMemo(r.signature)) }),
  );
  try {
    const payoutSig = await sendAndConfirmTransaction(conn, tx, [signer], { commitment: 'confirmed' });
    payouts.push({ paymentSig: r.signature, payoutSig, clipId: r.clipId, clipper: r.payee, lamports: s.lamports, at: new Date().toISOString() });
    writeFileSync(ledgerFile, JSON.stringify(payouts)); // after every payout, so a crash can't double pay
    spent += s.lamports;
  } catch (e) {
    console.error(`payout failed for ${r.signature}: ${e.message}`);
    break;
  }
}
if (!existsSync(ledgerFile)) writeFileSync(ledgerFile, JSON.stringify(payouts));
console.log(`${LIVE ? 'paid' : 'would pay'} ${spent} lamports in total`);
