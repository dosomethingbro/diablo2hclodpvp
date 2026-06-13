# D2JSP HC Ladder Trading Panel — Vercel side

This is the **read side** of the system: a Next.js control panel + JSON API that
reads from a hosted Postgres. It deploys to Vercel (`dosomethingbros-projects`).

The **scraper / parser / resolution engine / alert check do NOT live here.** They run
off-Vercel (your own box / residential IP) and *write* to the same Postgres, because
scraping Cloudflare-protected d2jsp from Vercel's datacenter IPs gets challenged.
Vercel hosts what you look at; your scraper box hosts what touches d2jsp.

## Layout

    db/schema.sql        Postgres DDL (the §6 data model)
    db/seed.sql          A few chase items + variants so the panel isn't empty
    lib/db.ts            pg Pool singleton (serverless-safe)
    lib/types.ts         TS row types
    app/api/*            Read-only route handlers the dashboard hangs off
    app/page.tsx         Minimal functional dashboard (NOT the designed one)

## Setup

1. Create a Postgres DB (Neon or Supabase — both are Vercel marketplace integrations).
2. Put the **pooled** connection string in `.env` as `DATABASE_URL`.
3. Load schema + seed:

       npm install
       npm run db:schema
       npm run db:seed

4. Run locally:  `npm run dev`  → http://localhost:3000
5. Deploy:  push to GitHub, import into Vercel, set `DATABASE_URL` env var.

## API

    GET /api/items                          canonical item list
    GET /api/fmv?item=SLUG&tier=high        FMV band (bid/mid/ask) per item+tier
    GET /api/listings?item=SLUG&status=...  recent listing-items
    GET /api/snipes?threshold=0.8           items priced under FMV bid
    GET /api/iso?match=1                     ISO posts, optionally matched to inventory
    GET /api/inventory                       your stash marked to market (at bid)
    GET /api/exchange-rates                  rune<->FG rates + crossed-market flags

The scraper-written tables (post_snapshot, price_observation, etc.) feed
`fmv_current`, a SQL view giving a cheap trailing-window FMV approximation.
The real decay / censored-survival model runs in the off-Vercel aggregator;
this view is the v1 read approximation.
