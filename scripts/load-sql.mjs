// Load one or more .sql files into DATABASE_URL using the pg driver — a psql-free
// replacement for `npm run db:schema` / `db:seed` (handy on Windows where psql isn't
// installed). Run with Node's --env-file so DATABASE_URL comes from .env:
//
//   node --env-file=.env scripts/load-sql.mjs db/schema.sql db/seed.sql
//
// Uses a single Client (not a Pool) on a direct connection — DDL belongs on the
// unpooled endpoint. If you only have the -pooler string, it still works for these
// files, but the direct host is preferred for schema loads.
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node --env-file=.env scripts/load-sql.mjs <file.sql> [more.sql ...]');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set (expected via --env-file=.env).');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  for (const file of files) {
    const sql = await readFile(file, 'utf8');
    process.stdout.write(`Loading ${file} ... `);
    await client.query(sql);
    console.log('ok');
  }
  console.log('All files loaded.');
} catch (err) {
  console.error(`\nFailed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
