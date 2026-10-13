const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 8080);
const VERSION = process.env.RELEASE_VERSION || 'allegro-vibez-v1.3';
const startedAt = new Date().toISOString();
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 10), ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } })
  : null;

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 1024 * 1024) req.destroy(new Error('request_too_large')); });
  req.on('end', () => { if (!body) return resolve({}); try { resolve(JSON.parse(body)); } catch (_) { reject(Object.assign(new Error('invalid_json'), { status: 400 })); } });
  req.on('error', reject);
});
const required = (body, fields) => { for (const field of fields) if (!String(body[field] ?? '').trim()) throw Object.assign(new Error(`${field}_required`), { status: 400 }); };

async function migrate() {
  if (!pool) return { configured: false, migrated: false, reason: 'DATABASE_URL_missing' };
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  return { configured: true, migrated: true };
}
async function dbHealth() {
  if (!pool) return { configured: false, ok: false, reason: 'DATABASE_URL_missing' };
  try { const r = await pool.query('SELECT 1 AS ok'); return { configured: true, ok: r.rows[0].ok === 1 }; }
  catch (error) { return { configured: true, ok: false, reason: error.code || error.message }; }
}
async function registerUser(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  required(body, ['email', 'displayName']);
  const email = String(body.email).trim().toLowerCase(); const displayName = String(body.displayName).trim();
  if (!email.includes('@')) throw Object.assign(new Error('valid_email_required'), { status: 400 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id,status FROM users WHERE email=$1 LIMIT 1', [email]);
    if (existing.rowCount) { await client.query('ROLLBACK'); return { id: existing.rows[0].id, status: existing.rows[0].status, existing: true }; }
    const id = crypto.randomUUID();
    await client.query(`INSERT INTO users (id,email,display_name,role,status) VALUES ($1,$2,$3,'creator','pending')`, [id,email,displayName]);
    await client.query(`INSERT INTO creator_profiles (user_id,stage_name,bio,country,genre) VALUES ($1,$2,'','South Africa','')`, [id,displayName]);
    await client.query(`INSERT INTO wallets (creator_id,available_minor,pending_minor,currency) VALUES ($1,0,0,'ZAR')`, [id]);
    await client.query('COMMIT'); return { id, status: 'pending', existing: false };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
}
async function createRelease(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  required(body, ['creatorId','title','audioUrl']);
  const id = crypto.randomUUID();
  await pool.query(`INSERT INTO releases (id,creator_id,title,release_type,artwork_url,audio_url,status,rights_confirmed) VALUES ($1,$2,$3,$4,$5,$6,'draft',FALSE)`, [id,body.creatorId,String(body.title).trim(),body.releaseType || 'single',body.artworkUrl || null,String(body.audioUrl).trim()]);
  return { id, status: 'draft', rightsConfirmed: false };
}
async function confirmRights(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  required(body, ['releaseId','creatorId']);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT id FROM releases WHERE id=$1 AND creator_id=$2 FOR UPDATE', [body.releaseId,body.creatorId]);
    if (!r.rowCount) throw Object.assign(new Error('release_not_found'), { status: 404 });
    await client.query(`INSERT INTO rights_records (id,release_id,creator_id,ownership_pct,publishing_status,evidence_ref) VALUES ($1,$2,$3,$4,$5,$6)`, [crypto.randomUUID(),body.releaseId,body.creatorId,Number(body.ownershipPct ?? 100),'self_declared',body.evidenceRef || null]);
    await client.query(`UPDATE releases SET rights_confirmed=TRUE WHERE id=$1`, [body.releaseId]);
    await client.query('COMMIT'); return { releaseId: body.releaseId, rightsConfirmed: true };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
}
async function submitRelease(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  required(body, ['releaseId','creatorId']);
  const r = await pool.query(`UPDATE releases SET status='submitted' WHERE id=$1 AND creator_id=$2 AND rights_confirmed=TRUE RETURNING id,status`, [body.releaseId,body.creatorId]);
  if (!r.rowCount) throw Object.assign(new Error('rights_confirmation_required_or_release_not_found'), { status: 409 });
  return r.rows[0];
}
async function moderateRelease(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  required(body, ['releaseId','moderatorId','decision']);
  if (!['approved','rejected'].includes(body.decision)) throw Object.assign(new Error('invalid_moderation_decision'), { status: 400 });
  const r = await pool.query(`UPDATE releases SET status=$1, released_at=CASE WHEN $1='approved' THEN NOW() ELSE NULL END WHERE id=$2 AND status='submitted' RETURNING id,status`, [body.decision,body.releaseId]);
  if (!r.rowCount) throw Object.assign(new Error('release_not_submitted'), { status: 409 });
  return { ...r.rows[0], moderatorId: body.moderatorId };
}
async function discover() {
  if (!pool) return { releases: [], mode: 'database-not-configured' };
  const r = await pool.query(`SELECT r.id,r.title,r.release_type,r.artwork_url,r.audio_url,cp.stage_name AS creator,r.created_at FROM releases r JOIN creator_profiles cp ON cp.user_id=r.creator_id WHERE r.status='approved' AND r.rights_confirmed=TRUE ORDER BY r.created_at DESC LIMIT 100`);
  return { releases: r.rows, mode: 'database' };
}
async function createTransaction(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  required(body, ['provider','providerReference','type','amountMinor']);
  const amountMinor = Number(body.amountMinor); if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw Object.assign(new Error('positive_integer_amountMinor_required'), { status: 400 });
  const id = crypto.randomUUID();
  try { await pool.query(`INSERT INTO transactions (id,user_id,creator_id,provider,provider_reference,type,amount_minor,currency,status,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)`, [id,body.userId || null,body.creatorId || null,body.provider,body.providerReference,body.type,amountMinor,body.currency || 'ZAR',body.metadata || {}]); }
  catch (error) { if (error.code === '23505') throw Object.assign(new Error('transaction_already_recorded'), { status: 409 }); throw error; }
  return { id, status: 'pending', amountMinor, currency: body.currency || 'ZAR' };
}
async function confirmTransaction(body) {
  if (!pool) throw Object.assign(new Error('DATABASE_URL_missing'), { status: 503 });
  required(body, ['provider','providerReference']);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query(`SELECT * FROM transactions WHERE provider=$1 AND provider_reference=$2 FOR UPDATE`, [body.provider,body.providerReference]);
    if (!t.rowCount) throw Object.assign(new Error('transaction_not_found'), { status: 404 });
    const tx = t.rows[0];
    if (tx.status === 'paid') { await client.query('COMMIT'); return { id: tx.id, status: 'paid', idempotent: true }; }
    await client.query(`UPDATE transactions SET status='paid' WHERE id=$1`, [tx.id]);
    if (tx.creator_id) {
      const royalty = Number(body.royaltyMinor ?? Math.floor(Number(tx.amount_minor) * Number(body.royaltyPct ?? 70) / 100));
      await client.query(`INSERT INTO royalty_ledger (id,creator_id,transaction_id,amount_minor,currency,entry_type) VALUES ($1,$2,$3,$4,$5,'sale')`, [crypto.randomUUID(),tx.creator_id,tx.id,royalty,tx.currency]);
      await client.query(`INSERT INTO wallets (creator_id,available_minor,pending_minor,currency) VALUES ($1,0,0,$2) ON CONFLICT (creator_id) DO NOTHING`, [tx.creator_id,tx.currency]);
      await client.query(`UPDATE wallets SET available_minor=available_minor+$1,updated_at=NOW() WHERE creator_id=$2`, [royalty,tx.creator_id]);
    }
    await client.query('COMMIT'); return { id: tx.id, status: 'paid', idempotent: false };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
}

let boot = null; if (pool) boot = migrate().catch(error => ({ configured:true,migrated:false,reason:error.code || error.message }));
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/v1/health')) {
      const migration = boot ? await boot : { configured:false,migrated:false }; const database = await dbHealth(); const ok = database.ok && migration.migrated;
      return json(res, ok || !pool ? 200 : 503, { ok: ok || !pool, service:'allegro-vibez-api',version:VERSION,startedAt,runtime:'izakhono-owned',database,migration });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/discover') return json(res,200,{ok:true,...await discover()});
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (url.pathname === '/api/v1/auth/register') return json(res,201,{ok:true,user:await registerUser(body),next:'verify'});
      if (url.pathname === '/api/v1/releases') return json(res,201,{ok:true,release:await createRelease(body)});
      if (url.pathname === '/api/v1/releases/rights') return json(res,200,{ok:true,rights:await confirmRights(body)});
      if (url.pathname === '/api/v1/releases/submit') return json(res,200,{ok:true,release:await submitRelease(body)});
      if (url.pathname === '/api/v1/releases/moderate') return json(res,200,{ok:true,moderation:await moderateRelease(body)});
      if (url.pathname === '/api/v1/transactions') return json(res,201,{ok:true,transaction:await createTransaction(body)});
      if (url.pathname === '/api/v1/payments/confirm') return json(res,200,{ok:true,transaction:await confirmTransaction(body)});
    }
    return json(res,404,{ok:false,error:'not_found'});
  } catch (error) { const status=Number(error.status || 500); return json(res,status,{ok:false,error:status===500?'internal_error':error.message}); }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`ALLEGRO VIBEZ runtime listening on ${PORT}`));
const shutdown=async()=>{await pool?.end().catch(()=>{});server.close(()=>process.exit(0));}; process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
