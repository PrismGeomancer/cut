# CUT: copy deck (v2)

Ticker: **$CUT** (spelling confirmed). Voice: dry, specific, short sentences. No price talk, no hype words, no emoji. Headings are plain sentences. Typographic emphasis comes from the layout and the cut motif, not from italicising a word.

Rules for every string: it states how CUT works, or it is a slot filled with data read live. `{curly}` marks a live value. The site never invents a value to fill a slot.

---

## 1. Meta

- `<title>`: CUT: Cut the clip. Take your cut.
- Description: Edit clips in your browser, post them to TikTok, and get paid on Solana. CUT pays a 3.5% cashback on eligible clip payments.
- OG title: CUT
- OG description: Cut the clip. Take your cut.
- Theme colour: `#14171A`

## 2. Loader (about 1.2 s, skippable, once per session)

- Timecode counts `00:00:00:00` to `00:00:01:00`
- Line: Rolling.
- Skip link: Skip

## 3. Top bar

- Wordmark: CUT
- Nav: Cut · Post · Radar · Streamers · Feed · Earn
- Right: Log in with TikTok · Connect wallet · Buy $CUT (hidden while `CONTRACT_ADDRESS` is empty)
- Live strip (hidden until data loads): `SOL {price}` · `{n} live now` · `{viewers} watching` · `Updated {m} min ago`
- Stale strip (data older than 30 min): The live list is {m} min old. It refreshes about every ten minutes.

## 4. Hero

- H1: Cut the clip. Take your cut. (Set as two lines. The second line is cut from the first on the diagonal and slips right, like the logo.)
- Lede: Edit in your browser. Post to TikTok. When a streamer pays for your clip through CUT, CUT pays you a 3.5% cashback on eligible payments.
- Primary button: Open the editor
- Secondary button: See who's live
- Fine print: Streamers pay the clip price, nothing extra. The cashback comes from the CUT treasury while it has funds.
- Timeline hero labels: `V1` clip · `A1` audio · `$` payment · `+3.5%` · playhead timecode. The clip block splits at the playhead, then a `+3.5%` line drops onto the `$` track.
- Hero side panel (live thumbnails of the three biggest streams, stacked like clips on a track): `{name}` · `{viewers} watching`

## 5. Home data strip (all live; zero is shown as zero)

- `{n}` live now
- `{viewers}` watching across the list
- `{n}` top clips in the last 24 h
- `{balance}` SOL in the treasury
- `{n}` payments verified

## 6. Live now (home and Radar)

- Heading: Live now
- Lede: Streams going on right now, biggest first.
- Card: thumbnail · `{platform dot and name}` · `{name}` · `{title}` · `{viewers} watching` · `live {duration}`
- Buttons: Watch · Clip this
- Link: See everyone live

## 7. Top clips right now

- Heading: Top clips right now
- Lede: The most watched Twitch clips of the last 24 hours.
- Card: thumbnail · `{duration}` · `{title}` · `{broadcaster}` · `clipped by {creator}` · `{views} views` · `{age}`
- Buttons: Watch · Clip this

## 8. How it works (four tracks)

**01 Find a moment**
Radar lists the streams live right now, and the clips already going round. Or drop in a recording you already have.

**02 Cut it**
Trim, reframe to 9:16, add captions, pick a look, export. Your browser does the work. Nothing is uploaded.

**03 Post it**
Log in with TikTok, queue the clip with a caption and a time. CUT reminds you when it is due. Publishing happens in TikTok.

**04 Get paid, then get more**
The streamer opens your pay link and sends the clip price straight to your wallet. CUT adds a 3.5% cashback from the treasury once the payment checks out.

## 9. One payment. One cashback.

- Heading: One payment. One cashback.
- Line 1: The streamer pays the clip price, straight to the clipper's wallet.
- Line 2: CUT pays the clipper 3.5% on top, from the treasury, after {delay} hours.
- Line 3: Every payment and every cashback is a public transaction.
- Below: CUT never holds the streamer's money. The treasury balance is public. When it is empty, cashback pauses. The clip payment doesn't.
- Caps line: Cashback is capped at {perPaymentCap} SOL per payment and {perDayCap} SOL per clipper per day.

## 10. Trending on Solana

