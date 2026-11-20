import { fetchJson, loadData } from './data';
import { getJSON, setJSON } from './storage';

// DexScreener (keyless): GET /token-boosts/top/v1, GET /tokens/v1/solana/{addresses<=30}
// Jupiter (keyless):     GET https://lite-api.jup.ag/price/v3?ids=<mint>
const DEX = 'https://api.dexscreener.com';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface MarketRow {
  address: string; symbol: string; name: string; icon: string; priceUsd: number;
  change24h: number; volume24h: number; liquidity: number; marketCap: number; url: string;
}
export interface Market { generatedAt: string; rows: MarketRow[]; source: 'live' | 'snapshot' }

function bestPairs(pairs: any[]): MarketRow[] {
  const best = new Map<string, any>();
  for (const p of pairs) {
    if (p?.chainId !== 'solana' || !p.baseToken?.address) continue;
    const a = p.baseToken.address;
    if (!best.has(a) || (p.liquidity?.usd ?? 0) > (best.get(a).liquidity?.usd ?? 0)) best.set(a, p);
  }
  return [...best.values()].map((p) => ({
    address: p.baseToken.address,
    symbol: String(p.baseToken.symbol ?? ''),
    name: String(p.baseToken.name ?? ''),
    icon: p.info?.imageUrl ?? '',
    priceUsd: Number(p.priceUsd ?? 0),
    change24h: Number(p.priceChange?.h24 ?? 0),
    volume24h: Number(p.volume?.h24 ?? 0),
    liquidity: Number(p.liquidity?.usd ?? 0),
    marketCap: Number(p.marketCap ?? p.fdv ?? 0),
    url: String(p.url ?? ''),
  }));
}

export async function tokenPairs(addresses: string[]): Promise<MarketRow[]> {
  if (!addresses.length) return [];
  const pairs = await fetchJson<any[]>(`${DEX}/tokens/v1/solana/${addresses.slice(0, 30).join(',')}`);
  return bestPairs(pairs);
}

/** Trending: top boosted Solana tokens, ranked by 24 h volume. */
export async function loadMarket(limit = 12): Promise<Market | null> {
  try {
    const boosts = await fetchJson<any[]>(`${DEX}/token-boosts/top/v1`);
    const addrs = [...new Set(boosts.filter((b) => b.chainId === 'solana').map((b) => b.tokenAddress as string))].slice(0, 30);
    const rows = (await tokenPairs(addrs)).sort((a, b) => b.volume24h - a.volume24h).slice(0, limit);
    const m: Market = { generatedAt: new Date().toISOString(), rows, source: 'live' };
    setJSON('snap:market', m);
    return m;
  } catch {
    // CORS or network failure: the Action's snapshot, then this browser's last good copy
    const snap = await loadData<{ generatedAt: string; rows: MarketRow[] }>('market.json');
    if (snap.state === 'ok' || snap.state === 'snapshot') return { ...snap.data, rows: snap.data.rows.slice(0, limit), source: 'snapshot' };
    const local = getJSON<Market | null>('snap:market', null);
    return local ? { ...local, source: 'snapshot' } : null;
  }
}

export async function solPrice(): Promise<number | null> {
  try {
    const r = await fetchJson<Record<string, { usdPrice: number }>>(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
    const p = r?.[SOL_MINT]?.usdPrice;
    return typeof p === 'number' && isFinite(p) ? p : null;
  } catch { return null; }
}
