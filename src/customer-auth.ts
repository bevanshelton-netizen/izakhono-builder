export interface CustomerAuthDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export interface CustomerIdentity {
  id: string;
  email: string;
  display_name: string;
  organization: string;
  status: string;
}

const ITERATIONS = 310_000;
const KEY_BYTES = 32;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array {
  if (!/^(?:[a-f0-9]{2})+$/i.test(value)) throw new Error('Invalid encoded value');
  return Uint8Array.from(value.match(/.{2}/g) || [], part => Number.parseInt(part, 16));
}

function randomHex(bytes = 16): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toHex(value);
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, KEY_BYTES * 8);
  return new Uint8Array(bits);
}

export function validateCustomerPassword(password: string): void {
  if (password.length < 12 || password.length > 128) {
    throw new Error('Password must be between 12 and 128 characters');
  }
}

export async function hashCustomerPassword(password: string): Promise<string> {
  validateCustomerPassword(password);
  const salt = fromHex(randomHex(16));
  const key = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(key)}`;
}

export async function verifyCustomerPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  try {
    const expected = fromHex(parts[3]);
    if (expected.length !== KEY_BYTES) return false;
    const actual = await derive(password, fromHex(parts[2]), iterations);
    return actual.reduce((diff, byte, index) => diff | (byte ^ expected[index]), 0) === 0;
  } catch {
    return false;
  }
}

async function digest(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function createCustomerSession(
  db: CustomerAuthDB,
  customerId: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: string }> {
  const token = randomHex(32);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.prepare(
    'INSERT INTO builder_customer_sessions(id,customer_id,token_hash,expires_at,created_at,last_used_at) VALUES(?,?,?,?,?,?)',
  ).bind(`bcs_${randomHex(16)}`, customerId, await digest(token), expiresAt, now.toISOString(), now.toISOString()).run();
  return { token, expiresAt };
}

export async function resolveCustomerSession(
  db: CustomerAuthDB,
  token: string,
  now = new Date(),
): Promise<CustomerIdentity | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const row = await db.prepare(
    `SELECT c.id,c.email,c.display_name,c.organization,c.status,s.id AS session_id
     FROM builder_customer_sessions s
     JOIN builder_customers c ON c.id=s.customer_id
     WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND c.status='active'
     LIMIT 1`,
  ).bind(await digest(token), now.toISOString()).first<CustomerIdentity & { session_id: string }>();
  if (!row) return null;
  await db.prepare('UPDATE builder_customer_sessions SET last_used_at=? WHERE id=?')
    .bind(now.toISOString(), row.session_id).run();
  return { id: row.id, email: row.email, display_name: row.display_name, organization: row.organization, status: row.status };
}

export async function revokeCustomerSession(db: CustomerAuthDB, token: string, now = new Date()): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return;
  await db.prepare('UPDATE builder_customer_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
    .bind(now.toISOString(), await digest(token)).run();
}