- Heading: Trending on Solana
- Lede: What the market is looking at right now.
- Row: `{icon}` · `{symbol}` · `{name}` · `{price}` · `{24h change}` · `{24h volume}` · Chart (link)
- Footer line: Prices from DexScreener, updated {m} min ago.
- Error: Couldn't load the market. Try again in a minute.

## 11. On TikTok

- Heading: On TikTok
- Lede: Clips from clippers, straight from TikTok.
- Card: `{thumbnail}` · `{title}` · `{author}` · Play
- Link: See the whole feed

## 12. The treasury

- Heading: The treasury
- Lines: Balance · Paid out · Waiting · Last payout `{time}`
- Wallet line: Treasury wallet `{short address}` (copy, Solscan link)
- Pause state: Cashback is paused. The treasury is empty.
- Note: Every payout is a public transaction with a memo that names the payment it answers.

## 13. Cut (editor)

- Page title: Cut
- Lede: Drop in a recording. Mark the moment. Export a vertical clip.
- Drop zone: Drop a recording here
- Drop zone sub: or choose a file. MP4 or WebM. It stays on your device.
- Size note: Works best under 10 minutes.
- Steps: Source · Trim · Frame · Captions · Look · Export
- Loud moments button: Find loud moments
- Loud moments help: Marks the loudest peaks in the audio. It doesn't know what's funny. It knows what's loud.
- Loud moments empty: Nothing stood out. Try a longer recording.
- Trim labels: In · Out · Length
- Frame options: Fill · Blur background · Stacked
- Frame help: Stacked puts the game on top and the facecam below.
- Captions: Add line · Start · End · Text
- Captions empty: No captions yet. Add a line at the playhead.
- Look: Contrast · Saturation · Grain · Vignette · Speed
- Export button: Export 1080×1920 MP4
- Export progress: Encoding {n}%
- Export done: Done. {size} MB.
- After export: Download · Queue to post
- Credit field: Source credit (optional)
- Credit help: Added to your caption. Name the streamer.
- Opened from a stream or clip: Source: {name}. Record it, then drop the file here.
- Errors: That file didn't open. Try MP4 or WebM. · Not enough memory for this file. Trim it shorter first. · Export stopped. Nothing was saved.

## 14. Post

- Page title: Post
- Lede: Queue your clips. CUT reminds you when one is due.
- Logged out: Log in with TikTok to queue clips.
- Logged in: Logged in as {display name}
- Form: Clip · Caption · Hashtags · Time
- Queue button: Queue it
- Queue empty: Nothing queued. Export a clip in Cut first.
- Row actions: Open TikTok upload · Mark posted · Remove
- Reminder permission: Allow reminders so CUT can tell you when a clip is due.
- Reminder text: Time to post: {caption}
- Footnote: CUT reminds you at the time you set. Publishing happens in TikTok.

## 15. Radar

- Page title: Radar
- Lede: What's live and what's going round. Refreshes about every ten minutes.
- Tabs: Live now · Top clips · Shorts
- Filters (Live now): All · Twitch · Kick
- Sort: Most watched · Newest
- Search placeholder: Search streamers or titles
- Shorts lede: The most watched YouTube Shorts about the biggest stream right now. (Query comes from `LIVE_CATEGORY`.)
- Shorts card: `{thumbnail}` · `{title}` · `{channel}` · `{views} views` · `{age}` · Watch
- Empty (per tab): Nothing in this list yet. Check back after the next refresh.
- Error: Couldn't load this list. Try again in a minute.

## 16. Streamers (pitch list)

