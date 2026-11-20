# CUT ($CUT)

A clipping desk on Solana. Cut clips of streamers' biggest moments in the browser, queue them for TikTok, and get paid on Solana. CUT adds a 3.5% cashback from its own treasury on eligible clip payments, **while the treasury has funds**.

Static site on GitHub Pages, plus one tiny Cloudflare Worker for TikTok login and two GitHub Actions for data and payouts.

## What works with no accounts at all

- **Cut** (the editor): import MP4/WebM, find loud moments, trim, frame (fill, blur background, stacked), captions, look, and export 1080×1920 H.264/AAC. Everything runs in your browser and nothing is uploaded.
- **Trending on Solana**: DexScreener (keyless, fetched in the browser).
- **SOL price** in the top strip: Jupiter price v3 (keyless).
- **Feed**: TikTok links that visitors paste in, played through TikTok's own embed.
- **Get paid**: building pay links.
- **Post** queue and reminders (stored in this browser). Logging in needs the Worker.

Everything else shows its designed empty state until it's configured. No panel ever shows invented rows.

## What needs credentials

| Piece | Needs |
|---|---|
| Live now, Viewers over time, Where they watch, Streamers | Twitch app (client ID and secret) and/or Kick app (client ID and secret) as Actions secrets, plus the `content` workflow |
| Top clips | Twitch app |
| Shorts | YouTube Data API key and `LIVE_CATEGORY` |
| Log in with TikTok | TikTok developer app and the deployed Worker |
| Pay a clipper and Receipts | `REFERENCE_KEY` (any public key with no private key behind it) |
| Treasury, cashback | A treasury wallet, `TREASURY_SECRET_KEY` and the `payout` workflow |

## Hard truths about static hosting

- **TikTok login needs a server secret.** TikTok exchanges the code for tokens server-side and the client secret stays server-side, so `/login` and `/callback` run on a Cloudflare Worker (`worker/tiktok-auth.js`). The access token is used once to read the basic profile and is then dropped. It never reaches the browser.
- **Twitch, Kick and YouTube need keys or app tokens.** A GitHub Actions cron calls them with Actions secrets and commits JSON to a `data` branch. The site reads those files. No secret is ever in the browser.
- **TikTok has no keyless discovery.** TikTok videos come from `public/data/feed.json` (curated and enriched through oEmbed) and from links visitors paste in. CUT does not scrape TikTok.
- **TikTok public posting needs an audited app.** CUT does not post for you. Post is a queue with reminders, and "Open TikTok upload" sends you to TikTok.
- **TikTok view counts** for your own videos need the Display API (`video.list`) and app review. v1 shows no TikTok view numbers.
- **GitHub Pages can't set COOP/COEP headers**, so the editor uses the single-threaded ffmpeg.wasm core, self-hosted in `/ffmpeg` (copied from `@ffmpeg/core` on install). Export is slower than native: a 15 s clip took about a minute in testing.
- **Subpath hosting:** Vite uses `base: './'` with hash routes, and there are no absolute asset paths. The e2e suite serves the build under `/cut/`.
- **TikTok cards load TikTok's own player on Play, one card at a time** (`https://www.tiktok.com/player/v1/{id}`). TikTok's oEmbed no longer returns cover images, so the card is set in type until then. Loading a player in every card at once gets visitors rate-limited by TikTok's CDN ("Access Denied"). Visitors in regions with a consent law see TikTok's cookie prompt inside the player once. Every card also has an "Open on TikTok" link.
- **TikTok oEmbed in the browser:** TikTok doesn't send CORS headers on oEmbed for arbitrary origins. When a visitor adds a link the site tries oEmbed, and if that's blocked it keeps the link and plays it through the embed alone. `validate-feed.mjs` enriches the curated feed server-side.
- **GitHub cron is best effort.** Runs can be late or skipped. The site shows "Updated {m} min ago" from `generatedAt`, and a stale strip after 30 minutes.

## Endpoints used (checked against current docs, November 2026)

- **Twitch:** `POST https://id.twitch.tv/oauth2/token` (client credentials), `GET /helix/games?name=`, `GET /helix/streams?game_id=&first=100&after=`, `GET /helix/clips?game_id=&started_at=&ended_at=&first=100` (returned by view count), `GET /helix/users?id=` (up to 100; `broadcaster_type` is `partner`, `affiliate` or empty). Thumbnails are `{width}x{height}` templates; the site asks for 440×248 on the wall and 880×496 in the hero.
- **Kick:** `POST https://id.kick.com/oauth/token` (client credentials), `GET https://api.kick.com/public/v2/categories?name=`, `GET https://api.kick.com/public/v2/livestreams?category_id=&limit=`. The v1 endpoints are deprecated. v2 livestreams come back **oldest first**, so the script sorts by `viewer_count`.
- **YouTube Data API:** `search.list` (`type=video&videoDuration=short&order=viewCount&publishedAfter=`), then `videos.list` (`part=contentDetails,statistics,snippet`). The current docs put `search.list` in its own Search Queries bucket at 1 unit per call, capped at 100 calls a day. CUT runs it hourly (24 calls a day).
- **TikTok:** authorize `https://www.tiktok.com/v2/auth/authorize/`, token `POST https://open.tiktokapis.com/v2/oauth/token/`, user `GET https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name` (scope `user.info.basic`), oEmbed `https://www.tiktok.com/oembed?url=`, and embeds through `blockquote.tiktok-embed` plus `https://www.tiktok.com/embed.js`, loaded once and only on demand.
- **DexScreener (keyless):** `GET /token-boosts/top/v1` and `GET /tokens/v1/solana/{up to 30 addresses}`. It sends `access-control-allow-origin: *`. The Action also writes `market.json` as a fallback in case CORS ever fails.
- **Jupiter (keyless):** `GET https://lite-api.jup.ag/price/v3?ids=So111…112` (v2 is retired).
- **Solana RPC:** `getSignaturesForAddress(REFERENCE_KEY)` and `getParsedTransaction`.

