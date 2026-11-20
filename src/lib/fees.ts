// All money math is integer lamports. Defined once, used by the site, the payout script and the tests.
export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Parse a decimal SOL string ("0.05", "1", "2.123456789") into lamports without floating point. */
export function parseSol(input: string | number): number | null {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,9})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const lamports = Number(whole) * LAMPORTS_PER_SOL + Number(frac.padEnd(9, '0'));
  return Number.isSafeInteger(lamports) ? lamports : null;
}

export const solToLamports = (sol: number) => Math.round(sol * LAMPORTS_PER_SOL);

export function lamportsToSolString(l: number): string {
  const whole = Math.floor(l / LAMPORTS_PER_SOL);
  const frac = String(l % LAMPORTS_PER_SOL).padStart(9, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

/** floor(price × bps / 10000), capped. */
export function cashbackLamports(priceLamports: number, bps: number, capLamports: number): number {
  if (priceLamports <= 0) return 0;
  // BigInt keeps the product exact for any price
  const raw = Number((BigInt(priceLamports) * BigInt(bps)) / 10000n);
  return Math.min(raw, capLamports);
}
