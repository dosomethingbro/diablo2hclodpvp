import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ListingItemRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('item');
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);

  const rows = await query<ListingItemRow>(
    `select li.id, li.listing_id, li.item_id, i.slug as item_slug, i.name as item_name,
            li.tier, li.asking_price, li.asking_currency, li.asking_price_fg, li.status,
            l.url, t.username, l.last_seen
       from listing_item li
       join item i    on i.id = li.item_id
       join listing l on l.id = li.listing_id
       left join trader t on t.id = l.trader_id
      where ($1::text is null or i.slug = $1)
        and ($2::text is null or li.status = $2::listing_status)
      order by l.last_seen desc
      limit $3`,
    [slug, status, limit],
  );
  return NextResponse.json({ listings: rows });
}