**YouTube Shorts filter:** search has no Shorts-only filter. `videoDuration=short` means under 4 minutes, so `fetch-content.mjs` reads each result's real duration from `videos.list` and keeps only videos of **60 seconds or less**.

## Setup

### 1. Repo and Pages

1. Push to `main`. In **Settings → Pages**, set Source to **GitHub Actions**. `deploy.yml` runs the tests, builds, and publishes `dist`.
2. Config comes from `src/config.ts` defaults, or from **repository variables** (Settings → Secrets and variables → Actions → Variables) that `deploy.yml` passes to the build as `VITE_*`. The variables are `CONTRACT_ADDRESS`, `X_URL`, `TELEGRAM_URL`, `REPO_URL`, `CHART_URL`, `TREASURY_WALLET`, `REFERENCE_KEY`, `RPC_URL`, `TIKTOK_AUTH_WORKER_URL`, `LIVE_CATEGORY` and `DATA_BASE_URL`. An empty value hides whatever needs it.
3. `DATA_BASE_URL` defaults to `https://raw.githubusercontent.com/<owner>/<repo>/data`, which serves CORS `*` and caches about 5 minutes.

### 2. The data branch and `content.yml`

- Actions secrets: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (dev.twitch.tv/console), `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` (kick.com developer settings), `YOUTUBE_API_KEY` (Google Cloud, YouTube Data API v3).
- Variable: `LIVE_CATEGORY`: one Twitch/Kick category name, or several separated by commas. For GTA: `Grand Theft Auto VI,Grand Theft Auto V,Grand Theft Auto IV,Grand Theft Auto: San Andreas,Grand Theft Auto: Vice City,Grand Theft Auto III`. Shorts search uses the first one. If it's empty, the live list is the top streams overall and clips come from the biggest stream's category. Shorts need it.
- Run the workflow once by hand (Actions → content → Run workflow). It creates the orphan `data` branch with `live.json`, `history.json`, `streamers.json`, `clips.json`, `shorts.json`, `market.json` and `paused.json`.
- Schedules: live and history every 10 minutes, clips every 30 minutes, shorts every 60 minutes, all in one workflow that branches on `github.event.schedule`.

### 3. TikTok Login (Worker)

1. At developers.tiktok.com, create an app, add **Login Kit** and the **user.info.basic** scope, and add the redirect URI `https://<your-worker>.workers.dev/callback`. Redirect URIs must be static https URLs with no query string.
2. `cd worker && npx wrangler deploy`, then `wrangler secret put TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` and `SESSION_SECRET` (a long random string). Set `SITE_URL` in `wrangler.toml`.
3. Set the `TIKTOK_AUTH_WORKER_URL` variable to the Worker's origin.
4. **Sandbox vs review:** while the app is in sandbox, only the TikTok accounts you add as **target users** (up to 10) can log in. Anyone else gets a TikTok error, which shows on Post as "TikTok login failed. Try again." To open login to everyone, submit the production app for review.
5. A session is an HMAC-signed `{open_id, display_name, avatar_url, exp}` valid for 7 days. It proves a TikTok login and nothing else. The browser reads it but can't verify the HMAC.

### 4. Payments and receipts

- Generate any keypair, throw away the private key, and set its public key as `REFERENCE_KEY`. Every CUT payment carries it as a read-only account, so receipts can be found with `getSignaturesForAddress`.
- A payment is one transaction: `SystemProgram.transfer` (streamer to clipper, exact price, plus the reference key) and the memo `cut:v1:<first 12 hex of SHA-256 of the normalised clip URL>`. The streamer pays the price and the network fee, nothing else.
- A receipt counts only if it succeeded, has exactly one System transfer, exactly one `cut:v1:` memo, and the reference key as a read-only non-signer.
- **RPC:** the public mainnet RPC rate-limits. If you use Helius (or similar), set `RPC_URL` and **restrict the key to your site's domain in the Helius dashboard**, because the key ships in the browser.

### 5. Cashback and the treasury

Rules are in `src/lib/eligibility.ts` (pure, tested), shared by the site and `scripts/pay-cashback.mjs`. The defaults are my calls:

