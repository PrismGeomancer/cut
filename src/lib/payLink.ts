import { parseSol } from './fees';
import { normaliseClipUrl } from './memo';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Structural check plus an on-curve-agnostic decode check via web3 when available. */
export function isPublicKey(s: string): boolean {
  if (!BASE58.test(s)) return false;
  // decode base58 to bytes and require exactly 32
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(ALPHA.indexOf(c));
  let bytes = 0;
  while (n > 0n) { n >>= 8n; bytes++; }
  const leading = s.match(/^1*/)![0].length;
  return bytes + leading === 32;
}

export type PayLink =
  | { ok: true; to: string; clip: string; lamports: number; price: string }
  | { ok: false; errors: ('to' | 'clip' | 'price')[] };

export function parsePayLink(params: URLSearchParams): PayLink {
  const to = (params.get('to') ?? '').trim();
  const clip = (params.get('clip') ?? '').trim();
  const price = (params.get('price') ?? '').trim();
  const errors: ('to' | 'clip' | 'price')[] = [];
  if (!isPublicKey(to)) errors.push('to');
  if (!normaliseClipUrl(clip)) errors.push('clip');
  const lamports = parseSol(price);
  if (lamports === null || lamports <= 0) errors.push('price');
  return errors.length ? { ok: false, errors } : { ok: true, to, clip, lamports: lamports!, price };
}

export function buildPayLink(siteBase: string, to: string, clip: string, price: string): string {
  const q = new URLSearchParams({ to, clip, price });
  return `${siteBase.replace(/#.*$/, '')}#/pay?${q.toString()}`;
}
