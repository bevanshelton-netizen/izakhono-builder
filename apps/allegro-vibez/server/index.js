const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 8080);
const VERSION = process.env.RELEASE_VERSION || 'allegro-vibez-v1.2';
const startedAt = new Date().toISOString();
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 10), ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } })
  : null;

const json = (res, status, body) => {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(data);
};

const readBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1024 * 1024) req.destroy(new Error('request_too_large'));
  });
  req.on('end', () => {
    if (!body) return resolve({});
    try { resolve(JSON.parse(body)); } catch (_) { reject(Object.assign(new Error('invalid_json'), { status: 400 })); }
  });
  req.on('error', reject);
});

async function migrate() {
  if (!pool) return { configured: false, migrated: false, reason: 'DATABASE_URL_missing' };
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  return { configured: true, migrated: true };
}

async function dbHealth() {
  if (!pool) return { configured: false, ok: false, reason: 'DATABASE_URL_missing' };
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return { configured: true, ok: result.rows[0].ok === 1 };
  } catch (error) {
    return { configured: true, ok: false, reason: error.code || error.message };
  }
}

async function registerUser(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  const email = String(body.email || '').trim().toLowerCase();
  const displayName = String(body.displayName || '').trim();
  if (!email || !email.includes('@')) throw Object.assign(new Error('valid_email_required'), { status: 400 });
  if (!displayName) throw Object.assign(new Error('display_name_required'), { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id, status FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return { id: existing.rows[0].id, status: existing.rows[0].status, existing: true };
    }
    const id = crypto.randomUUID();
    await client.query(`INSERT INTO users (id, email, display_name, role, status) VALUES ($1, $2, $3, 'creator', 'pending')`, [id, email, displayName]);
    await client.query(`INSERT INTO creator_profiles (user_id, stage_name, bio, country, genre) VALUES ($1, $2, '', 'South Africa', '')`, [id, displayName]);
    await client.query(`INSERT INTO wallets (creator_id, available_minor, pending_minor, currency) VALUES ($1, 0, 0, 'ZAR')`, [id]);
    await client.query('COMMIT');
    return { id, status: 'pending', existing: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function discover() {
  if (!pool) return { releases: [], mode: 'database-not-configured' };
  const result = await pool.query(`SELECT r.id, r.title, r.release_type, r.artwork_url, r.audio_url, cp.stage_name AS creator, r.created_at FROM releases r JOIN creator_profiles cp ON cp.user_id = r.creator_id WHERE r.status = 'approved' AND r.rights_confirmed = TRUE ORDER BY r.created_at DESC LIMIT 100`);
  return { releases: result.rows, mode: 'database' };
}

let boot = null;
if (pool) boot = migrate().catch(error => { console.error('database migration failed', error); return { configured: true, migrated: false, reason: error.code || error.message }; });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const migration = boot ? await boot : { configured: false, migrated: false };
      const database = await dbHealth();
      const ok = database.ok && migration.migrated;
      return json(res, ok || !pool ? 200 : 503, { ok: ok || !pool, service: 'allegro-vibez', version: VERSION, startedAt, runtime: 'izakhono-owned', database, migration });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/health') {
      const migration = boot ? await boot : { configured: false, migrated: false };
      const database = await dbHealth();
      const ok = database.ok && migration.migrated;
      return json(res, ok || !pool ? 200 : 503, { ok: ok || !pool, service: 'allegro-vibez-api', version: VERSION, runtime: 'izakhono-owned', database, migration });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/discover') return json(res, 200, { ok: true, ...(await discover()) });
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/register') {
      const body = await readBody(req);
      const user = await registerUser(body);
      return json(res, user.existing ? 200 : 201, { ok: true, user, next: 'verify' });
    }
    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    const status = Number(error.status || 500);
    return json(res, status, { ok: false, error: status === 500 ? 'internal_error' : error.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`ALLEGRO VIBEZ runtime listening on ${PORT}`));
const shutdown = async () => { await pool?.end().catch(() => {}); server.close(() => process.exit(0)); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
