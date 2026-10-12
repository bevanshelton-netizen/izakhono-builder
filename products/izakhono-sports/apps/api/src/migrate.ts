import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';

export async function runMigrations(pool: Pool) {
  const dir = process.env.MIGRATIONS_DIR || path.resolve(process.cwd(), '../../migrations');
  const files = (await fs.readdir(dir)).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  await pool.query(`create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())`);
  await pool.query('select pg_advisory_lock(48172631)');
  try {
    for (const file of files) {
      const applied = await pool.query('select 1 from schema_migrations where version=$1', [file]);
      if (applied.rows[0]) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      await pool.query('begin');
      try {
        await pool.query(sql);
        await pool.query('insert into schema_migrations(version) values($1)', [file]);
        await pool.query('commit');
      } catch (error) {
        await pool.query('rollback');
        throw error;
      }
    }
  } finally {
    await pool.query('select pg_advisory_unlock(48172631)');
  }
}
