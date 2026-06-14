# 10x Analysis: D2JSP HC Ladder Trading Panel
Session 1 | Date: 2026-06-13

## Current Value
A scaffold today, not a product. It renders FMV bands, a snipe feed, exchange rates, ISO
matches, and inventory mark-to-market — **but entirely from fake seed data**. The genuine
asset is the schema: it already encodes the hard market-modeling decisions (censored price
observations, append-only snapshots, per-item resolution, FG/rune crossed markets, season
covariate). There is no scraper, so the product solves no real problem *yet*.

## The Question
What would make this 10x more valuable to a solo HC-ladder trader?

**Core insight:** the d2jsp HC ladder market is *illiquid, manually negotiated over PM, and
first-contact-wins*. Edge in this market = **(a) speed** (be the first PM on an underpriced
post) and **(b) trust** (know true value and who you're dealing with before a HC item is gone
forever). Everything below is scored against those two axes. The product is not "a nicer forum
view" — it's an **information-and-speed advantage engine**.

---

## Prerequisites (not features — nothing works without these)

These aren't 10x ideas; they're the cost of entry. Listed so the roadmap is honest.

- **P0 — Scraper that fetches f=123 past Cloudflare from a residential IP.** The make-or-break
  per deep research. Until one well-behaved fetch returns real thread HTML, *zero* features
  deliver value. Highest risk, must be de-risked first via a spike.
- **P1 — Item normalization** ("the moat" per CLAUDE.md). Messy titles ("Eth CA Inf 50",
  "perf grief pb 40/400") → structured item/variant/tier. Deterministic regex/abbrev pass first,
  LLM only on the residue, cached on a normalized-title hash. Without structure, no FMV, no
  snipes, no ISO matching.

---

## Massive Opportunities

### 1. Real-time snipe alerts (push to phone/Discord within seconds of posting)
**What**: The instant the scraper sees a new BIN priced under FMV bid by your threshold, fire
a push (Discord webhook / ntfy / Telegram) with item, price, margin, and a deep link to the post.
**Why 10x**: In a first-PM-wins market, *speed is the entire edge*. A human refreshing the forum
loses to someone alerted in 10 seconds. This converts the tool from "a dashboard you check" into
"a sense you didn't have." This is THE product, not a feature.
**Unlocks**: Makes the whole scraper investment pay off the moment it works. Creates a daily habit.
**Effort**: Medium (alert plumbing) — but depends entirely on P0+P1.
**Risk**: Alert fatigue if FMV is wrong → why FMV trust (below) is a co-requisite.
**Score**: 🔥 Must do

### 2. Trustworthy FMV engine (censored / mixture model)
**What**: Replace the v1 trailing-percentile `fmv_current` view with the censored model deep
research validated (Tobit/mixture: fast sells = lower bounds, lingering asks = upper bounds,
weighted by the `confidence` enum, conditioned on season phase). Show bid/mid/ask **with a
sample size and confidence band**.
**Why 10x**: Every other trader is eyeballing value from memory. A defensible FMV nobody else
has is the **moat** — it compounds as more observations accumulate. It also gates feature #1:
snipe alerts are only as trustworthy as the FMV they compare against.
**Unlocks**: Arbitrage leads, "sell now?" signals, ISO max-price guidance — all downstream of FMV.
**Effort**: High (the real model runs in the off-Vercel aggregator).
**Risk**: Sparse per-item data → model unidentifiable; mitigate by starting with ~40 chase items
and falling back to the percentile view when n is low.
**Score**: 🔥 Must do (but after a v1 percentile FMV is live on real data)

### 3. Counterparty / scam-risk intelligence
**What**: A "who is this trader" panel per listing — pulled from the `trader` table
(reliability, underprice_z, 30d volume) plus flags: brand-new account, prices suspiciously below
market (classic scam bait), inconsistent history.
**Why 10x**: This is **Hardcore** — a scam means the item is gone *permanently*, no trade window.
Eliminating counterparty anxiety before you PM is enormous, unique value. Speed gets you the deal;
trust keeps you from losing your stash to a scammer.
**Why it compounds**: Every scraped post enriches each trader's history — a data moat that grows.
**Effort**: Medium.
**Score**: 🔥 Must do (fast-follow once trader data accumulates)

---

## Medium Opportunities

