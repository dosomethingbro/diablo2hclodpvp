import { Pool, QueryResultRow } from 'pg';

// Serverless-safe singleton. On Vercel, warm invocations reuse this module scope,
// so we keep one small pool. IMPORTANT: use the POOLED connection string
// (Neon `-pooler` host / Supabase 6543 pooler) — a per-invocation pool against a
// direct connection will exhaust Postgres under concurrency.
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  return new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
}

const pool = global._pgPool ?? makePool();
if (process.env.NODE_ENV !== 'production') global._pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}
