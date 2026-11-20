// Memo format: cut:v1:<clipId> on payments, cut:v1:cb:<paymentSignature> on cashback payouts.
export const MEMO_PREFIX = 'cut:v1:';
export const CB_PREFIX = 'cut:v1:cb:';

/**
 * Normalise a clip URL so the same clip always gives the same id:
 * https only, lower-case host without "www.", no hash, no trailing slash,
 * query dropped except YouTube's "v" (the video id lives there).
 */
export function normaliseClipUrl(input: string): string | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  let path = u.pathname.replace(/\/+$/, '') || '/';
  let query = '';
  if ((host === 'youtube.com' || host === 'm.youtube.com') && u.searchParams.get('v')) query = `?v=${u.searchParams.get('v')}`;
  return `https://${host}${path}${query}`;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** First 12 hex characters of SHA-256 of the normalised URL. */
export async function clipIdFromUrl(url: string): Promise<string | null> {
  const n = normaliseClipUrl(url);
  return n ? (await sha256Hex(n)).slice(0, 12) : null;
}

export const buildMemo = (clipId: string) => `${MEMO_PREFIX}${clipId}`;
export const buildCashbackMemo = (paymentSig: string) => `${CB_PREFIX}${paymentSig}`;

/** Returns the clipId, or null if this isn't a CUT payment memo. */
export function parseMemo(memo: string | null | undefined): string | null {
  if (!memo) return null;
  const m = /^cut:v1:([0-9a-f]{12})$/.exec(memo.trim());
  return m ? m[1] : null;
}
export function parseCashbackMemo(memo: string | null | undefined): string | null {
  if (!memo) return null;
  const m = /^cut:v1:cb:([1-9A-HJ-NP-Za-km-z]{64,90})$/.exec(memo.trim());
  return m ? m[1] : null;
}
