import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const db = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_SIZE || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'connecta-engine',
});

db.on('error', (error) => {
  console.error('CONNECTA database pool error:', error.message);
});

export async function query(text, params = []) {
  return db.query(text, params);
}

export async function transaction(work) {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
