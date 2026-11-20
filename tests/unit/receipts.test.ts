import { describe, it, expect } from 'vitest';
import { verifyTransaction, SYSTEM_PROGRAM, cashbackMemoTarget } from '../../src/lib/receipts';

const REF = 'Ref1111111111111111111111111111111111111111';
const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const tx = (over: any = {}) => ({
  blockTime: 1_700_000_000,
  meta: { err: null },
  transaction: {
    message: {
      accountKeys: [
        { pubkey: 'Payer', signer: true, writable: true },
        { pubkey: 'Payee', signer: false, writable: true },
        { pubkey: REF, signer: false, writable: false },
      ],
      instructions: [
        { programId: SYSTEM_PROGRAM, program: 'system', parsed: { type: 'transfer', info: { source: 'Payer', destination: 'Payee', lamports: 100_000_000 } } },
        { programId: MEMO, program: 'spl-memo', parsed: 'cut:v1:0123456789ab' },
      ],
    },
  },
  ...over,
});

describe('receipt verifier', () => {
  it('accepts a valid payment', () => {
    expect(verifyTransaction(tx() as any, 'sig', REF)).toEqual({ signature: 'sig', blockTime: 1_700_000_000, payer: 'Payer', payee: 'Payee', lamports: 100_000_000, clipId: '0123456789ab' });
  });
  it('allows compute budget instructions', () => {
    const t = tx(); t.transaction.message.instructions.unshift({ programId: 'ComputeBudget111111111111111111111111111111', parsed: undefined } as any);
    expect(verifyTransaction(t as any, 's', REF)).not.toBeNull();
  });
  it('ignores wrong shapes', () => {
    const failed = tx({ meta: { err: { InstructionError: [0, 'x'] } } });
    const noMemo = tx(); noMemo.transaction.message.instructions.pop();
    const badMemo = tx(); (badMemo.transaction.message.instructions[1] as any).parsed = 'hello';
    const twoTransfers = tx(); twoTransfers.transaction.message.instructions.push({ ...twoTransfers.transaction.message.instructions[0] });
    const noRef = tx(); noRef.transaction.message.accountKeys.pop();
    const refSigner = tx(); (refSigner.transaction.message.accountKeys[2] as any).signer = true;
    const refWritable = tx(); (refWritable.transaction.message.accountKeys[2] as any).writable = true;
    const notTransfer = tx(); (notTransfer.transaction.message.instructions[0] as any).parsed.type = 'createAccount';
    const twoMemos = tx(); twoMemos.transaction.message.instructions.push({ ...twoMemos.transaction.message.instructions[1] });
    for (const t of [failed, noMemo, badMemo, twoTransfers, noRef, refSigner, refWritable, notTransfer, twoMemos, null]) expect(verifyTransaction(t as any, 's', REF)).toBeNull();
  });
  it('finds the payment a cashback memo answers', () => {
    const sig = '4'.repeat(87);
    const t = tx(); (t.transaction.message.instructions[1] as any).parsed = `cut:v1:cb:${sig}`;
    expect(cashbackMemoTarget(t as any)).toBe(sig);
    expect(cashbackMemoTarget(tx() as any)).toBeNull();
  });
});
