# CLAUDE.md — D2JSP HC Ladder Trading Panel

Context for Claude Code. Drop this at the repo root. It carries the design
decisions made when this scaffold was created so you don't re-derive them.

## What this is

The **read side** of a market-intelligence tool for d2jsp's **D2:R RotW Hardcore
Ladder Trading** forum (f=123). It's a Next.js control panel + JSON API that reads
from a hosted Postgres and shows: FMV per item, a snipe feed, stash mark-to-market,
ISO matches, and rune↔FG exchange rates.

## Architecture — the split is the whole point

This repo deploys to **Vercel** and ONLY READS the database.

The **scraper / parser / resolution engine / alert check run OFF Vercel** (the
author's own box, residential IP) and WRITE to the same hosted Postgres. Reason:
d2jsp sits behind Cloudflare, and scraping from Vercel's AWS datacenter IPs gets
challenged/blocked. Vercel also can't run a continuous scraper, and Hobby-tier cron
is daily-only — too coarse for snipe alerts. So: **Vercel = what you look at;
the scraper box = what touches d2jsp.**

Do NOT add scraping, Cloudflare-fetching, or a continuous loop to this repo.
Do NOT rely on Vercel cron for time-sensitive alerts — the scraper process fires
those itself right after each scrape pass (it has the freshest data).

## Stack

- Next.js 14 (App Router), TypeScript, `pg`.
- Postgres on Neon or Supabase. **Use the POOLED connection string** (`-pooler`
  host on Neon, port 6543 on Supabase) — `lib/db.ts` keeps a small pool singleton.
- Env: `DATABASE_URL`. Load schema/seed with `npm run db:schema && npm run db:seed`.

## Data model (db/schema.sql)

- `item` / `item_alias` / `variant` — canonical item, aliases, and per-item roll
  bundles. `item.roll_axes` lists the axes that actually move price for that item
  (e.g. Infinity = eth/base/conv_roll; Grief = base/ias/dmg). `variant.tier` buckets
  a roll bundle into perfect/high/mid/low/starter.
- `listing` + `post_snapshot` (APPEND-ONLY — edits are the resolution signal) +
  `listing_item` (the PER-ITEM resolution unit; multi-item posts resolve line by line).
- `price_observation` — FMV inputs. `confidence` enum ordered weakest→strongest:
  ask_stale < ask_observed < sold_price_unknown < fill_confirmed. Most data is asks,
  not fills (trades close over PM), so the confidence weighting matters.
- `currency` + `exchange_rate_obs` — FG is the base numeraire; runes (Ber/Jah/…)
  trade as cash. Crossed market (bid > ask) = a real momentary spread.
- `season` — the hidden covariate. Prices move 5–10x across a ladder season; FMV is
  always "price GIVEN season phase."
- `iso_request`, `inventory`, `trader` (rolling reputation: underprice_z, reliability).
- `fmv_current` VIEW — cheap read-side v1: trailing-21-day p25/p50/p75 (bid/mid/ask),
  stale asks gated out. **The real decay / censored-survival estimate runs in the
  off-Vercel aggregator** and writes richer numbers; this view just gives the panel
  something to join against. (Percentiles are cast to numeric so round() works.)

## Conventions

- API routes (`app/api/*`) are read-only, parameterized, `export const dynamic =
  'force-dynamic'`. No writes from this repo.
- `app/page.tsx` is a deliberately bare functional dashboard. It is NOT the designed
  UI — replace it when building the real dashboard (use the frontend-design pass then).

## Highest-leverage next steps (in order)

1. **Scraper→DB write contract** — define the exact insert/upsert shapes the
   off-Vercel Python scraper targets for `listing`, `listing_item`, `post_snapshot`,
   `price_observation`, `exchange_rate_obs`. Nothing in the panel is useful until real
   data flows. Build this before anything visual.
2. **Item normalization** (the moat) — deterministic abbreviation/regex pass over
   forum titles first, LLM pass on the residue only, schema-constrained to emit the
   variant object, cached on a normalized-title hash. Start with ~40 chase items.
3. Designed dashboard over the bare one.

## Don'ts

- Don't move the scraper into this repo or onto Vercel.
- Don't average raw asks for FMV (overpriced asks linger and bias it up); the model
  is censored — fast sells are lower bounds, lingering asks are upper bounds.
- Don't treat multi-item posts as one unit — resolve per `listing_item`.
