import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { InventoryRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Your stash marked to market at the FMV *bid* (liquidation value), with P&L.
export async function GET() {
  const rows = await query<InventoryRow>(
    `select inv.id, inv.item_id, i.slug as item_slug, i.name as item_name, inv.tier,
            inv.qty, inv.acquired_cost_fg, inv.notes,
            f.bid, f.mid,
            (f.bid * inv.qty)                                   as liq_value,
            (f.bid * inv.qty) - coalesce(inv.acquired_cost_fg,0) as unrealized_fg
       from inventory inv
       join item i on i.id = inv.item_id
       left join fmv_current f on f.item_id = inv.item_id and f.tier = inv.tier
      order by liq_value desc nulls last`,
  );
  const total = rows.reduce((s, r) => s + (Number(r.liq_value) || 0), 0);
  return NextResponse.json({ portfolio_liq_value_fg: total, inventory: rows });
}
