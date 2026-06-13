import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { SnipeRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Live listings priced at or below fmv bid * threshold. The snipe feed.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const threshold = Number(url.searchParams.get('threshold') ?? 0.8);

  const rows = await query<SnipeRow>(
    `select li.id, li.listing_id, li.item_id, i.slug as item_slug, i.name as item_name,
            li.tier, li.asking_price, li.asking_currency, li.asking_price_fg, li.status,
            l.url, t.username, l.last_seen,
            f.bid,
            round(li.asking_price_fg / nullif(f.bid, 0), 3) as price_ratio
       from listing_item li
       join item i        on i.id = li.item_id
       join listing l     on l.id = li.listing_id
       left join trader t on t.id = l.trader_id
       join fmv_current f on f.item_id = li.item_id and f.tier = li.tier
      where li.status in ('listed','bumped','price_edited')
        and li.asking_price_fg is not null
        and f.bid is not null
        and li.asking_price_fg <= f.bid * $1
      order by price_ratio asc
      limit 200`,
    [threshold],
  );
  return NextResponse.json({ threshold, snipes: rows });
}
