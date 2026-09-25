import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const migrationsDir = path.resolve(process.cwd(), '../db');
const LOCK_ID = 24810401;
const RETRIES = Math.min(Math.max(Number(process.env.CONNECTA_DB_STARTUP_RETRIES || 30), 1), 120);
const RETRY_MS = Math.min(Math.max(Number(process.env.CONNECTA_DB_STARTUP_RETRY_MS || 2000), 250), 10000);

async function connectWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const client = new Client({
      connectionString,
      application_name: 'connecta-migrator',
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      if (attempt < RETRIES) {
        console.log(`CONNECTA database not ready (attempt ${attempt}/${RETRIES}); retrying...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      }
    }
  }
  throw lastError || new Error('CONNECTA database unavailable');
}

const client = await connectWithRetry();

try {
  await client.query('select pg_advisory_lock($1)', [LOCK_ID]);
  await client.query(`
    create table if not exists connecta_schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();

  for (const filename of files) {
    const exists = await client.query(
      'select 1 from connecta_schema_migrations where filename=$1',
      [filename],
    );
    if (exists.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into connecta_schema_migrations(filename) values($1)',
        [filename],
      );
      await client.query('commit');
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
  await client.end();
}
