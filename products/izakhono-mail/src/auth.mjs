import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const databasePath = process.env.MAIL_DATABASE_PATH || './izakhono-mail.sqlite';
const db = new DatabaseSync(databasePath);
db.exec(`CREATE TABLE IF NOT EXISTS mail_auth_users (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);`);
db.exec(`CREATE TABLE IF NOT EXISTS mail_auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);`);

const now = () => new Date().toISOString();
const id = p => `${p}_${crypto.randomUUID()}`;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}
function verifyPassword(password, stored) {
  const [scheme, salt, expected] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(actual, 'hex'); const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createUser({ address, password, displayName = '' }) {
  if (!/^.+@izakhono$/i.test(address || '')) throw new Error('IZAKHONO identity required');
  if (typeof password !== 'string' || password.length < 12) throw new Error('Password must be at least 12 characters');
  const canonical = address.toLowerCase();
  const existing = db.prepare('SELECT id FROM mail_auth_users WHERE address=?').get(canonical);
  if (existing) throw new Error('Identity already exists');
  const ts = now();
  db.prepare('INSERT INTO mail_auth_users(id,address,password_hash,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run(id('usr'), canonical, passwordHash(password), displayName, 'active', ts, ts);
  return { address: canonical, displayName };
}

export function login({ address, password, ttlHours = 12 }) {
  const canonical = String(address || '').toLowerCase();
  const user = db.prepare('SELECT * FROM mail_auth_users WHERE address=? AND status=\'active\'').get(canonical);
  if (!user || !verifyPassword(password, user.password_hash)) throw new Error('Invalid credentials');
  const token = crypto.randomBytes(32).toString('base64url');
  const ts = now(); const expires = new Date(Date.now() + ttlHours * 3600000).toISOString();
  db.prepare('INSERT INTO mail_auth_sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)')
    .run(id('ses'), user.id, hash(token), expires, ts, ts);
  db.prepare('UPDATE mail_auth_users SET last_login_at=?,updated_at=? WHERE id=?').run(ts, ts, user.id);
  return { token, address: user.address, displayName: user.display_name, expiresAt: expires };
}

export function authenticate(token) {
  if (!token) return null;
  const session = db.prepare(`SELECT s.*,u.address,u.display_name FROM mail_auth_sessions s JOIN mail_auth_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`).get(hash(token), now());
  if (!session) return null;
  db.prepare('UPDATE mail_auth_sessions SET last_seen_at=? WHERE id=?').run(now(), session.id);
  return { sessionId: session.id, address: session.address, displayName: session.display_name, expiresAt: session.expires_at };
}

export function revoke(token) {
  if (!token) return false;
  const result = db.prepare('UPDATE mail_auth_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL').run(now(), hash(token));
  return result.changes > 0;
}

export function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

export { db as authDb };
