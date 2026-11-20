// CUT TikTok login (Cloudflare Worker). The only non-static piece of CUT.
// Secrets (wrangler secret put): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, SESSION_SECRET
// Var: SITE_URL (e.g. https://you.github.io/cut/)
// The access token is used once to read the basic profile, then discarded. It never reaches the browser.

const AUTHORIZE = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const USERINFO = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name';
const WEEK = 7 * 24 * 3600;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(new TextEncoder().encode(s));

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

function back(env, query) {
  const site = env.SITE_URL.replace(/#.*$/, '');
  return Response.redirect(`${site}#/post?${query}`, 302);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const redirectUri = `${url.origin}/callback`;

    if (url.pathname === '/login') {
      const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
      const auth = new URL(AUTHORIZE);
      auth.search = new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, scope: 'user.info.basic', response_type: 'code', redirect_uri: redirectUri, state }).toString();
      return new Response(null, {
        status: 302,
        headers: { Location: auth.toString(), 'Set-Cookie': `cut_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=600` },
      });
    }

    if (url.pathname === '/callback') {
      const cookie = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)cut_state=([\w-]+)/)?.[1];
      const state = url.searchParams.get('state'), code = url.searchParams.get('code');
      if (!cookie || !state || cookie !== state || !code || url.searchParams.get('error')) return back(env, 'error=login');

      const tokenRes = await fetch(TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
        body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
      });
      const token = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !token.access_token) return back(env, 'error=token');

      const userRes = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token.access_token}` } });
      const user = (await userRes.json().catch(() => ({})))?.data?.user;
      // tokens go out of scope here; nothing stores them
      if (!userRes.ok || !user?.open_id) return back(env, 'error=user');

      const payload = b64urlText(JSON.stringify({
        open_id: user.open_id, display_name: user.display_name ?? '', avatar_url: user.avatar_url ?? '',
        exp: Math.floor(Date.now() / 1000) + WEEK,
      }));
      const signed = `${payload}.${await hmac(env.SESSION_SECRET, payload)}`;
      const res = back(env, `session=${signed}`);
      const out = new Response(null, res);
      out.headers.append('Set-Cookie', 'cut_state=; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=0');
      return out;
    }

    return new Response('Not found', { status: 404 });
  },
};
