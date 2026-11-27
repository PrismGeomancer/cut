import { PREVIEW, PREVIEW_BASE, PREVIEW_TREASURY, PREVIEW_REFERENCE } from './preview';

// Every empty value hides whatever needs it (button, link, strip, line of copy).
// Edit the defaults here, or set VITE_<NAME> at build time (deploy.yml passes repository variables).
const DEFAULTS = {
  CONTRACT_ADDRESS: '', X_URL: 'https://x.com/CUT_editor_', TELEGRAM_URL: '', REPO_URL: '', CHART_URL: '',
  TREASURY_WALLET: '', REFERENCE_KEY: '',
  RPC_URL: 'https://api.mainnet-beta.solana.com',
  TIKTOK_AUTH_WORKER_URL: '', DATA_BASE_URL: '',
  LIVE_CATEGORY: '',
  CASHBACK_BPS: 350, MIN_PRICE_SOL: 0.05, DELAY_HOURS: 24,
  PER_PAYMENT_CAP_SOL: 0.5, PER_DAY_CAP_SOL: 2, PAIR_DAILY_COUNT: 3,
  TREASURY_RESERVE_SOL: 0.1, MAX_PER_RUN_SOL: 2,
};

const env: Record<string, string | undefined> = (import.meta as any).env ?? (globalThis as any).process?.env ?? {};
function withEnv<T extends Record<string, string | number>>(d: T): T {
  const out: Record<string, string | number> = { ...d };
  for (const k of Object.keys(d)) {
    const v = env[`VITE_${k}`] ?? (globalThis as any).process?.env?.[k];
    if (v === undefined || v === '') continue;
    out[k] = typeof d[k] === 'number' ? Number(v) : v;
  }
  return out as T;
}
export const CONFIG = withEnv(DEFAULTS);
if (PREVIEW) Object.assign(CONFIG, { DATA_BASE_URL: PREVIEW_BASE, TREASURY_WALLET: PREVIEW_TREASURY, REFERENCE_KEY: PREVIEW_REFERENCE, LIVE_CATEGORY: CONFIG.LIVE_CATEGORY || 'Just Chatting' });
export type Config = typeof CONFIG;
