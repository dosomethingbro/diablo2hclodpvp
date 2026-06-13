import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { FmvRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('item');
  const tier = url.searchParams.get('tier');

  const rows = await query<FmvRow & { slug: string; name: string }>(
    `select i.slug, i.name, f.item_id, f.tier, f.n, f.freshest, f.bid, f.mid, f.ask
       from fmv_current f
       join item i on i.id = f.item_id
      where ($1::text is null or i.slug = $1)
        and ($2::text is null or f.tier = $2::quality_tier)
      order by i.name, f.tier`,
    [slug, tier],
  );
  return NextResponse.json({ fmv: rows });
}