| Rule | Default |
|---|---|
| Cashback | `floor(price × 350 / 10000)` lamports |
| Minimum price | `MIN_PRICE_SOL` 0.05 |
| Delay after payment | `DELAY_HOURS` 24 |
| Per payment cap | `PER_PAYMENT_CAP_SOL` 0.5 |
| Per clipper per UTC day | `PER_DAY_CAP_SOL` 2 (the last payment that day is paid in part) |
| Same streamer and clipper per day | `PAIR_DAILY_COUNT` 3 |
| Treasury reserve kept back | `TREASURY_RESERVE_SOL` 0.1 |
| Max paid per run | `MAX_PER_RUN_SOL` 2 |

Payer and payee must differ. Blocked wallets (`public/data/blocklist.json`) never earn. Each clip earns once, on its first otherwise-eligible payment. If the treasury minus the reserve can't cover a due cashback, its status is "treasury empty" and payout pauses. Clip payments are never affected.

**Self-payment and wash trading are the real risk** of a treasury-funded cashback. One person with two wallets can pay themselves through CUT and collect 3.5%. The caps, the delay, once-per-clip, the pair limit and the blocklist limit the damage. They don't remove it. Keep them.

**Payout script** (`payout.yml`, every 3 hours):

- **Dry run by default.** It sends only when the repository variable `PAYOUT_LIVE` is `true`.
- It's idempotent. It skips any payment already in `cashback.json` or already answered by a `cut:v1:cb:<paymentSignature>` memo in the treasury's recent history, and it writes the ledger after every payout.
- Kill switch: set `{"paused": true}` in `paused.json` on the data branch.
- The secret `TREASURY_SECRET_KEY` is the JSON byte array from `solana-keygen`. It's never logged and never written to a file, and the script refuses to run if the key doesn't match `TREASURY_WALLET`.

> **Warning.** Anyone who can edit workflows in this repo can read `TREASURY_SECRET_KEY`. Keep only a small float in the treasury wallet, and treat that float as money at risk. Protect `main` and limit who has write access.

### 6. Feed, contacts and partners (in the repo)

- `public/data/feed.json`: `[{ "url": "https://www.tiktok.com/@user/video/123…" }]`. Run `npm run validate:feed` to enrich entries through oEmbed and remove dead ones.
- `public/data/contacts.json`: `[{ "platform": "twitch", "name": "…", "links": [{ "label": "Business email page", "url": "https://…" }] }]`. Publicly listed business links only. Never scraped emails.
- `public/data/partners.json`: starts as `[]`. Add `{ "platform", "id" }` only for real, agreed partnerships. Nobody is shown as a CUT partner otherwise.
- `public/data/blocklist.json`: wallet addresses that never earn cashback.

## Stack notes

Vite + TypeScript, no UI framework. GSAP only for the hero cut. A small hand-written SVG chart layer lives in `src/charts`. `@solana/web3.js` v1 and `@ffmpeg/ffmpeg` 0.12 (single thread) are each loaded only on the route that needs them. Fonts are self-hosted: Archivo (variable, width and weight axes) and JetBrains Mono, which is used only for timecodes and addresses.

- **Logo:** `logo2.png` is the main logo. `npm run logo` (`scripts/make-logo.mjs`) turns its black background into transparency and writes `public/brand/` (top bar, favicons, touch icon, avatar, link preview).
- **Wallets:** the site talks to the injected Solana provider (Phantom, Solflare, Backpack) directly instead of using the wallet-adapter libraries, to keep the bundle small.
- **Editor captions:** captions are drawn to transparent PNGs in the browser and overlaid by ffmpeg, so no font file has to be loaded into ffmpeg.
- **Stacked frame:** this adds one control the deck doesn't name, "Facecam" (which corner of the source holds the camera), because the crop has to come from somewhere.

## Scripts

```
npm run dev            # local
npm test               # Vitest: fees, memo, receipts, eligibility, pay links, pitch, loudness, chart maths, CSV, export args, session
npm run e2e            # builds twice and runs Playwright under /cut/ (1440 and 320 px, empty states, pay form, chart tables, keyboard)
npm run build          # dist/
npm run fetch:content  # what content.yml runs (needs the secrets in env)
npm run pay:cashback   # what payout.yml runs (dry run unless PAYOUT_LIVE=true)
```

`tests/fixtures/` holds **test-only** data (named "Fixture01" and so on) that Playwright serves in place of the data branch, so layout and chart tests have rows to draw. It isn't in `src/` or `public/` and never ships.

## Word check

`grep -rinE "demo|sample|example|mock|placeholder|lorem|coming soon|gta|rockstar|vice city|moon|100x|guarantee|profit|airdrop|giveaway|reward|buyback|burn" src public dist` matches only:

- the HTML `placeholder` attribute
- `sampleRate` (the Web Audio API name)
- minified `@solana/web3.js` library code (`requestAirdrop`, `getInflationReward`, short identifiers)

None of these is UI text. Token names in Trending on Solana come from DexScreener at runtime and are shown as returned.
