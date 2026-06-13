-- Minimal seed: season, currencies, chase items + aliases + variants, and a few
-- price observations so fmv_current / the dashboard isn't empty on first boot.

insert into season (name, realm, started_at) values
  ('S14', 'rotw_hc_ladder', now() - interval '40 days');

insert into currency (code, kind, display_name) values
  ('fg','fg','Forum Gold'),
  ('ber','rune','Ber'), ('jah','rune','Jah'), ('sur','rune','Sur'),
  ('lo','rune','Lo'),  ('ohm','rune','Ohm'), ('vex','rune','Vex'),
  ('gul','rune','Gul'), ('mal','rune','Mal'), ('ist','rune','Ist');

insert into item (slug, name, category, roll_axes) values
  ('infinity','Infinity','runeword','["eth","base","conv_roll"]'),
  ('grief','Grief','runeword','["base","ias","dmg"]'),
  ('enigma','Enigma','runeword','["base"]'),
  ('hoto','Heart of the Oak','runeword','["mana_roll"]'),
  ('fortitude','Fortitude','runeword','["ed_roll"]'),
  ('cta','Call to Arms','runeword','["bo_roll","base"]'),
  ('spirit','Spirit','runeword','["fcr_roll","base"]'),
  ('shako','Harlequin Crest','unique','[]'),
  ('maras','Mara''s Kaleidoscope','unique','["res_roll"]'),
  ('anni','Annihilus','charm','["stat_roll","res_roll"]'),
  ('torch','Hellfire Torch','charm','["class","stat_roll","res_roll"]'),
  ('ber','Ber Rune','rune','[]'),
  ('jah','Jah Rune','rune','[]');

insert into item_alias (alias, item_id)
select a.alias, i.id from item i
join (values
  ('inf','infinity'), ('infinity','infinity'),
  ('grief','grief'),
  ('enig','enigma'), ('enigma','enigma'),
  ('hoto','hoto'), ('heart of the oak','hoto'),
  ('fort','fortitude'), ('fortitude','fortitude'),
  ('cta','cta'), ('call to arms','cta'),
  ('spirit','spirit'),
  ('shako','shako'), ('harle','shako'), ('harlequin crest','shako'),
  ('mara','maras'), ('maras','maras'),
  ('anni','anni'), ('annihilus','anni'),
  ('torch','torch'), ('hellfire torch','torch')
) as a(alias, slug) on a.slug = i.slug;

insert into variant (item_id, axes, tier, variant_key)
select i.id, v.axes::jsonb, v.tier::quality_tier, v.vkey from item i
join (values
  ('infinity','{"eth":true,"base":"GT","conv_roll":55}','perfect','inf-eth-gt-55'),
  ('infinity','{"eth":true,"base":"CA","conv_roll":50}','high','inf-eth-ca-50'),
  ('infinity','{"eth":false,"base":"CA","conv_roll":47}','mid','inf-ca-47'),
  ('grief','{"base":"PB","ias":40,"dmg":400}','perfect','grief-pb-40-400'),
  ('grief','{"base":"PB","ias":35,"dmg":370}','high','grief-pb-35-370'),
  ('enigma','{"base":"Archon"}','high','enig-archon'),
  ('enigma','{"base":"Dusk"}','mid','enig-dusk'),
  ('shako','{}','mid','shako-std'),
  ('anni','{"stat_roll":20,"res_roll":20}','perfect','anni-20-20')
) as v(slug, axes, tier, vkey) on v.slug = i.slug;

insert into exchange_rate_obs (season_id, base_code, quote_code, rate, side) values
  (1,'ber','fg',80,'ask'), (1,'ber','fg',90,'bid'),   -- crossed: bid>ask = real spread
  (1,'jah','fg',95,'ask'), (1,'jah','fg',92,'bid');

insert into price_observation (item_id, tier, season_id, price_fg, raw_currency, confidence)
select i.id, p.tier::quality_tier, 1, p.price, 'fg', p.conf::obs_confidence from item i
join (values
  ('shako','mid',45,'fill_confirmed'), ('shako','mid',50,'ask_observed'), ('shako','mid',48,'sold_price_unknown'),
  ('infinity','high',520,'ask_observed'), ('infinity','high',480,'fill_confirmed'), ('infinity','high',560,'ask_observed'),
  ('grief','perfect',300,'ask_observed'), ('grief','perfect',270,'fill_confirmed'),
  ('enigma','high',240,'ask_observed'), ('enigma','high',210,'sold_price_unknown')
) as p(slug, tier, price, conf) on p.slug = i.slug;

insert into iso_request (item_id, tier_min, max_price_fg, status)
select id, 'high'::quality_tier, 500, 'open' from item where slug='infinity';

insert into inventory (item_id, tier, qty, acquired_cost_fg, notes)
select id, 'mid'::quality_tier, 1, 30, 'on character' from item where slug='shako';

-- A live, underpriced listing so the snipe feed demonstrates end-to-end.
-- Infinity 'high' FMV bid is ~500fg; this lists at 420fg => 0.84x => a snipe.
insert into trader (username, underprice_z, reliability, volume_30d)
  values ('FastFlipper', -1.4, 0.92, 37);

insert into listing (d2jsp_post_id, thread_id, trader_id, season_id, url, raw_title, status)
  select 'post_demo_1','thr_1', t.id, 1,
         'https://forums.d2jsp.org/topic.php?t=demo',
         'WTS ~ Eth CA Infinity 50 ~ 420fg bin', 'listed'
    from trader t where t.username='FastFlipper';

insert into listing_item (listing_id, item_id, variant_id, tier, asking_price, asking_currency, asking_price_fg, status)
  select l.id, i.id, v.id, 'high', 420, 'fg', 420, 'listed'
    from listing l, item i, variant v
   where l.d2jsp_post_id='post_demo_1' and i.slug='infinity' and v.variant_key='inf-eth-ca-50';
