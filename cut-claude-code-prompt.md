# CUT: Claude Code build prompt (v2)

You are building **CUT** ($CUT), a Solana project among friends: a clipping desk. People cut clips of streamers' biggest moments in the browser, queue them for TikTok, and get paid on Solana. CUT adds a **3.5% cashback from its own treasury** on every clip a streamer pays for. The site is hosted on **GitHub Pages**, so there is no application server. Read the whole prompt before you start. All copy is in `cut-copy-deck.md`: use it word for word. The main logo is `logo2.png` (processed into `public/brand/` by `npm run logo`).

Tagline: **Cut the clip. Take your cut.**

## Priorities, in order

1. **The dashboard and the design.** The home page is a real, data-dense dashboard and the rest of the site is built from the same parts. It must look like a product made by a design studio, not a template. Spend your effort here first.
2. **Real data everywhere.** Every list, image and number comes from a live source. No sample rows, no placeholder images, no demo labels, and no fake data dressed up to avoid those words.
3. **Payments that really work** on Solana, with public receipts.
4. Everything else.

---

## 1. Hard truths about static hosting (design around them, say them in the README)

- **TikTok login needs a secret on a server.** TikTok's docs say the code is exchanged for tokens server-side and the client secret stays server-side. So the one non-static piece is a tiny **Cloudflare Worker** (free tier, about 60 lines) for `/login` and `/callback`. The access token never reaches the browser.
- **Twitch, Kick and YouTube need keys or app tokens.** A **GitHub Actions cron** calls them with secrets from Actions secrets and commits JSON to a `data` branch. The site reads those files. No secret ever goes in the browser.
- **Verify every endpoint against current docs before writing a fetcher**: Twitch (app token by client credentials, Get Games, Get Streams, Get Clips, Get Users), Kick (public API, app token, categories, livestreams), YouTube Data API (search, videos.list, quota), TikTok (Login Kit, oEmbed, embed), DexScreener (keyless), Jupiter price (keyless). List the exact paths you will use. Do not guess. Read each API's terms on caching and display and follow them.
- **TikTok has no keyless discovery.** TikTok videos come from `feed.json` (curated, enriched through TikTok's oEmbed) and from links visitors add. Do not scrape TikTok.
- **TikTok public posting needs an audited app.** Do not fake posting. Post is a queue with reminders.
- **View counts for a clipper's own TikToks** need the Display API (`video.list`) and app review. That is a later step. Do not show TikTok view numbers in v1.
- **GitHub Pages cannot set COOP/COEP headers**, so use single-threaded ffmpeg.wasm, self-hosted.
- **Subpath hosting.** `base: './'` in Vite and hash routing. No absolute asset paths.

## 2. Stack (my calls; change only with a reason you write in the README)

Vite + TypeScript, no UI framework. GSAP for the one hero moment and small transitions. A small hand-written SVG chart layer (no chart library) so every chart follows section 3 exactly. `@solana/web3.js`. `@ffmpeg/ffmpeg` single thread. Fonts self-hosted: **Archivo** (variable, with the width and weight axes, via `@fontsource-variable/archivo`) and one monospace (JetBrains Mono) used **only** for timecodes and wallet addresses. Tests: Vitest and Playwright.

---

## 3. Design (priority one)

### The brief to yourself
Subject: a video editing room. Its real vocabulary is the timeline, the slate with its diagonal stripes, the cut, the splice, timecode, waveform, the scopes on the monitor wall. The audience is clippers and streamers who live in editors and dashboards all day. The primary job of the home page is **to show, in one screen, what is happening right now and where the money is.**

I have two reference sites (one dark and one light). They are lists and card grids. Take only ideas: a live list with a Clip button, a trending row, a rules panel. **Do not copy their look, layout or wording.** No game logos, game imagery, palm trees, neon pink or purple, or Miami styling anywhere in the brand.

### Review against defaults (already done, keep these decisions)
The first draft was a near-black page with one vermilion accent, a serif italic accent word in each heading, a monospace face for small labels, numbered eyebrows and uppercase labels. Those are generic. The decisions below replace them.

- **No tinted near-black.** The surface is a cool graphite (`--bay`), chosen because editing bays are dark and cool, not warm.
- **Red is not an accent for decoration.** `--cut` red means exactly three things: the cut, the cashback, and the one primary action per screen. Nothing else is red.
- **Data has its own colours**, one per platform, validated (see below). So the page has a real colour system, not one accent.
- **No italicised word in headings.** The hero line is set in two lines and **physically cut** on the diagonal (the logo's cut); the second line slips right. Type treatment is the design.
- **No uppercase labels, no eyebrows, no middle-dot meta strings, no arrows on links.** Labels are sentence case. Numbers use tabular figures from Archivo. Monospace is only for timecodes and addresses.
- **No identical rounded cards.** Panels are separated by hairlines and by a one-step background change, with different scales and hierarchy. No shadows. No gradients. No glass.

### Tokens
```
--bay    #14171A   page surface
--panel  #1B1F23   raised areas (editor, tables, tooltips)
--line   #2A2F34   hairlines
--paper  #E8E4DA   primary text
--muted  #A19D93   secondary text
--faint  #6E6B64   decoration only (never carries text someone must read)
--cut    #E5352B   the cut, the cashback, one primary action per screen
--twitch #9085E9   chart slot 1
--kick   #199E70   chart slot 2
--yt     #C98500   chart slot 3
```
The three chart colours were run through the palette validator against `--bay` (dark mode, all pairs): lightness band, chroma, colour-blind separation (worst ΔE 8.4) and normal-vision separation (worst ΔE 19.8) all pass. **Re-run the validator if you change any of them.** The dashboard is **dark only** (editing bays are dark). Do not build a light theme.

Radius: 4 px on controls, 6 px on thumbnails, 0 on panels. Hairline borders. Focus ring: 2 px `--paper` with 2 px offset.

### Type
Archivo variable. Headings: weight 800, width 75 to 90 (condensed, like slate lettering), tight leading. Body and UI: weight 400 and 500, width 100. Scale: 12, 14, 16, 20, 28, 44, 72 (home hero). Line length under 80 characters. Numbers in tables and tiles: `font-variant-numeric: tabular-nums`.

### Layout concept: "The Desk" (home dashboard)
A 12-column grid, 1440 px design width, 24 px gutters. Panels have different spans and heights.

```
+--------------------------------------------------------------------------+
| transport bar: CUT   00:00:00:00(live clock)   Cut Post Radar ...  [Login]|
+--------------------------------------------------------------------------+
| Cut the clip.                         | now wall: 3 live thumbnails,      |
|        Take your cut.  (cut on diag)  | stacked like clips on a track     |
| [Open the editor] [See who's live]    | (name, viewers)                   |
+--------------------------------------------------------------------------+
| 312 live now | 1.2M watching | 100 clips 24h | 0.0 SOL treasury | 0 paid  |  <- ruled band
+--------------------------------------------------------------------------+
| Viewers over 24 h  (area, 8 cols)             | Where they watch (4 cols) |
|                                               | bars: platform, language  |
+--------------------------------------------------------------------------+
| Live now wall: 8 thumbnails, 4 across, image-led                         |
+--------------------------------------------------------------------------+
| Top clips (7 cols): thumb + title + view bar  | Payments per day (5 cols) |
|                                               | treasury figures          |
+--------------------------------------------------------------------------+
| Trending on Solana (table, full width)                                   |
+--------------------------------------------------------------------------+
| On TikTok (thumb row, 7 cols)  | Streamers to contact (5 cols, top 8)    |
+--------------------------------------------------------------------------+
| footer                                                                   |
+--------------------------------------------------------------------------+
```
(The numbers in the wireframe are layout hints, not content.) Left-aligned everywhere. Below 900 px the grid becomes one column, the ruled band becomes a two-column list, charts keep their form but shrink.

### The one memorable thing
The **hero cut**. On load, once: the headline sits whole, a red hairline playhead sweeps across it, and at the playhead the headline splits on the diagonal. The lower half slips right and settles. Then the `+3.5%` marker drops onto a thin `$` lane under the hero. It is the only autoplaying motion on the page. Everything else moves only in response to the visitor (hover, open, sort, filter). With `prefers-reduced-motion`, show the final state with no sweep.

### Images
Images do a lot of the work, and all of them are real:
- Live thumbnails (16:9) from the platform APIs. Request an appropriate size (about 440×248 for the wall, about 880×496 for the hero stack). Set `width` and `height`, `loading="lazy"`, `object-fit: cover`, 1 px `--line` border.
- Channel avatars (circles, 32 px) in tables.
- Clip and Shorts thumbnails (16:9). TikTok oEmbed thumbnails (vertical, cropped to 9:16 in a fixed-height row).
- If an image fails, show a `--panel` tile with the platform name in text. Never a stock image, never a blank.
- **Platforms are shown as a coloured dot plus the name in text.** Do not use Twitch, Kick, YouTube or TikTok logos. Use colour only in charts and the dot.

---

## 4. The Desk (dashboard): panel specs

Every panel is built from live data. If a source fails, show the last good snapshot with its age (copy deck, States). If there has never been a snapshot, show the designed empty state.

**Filter row** (above the first chart, one row, shared by every panel on the page): Platform (All, Twitch, Kick) and Range (6 h, 24 h, 7 d). Filters change what the panels show without repainting colours (colour follows the platform, never the rank).

**Ruled band (five figures).** Live now, watching, top clips in 24 h, treasury balance, payments verified. One band with hairline dividers, not five cards. Zero is shown as zero.

**Viewers over time.** Area chart, one series per platform if the filter is All, stacked with a 2 px surface gap between fills; otherwise one series. Source: `history.json` (the Action appends one point per run and keeps 7 days). Direct-label the peak. Hover shows a crosshair and a tooltip with time and values.

**Where they watch.** Two small horizontal bar charts: viewers by platform, and viewers by the six biggest languages. Bars have 4 px rounded data ends on the baseline, 2 px gaps. Direct labels on bars.

**Live now wall.** Eight thumbnails, four across: thumbnail, name, title (one line), viewers. Hover raises the title and shows the Clip this button. Clicking opens the Radar row for that stream.

**Top clips.** Ranked rows: 16:9 thumbnail, title, broadcaster, creator, duration, a bar whose length encodes views (bar scale shared across the list), the view count as text, age. Watch opens the platform's own embed in a modal.

**Payments per day.** Column chart, SOL paid to clippers per day for the last 30 days, built from verified receipts. One axis. A second small chart under it for cashback paid per day (do not combine them in a dual axis). Zero days are drawn at the baseline. Below the charts: treasury balance (large figure), paid out, waiting, last payout, and the pause state if it applies.

**Trending on Solana.** Table: icon from DexScreener's image, symbol, name, price, 24 h change (text with a direction glyph and a sign, never colour alone), 24 h volume, Chart link. Source: DexScreener keyless endpoints, fetched in the browser, with an Action snapshot as a fallback if CORS fails. Do not write that these coins are recommended.

**On TikTok.** A row of vertical thumbnails from `feed.json` (oEmbed title, author, thumbnail). Play loads TikTok's own embed in place.

**Streamers to contact.** Top eight live streamers by viewers: avatar, name, Twitch Partner or Affiliate (when the API says so), viewers, status control (Not contacted, Contacted, Replied, Agreed, Passed), Copy pitch.

### Chart rules (follow them exactly)
- One axis per chart. Never a dual axis. Two measures means two charts.
- Marks are thin: 2 px lines, bars with 4 px rounded data ends, at least 8 px markers. A 2 px `--bay` gap between stacked fills and adjacent bars.
- Grid and axes are recessive (`--line`). Text always wears `--paper` or `--muted`, never the series colour. A coloured mark beside the text carries identity.
- Colour is assigned in fixed order (Twitch, Kick, YouTube), never cycled, and never repainted by a filter.
- Two or more series: a legend is always present, and direct labels on at most four. One series: no legend, the title names it.
- Every chart has hover (crosshair and tooltip on lines and areas, per-mark tooltip on bars). Hit targets are larger than the marks. Every chart has a table view toggle and a text summary for screen readers.
- Status is icon plus label, never colour alone. Red is not a status colour here.
- Open each chart in a browser and look at it for label collisions, overflow and geometry before you say it is done.

### The other pages use the same parts
- **Cut:** a real editor layout (preview centre, tool panel right, timeline bottom with a waveform lane, loud-moment markers and a caption lane). Timeline lane labels `V1`, `A1` live here and in the hero only.
- **Post:** a calendar and queue in the same row style.
- **Radar:** three tabs (Live now, Top clips, Shorts), the same rows and walls as the Desk but with search and sort.
- **Streamers:** the pitch table with a side panel per streamer (live thumbnail, current title, their top clips from `clips.json`, Copy pitch).
- **Feed:** a masonry-free fixed-ratio grid, tabs All, TikTok, Twitch clips, Shorts.
- **Earn:** Pay a clipper, Get paid, Receipts, Leaderboard, Rules.

---

## 5. Structure

### Folder layout
```
/src
  main.ts  config.ts
  routes/   desk, cut, post, radar, streamers, feed, earn
  charts/   area.ts bars.ts columns.ts table-view.ts tooltip.ts
  lib/      fees.ts memo.ts receipts.ts eligibility.ts tiktokSession.ts
            live.ts clips.ts shorts.ts market.ts feed.ts storage.ts
  editor/   ffmpeg.ts timeline.ts loudness.ts captions.ts export.ts
  ui/       nav.ts toast.ts empty.ts modal.ts embed.ts
/public
  data/ feed.json contacts.json partners.json blocklist.json
  ffmpeg/
/worker      tiktok-auth.js
/scripts     fetch-content.mjs  validate-feed.mjs  pay-cashback.mjs
/.github/workflows  content.yml  payout.yml  deploy.yml
```
Hash routes: `#/` (Desk), `#/cut`, `#/post`, `#/radar`, `#/streamers`, `#/feed`, `#/earn`, `#/pay?...`.

### Data files (on the `data` branch unless noted; fetched with a minute-based cache buster)
- `live.json`: `{ generatedAt, category, streams: [ { platform, id, name, title, viewers, startedAt, language, url, avatar, thumbnail } ] }`
- `history.json`: `[ { t, viewers, streams, twitch, kick } ]`, one point per run, last 7 days.
- `clips.json`: Twitch top clips of the last 24 h for the category: `{ id, url, embedUrl, title, broadcaster, creator, views, createdAt, thumbnail, duration, language }`.
- `shorts.json`: YouTube results for `LIVE_CATEGORY`, filtered to 60 s or less using videos.list durations, with `{ id, title, channel, views, publishedAt, thumbnail }`. YouTube search has no Shorts-only filter, so state in the README how you filter. Respect quota (search costs 100 units; run it hourly, not every run).
- `streamers.json`: from Twitch Get Users and the Kick payloads: `{ platform, id, name, avatar, broadcasterType, language }` for everyone in `live.json`.
- `cashback.json`: the payout ledger (see section 6).
- In the repo (`/public/data`): `feed.json` (`[ { url, addedAt, title, author, authorUrl, thumbnail } ]`, enriched by `validate-feed.mjs` through TikTok's oEmbed, dead entries removed), `contacts.json` (publicly listed business links only, never scraped emails), `partners.json` (starts `[]`, edited only by me for real agreements), `blocklist.json` (starts `[]`).
- Workflow schedules: live and history every 10 minutes, clips every 30 minutes, shorts every 60 minutes (one workflow, branch on `github.event.schedule`). GitHub's cron is best effort, so the site shows "Updated {m} min ago" from `generatedAt`.

### The payment (client side, no server)
One Solana transaction, signed by the streamer's wallet:
1. `SystemProgram.transfer` streamer to clipper for exactly the clip price.
2. The same instruction carries `REFERENCE_KEY` as an extra read-only, non-signer account (the Solana Pay reference pattern). It is any public key with no private key behind it.
3. A Memo instruction: `cut:v1:<clipId>`, where `clipId` is the first 12 hex characters of the SHA-256 of the normalised clip URL.

The streamer pays the price and the network fee. Nothing else. Math is in integer lamports; define it once in `fees.ts` and test it.

Pay links: `#/pay?to=<wallet>&clip=<url>&price=<sol>`. Validate every parameter (valid public key, positive price, https clip URL). The page shows exactly what will be sent before any signature.

### Receipts
`getSignaturesForAddress(REFERENCE_KEY)`, then `getParsedTransaction` for each. A transaction counts only if it has a `cut:v1:` memo, exactly one System transfer, and the reference key present. Anything else is ignored. Page with `before`. Use `RPC_URL`. If a Helius key is used, the README must say to restrict it to the site's domain in the Helius dashboard.

### Cashback (paid by CUT from the treasury)
`eligibility.ts` is a pure module used by the site, the payout script and the tests. For each verified receipt it returns one status: **waiting**, **paid** (with the payout signature) or **not eligible** (with a reason). Rules, all configurable (defaults are my calls and go in the README):
- Payer and payee must be different wallets. Blocked wallets (in `blocklist.json`) never earn.
- The price must be at least `MIN_PRICE_SOL` (default 0.05).
- Wait `DELAY_HOURS` after the payment (default 24).
- Each `clipId` earns once, on its first valid payment.
- Cashback is `floor(price × 350 / 10000)` lamports, capped at `PER_PAYMENT_CAP_SOL` (default 0.5).
- A clipper earns at most `PER_DAY_CAP_SOL` per day (default 2). The same streamer and clipper pair earns on at most `PAIR_DAILY_COUNT` payments per day (default 3).
- If the treasury balance minus `TREASURY_RESERVE_SOL` can't cover it, the status is "treasury empty" and payout pauses. Payments to clippers are never affected.

Self-payment and wash trading are the real risk of a treasury-funded cashback. Say so in the README and keep the caps and the delay.

### Payout script (`scripts/pay-cashback.mjs`, run by `payout.yml` every 3 hours)
- **Dry run by default.** It sends only when `PAYOUT_LIVE=true`.
- Reads receipts with the same code as the site, applies `eligibility.ts`, and pays each eligible cashback with one transfer from the treasury wallet and a memo `cut:v1:cb:<paymentSignature>`.
- **Idempotent**: skips any payment that already has a payout in `cashback.json` or a matching memo in the treasury's recent history.
- Limits: `MAX_PER_RUN_SOL`, and a kill switch (`paused.json` on the data branch).
- Writes `cashback.json` (`[ { paymentSig, payoutSig, clipId, clipper, lamports, at } ]`) to the data branch.
- The key comes from the Actions secret `TREASURY_SECRET_KEY`. **Never log it, never write it to a file.** The README must warn plainly: anyone who can edit workflows can read the secret, so the treasury wallet must hold only a small float, and the float is money at risk.

### TikTok login (Worker)
`/login`: create `state`, set it in an HttpOnly cookie, redirect to TikTok's authorize URL with `client_key`, `scope=user.info.basic`, `redirect_uri` (the Worker's `/callback`), `state`, `response_type=code`. `/callback`: verify `state`, exchange the code at TikTok's token endpoint with the client secret, fetch the basic user info, **discard the tokens**, and redirect to the site's `#/post?session=<signed>`. `signed` is an HMAC-SHA256 token with `open_id`, `display_name`, `avatar_url`, `exp` (7 days). A session proves a TikTok login and nothing else. The README must list the TikTok developer portal steps and, after you check TikTok's docs, say what sandbox and review mean for who can log in.

### Editor (all client side)
Import MP4 or WebM (drop or file input). Warn above 500 MB; recommend under 10 minutes. Preview in a `<video>` with a canvas overlay. **Find loud moments** decodes the audio, computes RMS in 250 ms windows, and marks the loudest peaks with a minimum spacing. It is volume detection; never call it AI. Trim, Frame (fill, blur background, stacked), Captions (timed lines, burned in), Look (contrast, saturation, grain, vignette, speed), Export 1080×1920 H.264 `-preset veryfast`, AAC, `+faststart`. Export gives Download, or Queue to post (clip stored in IndexedDB so it survives a refresh). A source credit field appends "via {name}" to the caption. Clip this on a stream or clip opens the editor with the source name shown.

### Post, Streamers, Feed
- **Post:** IndexedDB for clips, localStorage for the queue. Notification API for reminders, requested only on a click. If notifications are denied, show the due items on the page. "Open TikTok upload" links to TikTok's own page.
- **Streamers:** built from `live.json` and `streamers.json`, plus links from `contacts.json`. Every row has a real contact route: "Open About page" is a link to the channel's own About page. Do not scrape emails. Status per streamer is saved in localStorage and exportable as CSV. **Twitch Partner** and **Twitch Affiliate** are shown only when the API says so. **CUT partner** is shown only for entries in `partners.json`.
- **Feed:** TikTok through TikTok's own embed (`blockquote.tiktok-embed` with `cite` and `data-video-id`, and `https://www.tiktok.com/embed.js`, loaded once and on demand); Twitch clips through Twitch's embed (with the `parent` parameter set to the site's host); Shorts through YouTube's embed. Add-by-link validates the URL, tries oEmbed for the thumbnail and title, and falls back to the embed alone. Never download, re-host or screenshot videos.

---

## 6. Config (`src/config.ts`)

```ts
export const CONFIG = {
  CONTRACT_ADDRESS: '', X_URL: '', TELEGRAM_URL: '', REPO_URL: '', CHART_URL: '',
  TREASURY_WALLET: '', REFERENCE_KEY: '',
  RPC_URL: 'https://api.mainnet-beta.solana.com',
  TIKTOK_AUTH_WORKER_URL: '', DATA_BASE_URL: '',
  LIVE_CATEGORY: '',
  CASHBACK_BPS: 350, MIN_PRICE_SOL: 0.05, DELAY_HOURS: 24,
  PER_PAYMENT_CAP_SOL: 0.5, PER_DAY_CAP_SOL: 2, PAIR_DAILY_COUNT: 3,
  TREASURY_RESERVE_SOL: 0.1, MAX_PER_RUN_SOL: 2,
}
```
An empty value hides whatever needs it (button, link, strip, line of copy). No dead links, no `#`, no "coming soon". Without `REFERENCE_KEY` the pay form is disabled with the reason from the deck. The caps and delay shown in the copy come from this object.

---

## 7. Quality rules

**Truth**
- Show only data read live, or created by the visitor on their own device. No invented numbers, no invented people, no invented clips.
- None of these words in the UI: demo, sample, example, mock, placeholder (except the HTML attribute), lorem, beta, coming soon.
- Never promise price, returns or profit. No giveaway or airdrop language.
- The cashback is paid **while the treasury has funds**. Never write it as a guarantee. The treasury balance, the pause state and each payout are public.
- CUT does not auto-post to TikTok, does not use AI, and does not "find funny moments". Do not say it does.
- A streamer is never shown as endorsing or partnering with CUT unless they are in `partners.json`.
- No streamer likeness, avatar or name in the hero, logo, share images or marketing. The Radar and Streamers lists may show what the platform API returns for each listed channel.
- Brand: no GTA, Rockstar, Vice City or game imagery in the name, logo, copy or art. Third-party titles and thumbnails returned by the APIs are shown as returned.
- Footer risk, independence and content lines exactly as in the deck.

**Engineering**
- Vitest: fee math in lamports; memo build and parse; receipt verifier (accepts valid, ignores wrong shapes); `eligibility.ts` for every rule and cap (self-payment, minimum, delay, once per clip, per-payment cap, daily caps, pair cap, blocklist, treasury empty); pay-link validation; pitch template; loudness peak picker on a synthetic signal; chart scale and path functions; CSV export.
- Playwright: every route at 1440 and **320 px** with no horizontal scroll; empty config renders every designed empty state; pay form disabled without `REFERENCE_KEY`; chart table-view toggles; keyboard reaches every control.
- Accessibility: visible focus, 4.5:1 contrast on text, labels on every control, charts have a text summary and a table view, nothing decorative is announced.
- Performance: ffmpeg only loads on Cut; embed scripts load on demand; images lazy; no layout shift.
- Security: never log or store the TikTok access token or the treasury key. Escape all external strings. https links only.
- Packaging: `npm run build` gives `dist`; `deploy.yml` publishes to Pages; test the build under a subpath.
- **README with real limitations**: setup for the Worker, the TikTok developer app, the Actions secrets and the data branch, the treasury wallet and its risk, the config; what works with no accounts; what needs credentials; the list in section 1.

## 8. Before you start coding

1. Reply with the endpoints and docs you checked and the exact paths you will use (Twitch, Kick, YouTube, TikTok Login Kit and oEmbed, DexScreener, Jupiter).
2. Build in this order: tokens and type, the chart layer, the Desk with live data, then the other routes, the payment and receipts, the payout script, the editor.
3. Screenshot the Desk at 1440 and 320 px and review it against section 3. If a panel looks like a generic card, redo it.
4. Before you finish, run: `grep -rinE "demo|sample|example|mock|placeholder|lorem|coming soon|gta|rockstar|vice city|moon|100x|guarantee|profit|airdrop|giveaway|reward|buyback|burn" src public dist` and fix or justify every hit. Expected and harmless: the HTML `placeholder` attribute and `mainnet-beta` in the RPC URL.

## 9. When you finish

Reply with two lists:
- **Verified live** (you ran it and saw real output): which endpoints and flows.
- **Not run** (needs credentials, a deployed Worker, a funded wallet, or a network you didn't have): each one, and what I need to do.

Say plainly if anything was simulated while you built. Nothing simulated may ship in the site.
