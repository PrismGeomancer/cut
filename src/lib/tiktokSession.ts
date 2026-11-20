// The Worker signs { open_id, display_name, avatar_url, exp } with HMAC-SHA256 and hands it to
// #/post?session=<payload>.<sig>. The browser can't check the HMAC (the key stays in the Worker);
// it only reads the payload and the expiry. A session proves a TikTok login and nothing else.
import { getJSON, remove, setJSON } from './storage';
import { PREVIEW } from '../preview';

export interface TikTokSession { open_id: string; display_name: string; avatar_url: string; exp: number; token: string }
const KEY = 'tiktok:session';

const b64urlDecode = (s: string) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return decodeURIComponent(escape(atob(pad)));
};

export function parseSession(token: string, now = Date.now()): TikTokSession | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !/^[\w-]+$/.test(sig)) return null;
  try {
    const p = JSON.parse(b64urlDecode(payload));
    if (typeof p.open_id !== 'string' || typeof p.exp !== 'number' || p.exp * 1000 < now) return null;
    return { open_id: p.open_id, display_name: String(p.display_name ?? ''), avatar_url: String(p.avatar_url ?? ''), exp: p.exp, token };
  } catch { return null; }
}

export function currentSession(): TikTokSession | null {
  const s = getJSON<TikTokSession | null>(KEY, null);
  if (PREVIEW && !s && getJSON('tiktok:preview-out', false) === false) return { open_id: 'preview', display_name: 'cutter.preview', avatar_url: '', exp: Date.now() / 1000 + 86400, token: '' };
  return s && s.exp * 1000 > Date.now() ? s : null;
}
export function saveSession(token: string): TikTokSession | null {
  const s = parseSession(token);
  if (s) setJSON(KEY, s);
  return s;
}
export const logout = () => { remove(KEY); if (PREVIEW) setJSON('tiktok:preview-out', true); };
