import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { IsoRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Open ISO/WTB posts. ?match=1 flags the ones for items you hold in inventory.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const match = url.searchParams.get('match') === '1';

  const rows = await query<IsoRow>(
    `select r.id, r.item_id, i.slug as item_slug, i.name as item_name,
            r.tier_min, r.max_price_fg, r.status, r.observed_at, r.url,
            exists (select 1 from inventory inv where inv.item_id = r.item_id) as i_own
       from iso_request r
       join item i on i.id = r.item_id
      where r.status = 'open'
        and ($1::bool is false
             or exists (select 1 from inventory inv where inv.item_id = r.item_id))
      order by r.observed_at desc
      limit 200`,
    [match],
  );
  return NextResponse.json({ iso: rows });
}