- Page title: Streamers
- Lede: Streamers worth a message. Open their page, send the pitch, track the answer.
- Columns: Streamer · Platform · Viewers · Language · Contact · Status
- Streamer cell: `{avatar}` · `{name}` · `{Twitch Partner | Twitch Affiliate}` (when the API says so)
- Contact cell: Open About page (link to their channel's About page) · plus any links from contacts.json
- Status options: Not contacted · Contacted · Replied · Agreed · Passed
- Row panel (click a streamer): live thumbnail · current title · their top clips from the list · Copy pitch
- Buttons: Copy pitch · Export CSV
- Pitch (copied to clipboard, `{name}` filled in):

  > Hi {name}. I clip your streams for TikTok. If you pay clips through CUT, it costs you nothing extra: you send the clip price straight to my wallet, and CUT pays the clipper a 3.5% cashback on eligible payments from its own treasury. No exclusivity. You set the price. Want to try one clip?

- Footnote: Statuses are saved in this browser. A streamer shows as a CUT partner only when they are in partners.json.
- Partner badge (only for entries in partners.json): CUT partner
- Empty partners: No partners yet.

## 17. Feed

- Page title: Feed
- Lede: Clips from clippers and the platforms they post on.
- Tabs: All · TikTok · Twitch clips · Shorts
- TikTok card: `{thumbnail}` · `{title}` · `{author}` · Play
- Twitch card: as §7. Shorts card: as §15.
- Add field placeholder: Paste a TikTok link
- Add button: Add
- Add help: Videos play from TikTok. CUT doesn't host them.
- Empty (TikTok tab): No TikToks yet. Paste the first link.
- Error: That link didn't resolve. Check it's a public TikTok video.
- Removed: This video is no longer available on TikTok.

## 18. Earn

- Page title: Earn
- Lede: Pay a clip. Get paid for one. Every payment leaves a public receipt.
- Tabs: Pay a clipper · Get paid · Receipts · Leaderboard · Rules

**Pay a clipper (streamer side)**
- Fields: Clipper wallet · Clip link · Price (SOL)
- Summary: Clipper receives {price} SOL · You pay {price} SOL plus the network fee · CUT can pay the clipper a 3.5% cashback (see Rules)
- Button: Sign and pay
- Disabled (no wallet): Connect a wallet first.
- Disabled (no reference key set): Payments open when CUT is configured.
- After: Payment sent. View receipt.

**Get paid (clipper side)**
- Fields: Your wallet · Clip link · Price (SOL)
- Button: Create pay link
- After: Pay link ready. Send it to the streamer.
- Button: Copy link

**Receipts**
- Lede: Read from Solana. Nothing here is typed in by hand.
- Columns: Time · Clip · Streamer · Clipper · Price · Cashback · Status · Receipt
- Status values: Waiting ({hours} h check) · Paid · Not eligible: {reason}
- Reasons: same wallet · over the cap · already paid · below the minimum · treasury empty · blocked
- Empty: No payments yet. The first receipt will show up here.
- Error: Couldn't read receipts from the network. Try again.

**Leaderboard**
- Lede: Clippers ranked by SOL received through CUT.
- Columns: # · Clipper · Clips paid · SOL received · Cashback paid
- Empty: No payments yet. The first clipper will show up here.

**Rules**
1. The streamer pays the clip price, straight to the clipper's wallet.
2. CUT pays the clipper a 3.5% cashback from the treasury, {delay} hours after the payment.
3. Cashback is capped at {perPaymentCap} SOL per payment, {perDayCap} SOL per clipper per day, and {pairCap} payments per day for the same streamer and clipper.
4. Payments below {minPrice} SOL don't earn cashback.
5. A wallet paying itself doesn't earn cashback. Neither do blocked wallets.
6. Each clip earns cashback once.
7. When the treasury is empty, cashback pauses. Clip payments don't.
8. A signature approves a payment. It doesn't prove who anyone is.

## 19. Token strip (hidden while `CONTRACT_ADDRESS` is empty; no placeholder text)

- Heading: $CUT
- Fields: Price · Market cap · Liquidity · 24h volume (DexScreener)
- Buttons: Contract {short address} (copy) · X · Telegram · Chart

## 20. Toasts

- Link copied.
- Contract copied.
- Wallet connected.
- Wallet disconnected.
- Signature cancelled. Nothing was sent.
- Payment sent. Receipt below.
- Payment failed. Nothing was sent.
- Logged in with TikTok.
- TikTok login failed. Try again.
- Clip queued.
- Saved in this browser.
- CSV exported.

## 21. States

- No wallet: Connect a wallet to continue.
- No TikTok login: Log in with TikTok to continue.
- Offline: You're offline. The editor still works.
- A source failed but an older snapshot exists: Showing the list from {m} min ago.
- Image failed to load: show the platform name on a `--panel` tile. Never a stock image.

## 22. Footer and small print

- Left: CUT. Cut the clip. Take your cut.
- Links: X · Telegram · Contract · Repo (each hidden when its config is empty)
- Risk line: Not financial advice. Meme coins can lose all their value. Verify the contract on the official X.
- Independence line: CUT is a project among friends. It isn't affiliated with or endorsed by any streamer, platform or game publisher.
- Content line: Streams, clips and videos belong to their creators and play from the platforms they were posted on. Prices from DexScreener.
