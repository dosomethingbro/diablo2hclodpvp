import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { Item } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await query<Item>(
    `select id, slug, name, category, roll_axes from item order by category, name`,
  );
  return NextResponse.json({ items: rows });
}
