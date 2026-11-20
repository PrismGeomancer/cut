// Injected Solana wallets (Phantom, Solflare, Backpack and any provider exposing the same shape).
type Provider = {
  publicKey?: { toString(): string } | null;
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } } | void>;
  disconnect(): Promise<void>;
  signTransaction?(tx: any): Promise<any>;
  signAndSendTransaction?(tx: any): Promise<{ signature: string }>;
  on?(ev: string, cb: (...a: any[]) => void): void;
};

const listeners = new Set<(pk: string | null) => void>();
let current: string | null = null;

export function provider(): Provider | null {
  const w = window as any;
  return w.phantom?.solana ?? w.solflare ?? w.backpack ?? w.solana ?? null;
}
export const hasWallet = () => !!provider();
export const walletKey = () => current;
export function onWallet(cb: (pk: string | null) => void) { listeners.add(cb); return () => listeners.delete(cb); }
const emit = () => listeners.forEach((l) => l(current));

export async function connect(): Promise<string | null> {
  const p = provider();
  if (!p) return null;
  const r = await p.connect();
  current = (r && 'publicKey' in r ? r.publicKey : p.publicKey)?.toString() ?? null;
  emit();
  return current;
}
export async function disconnect() {
  try { await provider()?.disconnect(); } finally { current = null; emit(); }
}
export async function reconnectIfTrusted() {
  const p = provider();
  if (!p) return;
  try {
    const r = await p.connect({ onlyIfTrusted: true });
    current = (r && 'publicKey' in r ? r.publicKey : p.publicKey)?.toString() ?? null;
    emit();
  } catch { /* not trusted yet */ }
}
