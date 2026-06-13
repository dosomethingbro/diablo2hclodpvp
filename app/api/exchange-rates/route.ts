import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ExchangeRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Best current FG ask/bid per rune over the last 3 days, with crossed-market flag
// (best_bid > best_ask = a real, momentary spread you could execute).
export async function GET() {
  const rows = await query<ExchangeRow>(
    `with recent as (
       select base_code, side, rate
         from exchange_rate_obs
        where quote_code = 'fg'
          and observed_at > now() - interval '3 days'
     )
     select base_code,
            min(rate) filter (where side = 'ask') as best_ask,
            max(rate) filter (where side = 'bid') as best_bid,
            (max(rate) filter (where side = 'bid'))
              - (min(rate) filter (where side = 'ask')) as spread,
            coalesce(max(rate) filter (where side='bid') > min(rate) filter (where side='ask'), false) as crossed
       from recent
      group by base_code
      order by base_code`,
  );
  return NextResponse.json({ rates: rows });
}