### 1. In-thread resolution detection ("did the trade happen?")
**What**: Parse replies + post edits for sold/pending/accepted signals; mark `listing_item`
resolved and emit a `fill_confirmed` price_observation.
**Why it matters more than it seems**: Fills are the *gold* observations that anchor the censored
FMV model. Detecting them in-thread (user confirmed traders often reply "sold"/"pending") is what
makes FMV trustworthy instead of ask-biased. It's a feature *and* the fuel for #2 above.
**Impact**: Turns the FMV from a guess into something grounded in actual transactions.
**Effort**: Medium.
**Score**: 🔥 (it's a prerequisite for FMV trust, sequence it with the parser)

### 2. ISO → inventory match alerts (the "you can sell this" radar)
**What**: When a scraped ISO post matches an item/tier you hold (`inventory`), alert you with the
asker, their max price, and your mark-to-market.
**Why**: The mirror of snipe alerts — never miss a *buyer*. Directly fulfills a stated user goal.
**Effort**: Low–Medium (matching is a join; reuses the alert plumbing from Massive #1).
**Score**: 👍 Strong

### 3. Arbitrage / crossed-market lead board
**What**: Surface rune↔FG crossed markets (bid > ask) and cross-tier mispricings as ranked
*leads* — explicitly labeled "executability uncertain," never "guaranteed profit" (per research).
**Why**: A stated goal; genuinely useful when real. But research is clear the biggest apparent
mispricings are the least executable — so it's a lead generator, not a money printer.
**Effort**: Medium.
**Score**: 👍 Strong (but manage expectations — leads, not profit)

### 4. Price history sparklines + season-phase context
**What**: A tiny trend line per item and a banner showing current season phase (prices swing
5–10x across a ladder season).
**Why**: Context turns a number into a judgment. "520fg" means nothing without "and trending up,
early season."
**Effort**: Low–Medium.
**Score**: 👍 Strong

---

## Small Gems

### 1. Freshness + sample-size badges on every price
**What**: "n=3 · 2h old" next to every FMV.
**Why powerful**: Trust is the whole game. One glance tells you whether to believe the number —
eliminates the silent failure of acting on one stale ask.
**Effort**: Low (data already in `fmv_current`).
**Score**: 🔥

### 2. Margin-sorted snipe feed with one-click post link
**What**: Snipes sorted by % under FMV, each a direct deep link to the d2jsp post.
**Why powerful**: Collapses "see deal → act" to one click. Seconds matter.
**Effort**: Low.
**Score**: 🔥

### 3. Crossed-market badge
**What**: A red "CROSSED" chip wherever bid > ask.
**Why**: Surfaces a real, rare, actionable signal that's otherwise invisible.
**Effort**: Low (the API already computes `crossed`).
**Score**: 👍

### 4. "Watch this item" with a custom threshold
**What**: Per-item alert threshold overriding the global snipe threshold.
**Why**: Power-user control; you care about a 20%-off Ber differently than a 20%-off Shako.
**Effort**: Low.
**Score**: 👍

---

## Recommended Priority

### Do Now (de-risk + first real data)
1. **P0 scraper spike** — prove one well-behaved fetch of f=123 returns real HTML from a
   residential IP. Everything is blocked on this; answer it before building anything visual.
2. **Scraper→DB write contract** — define exact insert/upsert shapes for `listing`,
   `listing_item`, `post_snapshot`, `price_observation`, `exchange_rate_obs` (CLAUDE.md's #1).
3. **Parser + deterministic item normalization (v1)** — fixture-tested offline; turns real
   titles into structured rows. The moat starts here.

### Do Next (first value on real data)
1. **In-thread resolution detection** → emits `fill_confirmed` (fuels trustworthy FMV).
2. **Real-time snipe alerts** (Discord/ntfy webhook) — the killer feature; the speed edge.
3. **Freshness + sample-size + margin-sorted snipe feed** — the small gems that make it trustworthy
   and fast to act on. Cheap, high impact.

### Explore (the moat + expansion)
1. **Censored/mixture FMV engine** — the defensible, compounding core. Risk: sparse data; mitigate
   with chase-item focus + percentile fallback.
2. **Counterparty/scam-risk intelligence** — unique HC value; compounds with scraped history.
3. **ISO→inventory match alerts** and **arbitrage lead board** — fulfill remaining stated goals,
   reuse alert plumbing.

### Backlog (good, not now)
- Price-history sparklines, custom per-item watch thresholds, mobile-polished dashboard
  (replace the bare `page.tsx` with a frontend-design pass once the data is real).

---

## Questions

### Answered (from prior research / user)
- **Q**: Is arbitrage realistic? **A**: Yes but limited — surface as *leads*, not profit.
- **Q**: Is scraping f=123 legal? **A**: Favorable (public page, hiQ) — log in nowhere, scrape
  logged-out pages only.
- **Q**: Are accepted trades observable? **A**: Often replied in-thread → reply parsing is viable.

### Blockers (need user / live environment)
- **Q**: Does a residential-IP fetch of f=123 actually get past Cloudflare? (Must run on the
  user's box — cannot be tested from a datacenter.)
- **Q**: What does one real f=123 thread's HTML actually look like? (Needed to finalize parser
  selectors; until then, parser is built against a documented fixture and adjusted on first real
  sample.)

## Next Steps
- [ ] Build the scraper scaffold + write-contract + parser/normalizer with offline fixture tests
      (everything not requiring a live fetch).
- [ ] Hand the user a one-command "scrape spike" to run on their residential box.
- [ ] On first real HTML, tune parser selectors, then flip snipe alerts on.
