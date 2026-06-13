import { query } from '@/lib/db';
import type { SnipeRow, FmvRow, InventoryRow, IsoRow, ExchangeRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Server component: reads directly via the same db layer the API routes use.
async function load() {
  const snipes = await query<SnipeRow & { item_name: string }>(
    `select li.item_id, i.name as item_name, li.tier, li.asking_price_fg, l.url, t.username,
            f.bid, round(li.asking_price_fg / nullif(f.bid,0),3) as price_ratio
       from listing_item li
       join item i on i.id=li.item_id
       join listing l on l.id=li.listing_id
       left join trader t on t.id=l.trader_id
       join fmv_current f on f.item_id=li.item_id and f.tier=li.tier
      where li.status in ('listed','bumped','price_edited')
        and li.asking_price_fg is not null and f.bid is not null
        and li.asking_price_fg <= f.bid * 0.9
      order by price_ratio asc limit 25`);

  const fmv = await query<FmvRow & { name: string }>(
    `select i.name, f.item_id, f.tier, f.n, f.bid, f.mid, f.ask
       from fmv_current f join item i on i.id=f.item_id
      order by i.name, f.tier`);

  const inv = await query<InventoryRow>(
    `select inv.id, i.name as item_name, inv.tier, inv.qty, inv.acquired_cost_fg,
            f.bid, (f.bid*inv.qty) as liq_value,
            (f.bid*inv.qty)-coalesce(inv.acquired_cost_fg,0) as unrealized_fg
       from inventory inv join item i on i.id=inv.item_id
       left join fmv_current f on f.item_id=inv.item_id and f.tier=inv.tier
      order by liq_value desc nulls last`);

  const iso = await query<IsoRow>(
    `select r.id, i.name as item_name, i.slug as item_slug, r.tier_min, r.max_price_fg,
            exists(select 1 from inventory v where v.item_id=r.item_id) as i_own
       from iso_request r join item i on i.id=r.item_id
      where r.status='open' order by r.observed_at desc limit 25`);

  const fx = await query<ExchangeRow>(
    `with recent as (select base_code, side, rate from exchange_rate_obs
                      where quote_code='fg' and observed_at > now()-interval '3 days')
     select base_code,
            min(rate) filter (where side='ask') as best_ask,
            max(rate) filter (where side='bid') as best_bid,
            coalesce(max(rate) filter (where side='bid') > min(rate) filter (where side='ask'),false) as crossed
       from recent group by base_code order by base_code`);

  return { snipes, fmv, inv, iso, fx };
}

export default async function Page() {
  let data;
  try { data = await load(); }
  catch (e) {
    return (
      <main>
        <h1>D2JSP HC Ladder Panel</h1>
        <p className="warn">DB not reachable. Set <code>DATABASE_URL</code>, then run
          <code> npm run db:schema &amp;&amp; npm run db:seed</code>.</p>
        <p className="muted">{String((e as Error).message)}</p>
      </main>
    );
  }
  const { snipes, fmv, inv, iso, fx } = data;
  const portfolio = inv.reduce((s, r) => s + (Number(r.liq_value) || 0), 0);

  return (
    <main>
      <h1>D2JSP HC Ladder Panel <span className="muted">· S14 RotW HC · read side</span></h1>

      <h2>Snipes (≤ 0.9× FMV bid)</h2>
      <table><thead><tr><th>Item</th><th>Tier</th><th>Ask (fg)</th><th>FMV bid</th><th>Ratio</th><th>Seller</th><th></th></tr></thead>
      <tbody>{snipes.length ? snipes.map((s, k) => (
        <tr key={k}><td>{s.item_name}</td><td><span className="tag">{s.tier}</span></td>
          <td className="good">{s.asking_price_fg}</td><td>{s.bid}</td>
          <td className="good">{s.price_ratio}×</td><td className="muted">{s.username ?? '—'}</td>
          <td>{s.url ? <a href={s.url} target="_blank">post</a> : null}</td></tr>
      )) : <tr><td colSpan={7} className="muted">No snipes (seed data has none under threshold).</td></tr>}</tbody></table>

      <h2>FMV board</h2>
      <table><thead><tr><th>Item</th><th>Tier</th><th>n</th><th>bid</th><th>mid</th><th>ask</th></tr></thead>
      <tbody>{fmv.map((f, k) => (
        <tr key={k}><td>{f.name}</td><td><span className="tag">{f.tier}</span></td>
          <td className="muted">{f.n}</td><td>{f.bid}</td><td>{f.mid}</td><td>{f.ask}</td></tr>
      ))}</tbody></table>

      <h2>Stash — marked to market @ bid · {portfolio.toFixed(0)} fg</h2>
      <table><thead><tr><th>Item</th><th>Tier</th><th>Qty</th><th>Cost</th><th>Liq value</th><th>Unrealized</th></tr></thead>
      <tbody>{inv.map((r, k) => (
        <tr key={k}><td>{r.item_name}</td><td><span className="tag">{r.tier}</span></td><td>{r.qty}</td>
          <td className="muted">{r.acquired_cost_fg ?? '—'}</td><td>{r.liq_value ?? '—'}</td>
          <td className={Number(r.unrealized_fg) >= 0 ? 'good' : 'warn'}>{r.unrealized_fg ?? '—'}</td></tr>
      ))}</tbody></table>

      <h2>ISO matches</h2>
      <table><thead><tr><th>Item</th><th>Min tier</th><th>Budget (fg)</th><th>You hold?</th></tr></thead>
      <tbody>{iso.map((r, k) => (
        <tr key={k}><td>{r.item_name}</td><td>{r.tier_min ?? '—'}</td><td>{r.max_price_fg ?? '—'}</td>
          <td className={r.i_own ? 'good' : 'muted'}>{r.i_own ? 'yes — list it' : 'no'}</td></tr>
      ))}</tbody></table>

      <h2>Rune ↔ FG</h2>
      <table><thead><tr><th>Rune</th><th>Best ask (sell to you)</th><th>Best bid (buy from you)</th><th>Crossed?</th></tr></thead>
      <tbody>{fx.map((r, k) => (
        <tr key={k}><td>{r.base_code.toUpperCase()}</td><td>{r.best_ask ?? '—'}</td><td>{r.best_bid ?? '—'}</td>
          <td className={r.crossed ? 'good' : 'muted'}>{r.crossed ? 'ARB' : '—'}</td></tr>
      ))}</tbody></table>
    </main>
  );
}
