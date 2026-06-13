-- =====================================================================
-- D2JSP HC Ladder Trading Panel — Postgres schema  (§6 data model)
-- Read side (Vercel) reads these; the off-Vercel scraper writes them.
-- =====================================================================

-- ---------- enums ----------
create type item_category   as enum ('runeword','unique','set','rune','charm','jewel','rare','base','misc');
create type quality_tier    as enum ('perfect','high','mid','low','starter','unknown');
create type listing_status  as enum ('listed','bumped','price_edited','pending','sold','closed','expired');

-- price-observation confidence, ordered weakest -> strongest (drives FMV weight)
create type obs_confidence  as enum ('ask_stale','ask_observed','sold_price_unknown','fill_confirmed');

-- ---------- season regime (the hidden covariate) ----------
create table season (
  id          serial primary key,
  name        text not null,              -- 'S14'
  realm       text not null default 'rotw_hc_ladder',
  started_at  timestamptz not null,
  ended_at    timestamptz
);

-- ---------- currency (FG is the base numeraire; runes trade as cash) ----------
create table currency (
  code         text primary key,          -- 'fg','ber','jah','sur',...
  kind         text not null,             -- 'fg' | 'rune' | 'item'
  display_name text not null
);

-- exchange-rate observations: 1 unit of base = rate (in quote). Edges of the FG<->rune graph.
create table exchange_rate_obs (
  id           bigserial primary key,
  season_id    int references season(id),
  base_code    text not null references currency(code),  -- e.g. 'ber'
  quote_code   text not null references currency(code),  -- e.g. 'fg'
  rate         numeric not null,                          -- 1 ber = `rate` fg
  side         text not null,                             -- 'ask' (WTS) | 'bid' (WTB/ISO)
  observed_at  timestamptz not null default now(),
  source_url   text
);
create index on exchange_rate_obs (base_code, quote_code, observed_at desc);

-- ---------- canonical items + aliases ----------
create table item (
  id        serial primary key,
  slug      text unique not null,         -- 'infinity','grief','enigma','shako'
  name      text not null,                -- 'Infinity'
  category  item_category not null,
  -- which variant axes actually move price for THIS item (drives the parser + UI)
  roll_axes jsonb not null default '[]'   -- e.g. ["eth","base","conv_roll"]
);

create table item_alias (
  alias    text primary key,             -- 'harle','shako','harlequin crest'
  item_id  int not null references item(id) on delete cascade
);
create index on item_alias (item_id);

-- ---------- variant (per-item roll bundle -> tier) ----------
create table variant (
  id          serial primary key,
  item_id     int not null references item(id) on delete cascade,
  axes        jsonb not null,            -- {"eth":true,"base":"GT","conv_roll":53}
  tier        quality_tier not null default 'unknown',
  variant_key text not null,             -- stable hash of (item_id || normalized axes) for dedup
  unique (item_id, variant_key)
);
create index on variant (item_id, tier);

-- ---------- trader (forum user) ----------
create table trader (
  id              serial primary key,
  d2jsp_user_id   text unique,           -- forum uid if captured
  username        text not null,
  -- rolling reputation, recomputed by aggregator:
  underprice_z    numeric,               -- avg z-score of their asks vs FMV (negative = cheap)
  reliability     numeric,               -- fraction of 'sold' that actually resolve
  volume_30d      int default 0,
  last_seen       timestamptz
);
create index on trader (username);

-- ---------- listing (a forum post) ----------
create table listing (
  id            serial primary key,
  d2jsp_post_id text unique,             -- forum post/thread id
  thread_id     text,
  trader_id     int references trader(id),
  season_id     int references season(id),
  url           text,
  raw_title     text,
  status        listing_status not null default 'listed',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);
create index on listing (status, last_seen desc);
create index on listing (trader_id);

-- ---------- post_snapshot (APPEND-ONLY — edits are the signal) ----------
-- Written by the scraper on every diff; the resolution engine reads consecutive
-- snapshots to detect title edits / sold markers / price changes.
create table post_snapshot (
  id           bigserial primary key,
  listing_id   int not null references listing(id) on delete cascade,
  captured_at  timestamptz not null default now(),
  raw_title    text,
  reply_count  int,
  body_hash    text                       -- cheap change-detection key
);
create index on post_snapshot (listing_id, captured_at desc);

-- ---------- listing_item (PER-ITEM resolution unit within a listing) ----------
-- Multi-item posts ("Enigma | Inf | Anni") resolve item-by-item, so the unit
-- of resolution is the line, not the thread.
create table listing_item (
  id                int generated always as identity primary key,
  listing_id        int not null references listing(id) on delete cascade,
  item_id           int not null references item(id),
  variant_id        int references variant(id),
  tier              quality_tier not null default 'unknown',  -- denormalized for fmv joins
  asking_price      numeric,
  asking_currency   text references currency(code),
  asking_price_fg   numeric,                                  -- normalized to FG via exchange_rate_obs
  status            listing_status not null default 'listed',
  resolution_conf   obs_confidence,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index on listing_item (item_id, tier, status);
create index on listing_item (listing_id);

-- ---------- price_observation (the FMV input rows) ----------
create table price_observation (
  id              bigserial primary key,
  item_id         int not null references item(id),
  variant_id      int references variant(id),
  tier            quality_tier not null default 'unknown',
  season_id       int references season(id),
  price_fg        numeric not null,        -- normalized to FG numeraire
  raw_price       numeric,
  raw_currency    text references currency(code),
  confidence      obs_confidence not null,
  listing_item_id int references listing_item(id),
  observed_at     timestamptz not null default now()
);
create index on price_observation (item_id, tier, observed_at desc);

-- ---------- iso_request (WTB / In-Search-Of posts) ----------
create table iso_request (
  id           serial primary key,
  item_id      int not null references item(id),
  tier_min     quality_tier,              -- minimum acceptable tier, if stated
  axes_filter  jsonb,                     -- e.g. {"eth":true} for "eth GT only"
  max_price_fg numeric,                   -- budget if stated
  trader_id    int references trader(id),
  status       text not null default 'open',  -- 'open' | 'filled' | 'expired'
  observed_at  timestamptz not null default now(),
  url          text
);
create index on iso_request (item_id, status);

-- ---------- inventory (your stash) ----------
create table inventory (
  id            serial primary key,
  item_id       int not null references item(id),
  variant_id    int references variant(id),
  tier          quality_tier not null default 'unknown',
  qty           int not null default 1,
  acquired_cost_fg numeric,               -- what it cost you (for P&L)
  notes         text,
  added_at      timestamptz not null default now()
);
create index on inventory (item_id);

-- =====================================================================
-- fmv_current : cheap trailing-window FMV approximation (read-side v1).
-- The real decay / censored-survival estimate runs in the off-Vercel
-- aggregator; this view exists so the panel/snipes have something to join.
-- bid = p25, mid = p50, ask = p75 over the last 21 days, confidence-gated.
-- =====================================================================
create view fmv_current as
select
  item_id,
  tier,
  count(*)                                                            as n,
  max(observed_at)                                                    as freshest,
  (percentile_cont(0.25) within group (order by price_fg))::numeric   as bid,
  (percentile_cont(0.50) within group (order by price_fg))::numeric   as mid,
  (percentile_cont(0.75) within group (order by price_fg))::numeric   as ask
from price_observation
where observed_at > now() - interval '21 days'
  and confidence >= 'ask_observed'        -- drop stale asks from the estimate
group by item_id, tier;
