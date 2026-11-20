import { CONFIG } from '../config';
import { buildMemo, clipIdFromUrl } from './memo';
import { provider } from './wallet';

export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

let conn: any = null;
export async function connection() {
  const { Connection } = await import('@solana/web3.js');
  conn ??= new Connection(CONFIG.RPC_URL, 'confirmed');
  return conn as import('@solana/web3.js').Connection;
}

/**
 * One transaction signed by the streamer:
 *  1. SystemProgram.transfer streamer -> clipper for exactly the price,
 *     carrying REFERENCE_KEY as an extra read-only, non-signer account (Solana Pay reference).
 *  2. Memo cut:v1:<clipId>.
 * The streamer pays the price and the network fee. Nothing else.
 */
export async function buildPaymentTx(payer: string, to: string, lamports: number, clipUrl: string) {
  const web3 = await import('@solana/web3.js');
  const clipId = await clipIdFromUrl(clipUrl);
  if (!clipId) throw new Error('clip');
  const transfer = web3.SystemProgram.transfer({ fromPubkey: new web3.PublicKey(payer), toPubkey: new web3.PublicKey(to), lamports });
  transfer.keys.push({ pubkey: new web3.PublicKey(CONFIG.REFERENCE_KEY), isSigner: false, isWritable: false });
  const memo = new web3.TransactionInstruction({
    programId: new web3.PublicKey(MEMO_PROGRAM_ID),
    keys: [],
    data: new TextEncoder().encode(buildMemo(clipId)) as any,
  });
  const c = await connection();
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
  const tx = new web3.Transaction({ feePayer: new web3.PublicKey(payer), blockhash, lastValidBlockHeight }).add(transfer, memo);
  return { tx, clipId, blockhash, lastValidBlockHeight };
}

export async function signAndSend(payer: string, to: string, lamports: number, clipUrl: string): Promise<string> {
  const p = provider();
  if (!p) throw new Error('no wallet');
  const { tx, blockhash, lastValidBlockHeight } = await buildPaymentTx(payer, to, lamports, clipUrl);
  const c = await connection();
  let signature: string;
  if (p.signAndSendTransaction) {
    signature = (await p.signAndSendTransaction(tx)).signature;
  } else if (p.signTransaction) {
    const signed = await p.signTransaction(tx);
    signature = await c.sendRawTransaction(signed.serialize());
  } else throw new Error('wallet cannot sign');
  await c.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  return signature;
}

export async function balance(address: string): Promise<number | null> {
  if (!address) return null;
  try {
    const { PublicKey } = await import('@solana/web3.js');
    return await (await connection()).getBalance(new PublicKey(address), 'confirmed');
  } catch { return null; }
}

export const solscanTx = (sig: string) => `https://solscan.io/tx/${encodeURIComponent(sig)}`;
export const solscanAccount = (a: string) => `https://solscan.io/account/${encodeURIComponent(a)}`;
