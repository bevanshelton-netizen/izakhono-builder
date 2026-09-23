import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const migrationsDir = path.resolve(process.cwd(), '../db');
const client = new Client({ connectionString, application_name: 'connecta-migrator' });
await client.connect();

try {
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
  await client.end();
}
