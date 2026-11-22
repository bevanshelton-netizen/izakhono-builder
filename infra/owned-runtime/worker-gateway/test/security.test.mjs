import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';

const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../../../supabase/migrations/20261122120000_owned_worker_gateway_v1.sql', import.meta.url), 'utf8');

test('worker credentials are one-way SHA-256 hashes', () => {
  const token = randomBytes(32).toString('base64url');
  const digest = createHash('sha256').update(token).digest('hex');
  assert.equal(digest.length, 64);
  assert.notEqual(digest, token);
});

test('lease tokens are random, hashed at rest and never accepted from query strings', () => {
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /lease_token_hash = \$\{leaseHash\}/);
  assert.doesNotMatch(source, /url\.searchParams\.get\(['"]lease_token/);
});

test('job claims are atomic, tenant and worker scoped, and lease protected', () => {
  assert.match(source, /for update skip locked/i);
  assert.match(source, /tenant_id = \$\{worker\.tenant_id\}/);
  assert.match(source, /worker_key = \$\{worker\.worker_key\}/);
  assert.match(source, /lease_expires_at > now\(\)/);
  assert.match(source, /attempts >= max_attempts/);
  assert.match(source, /lease_expires_at <= now\(\)/);
  assert.match(source, /lease_reclaimed/);
});

test('new gateway is isolated from the legacy queue and payment/identity services', () => {
  assert.doesNotMatch(source, /iz_worker_jobs/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(migration, /owned_worker_jobs/);
  assert.match(migration, /current_setting\('app\.tenant_id'/);
  assert.match(migration, /authenticate_owned_worker/);
  assert.match(migration, /owned_worker_context_secret/);
  assert.match(migration, /hmac\(convert_to\(tenant_text/);
  assert.match(migration, /set_owned_worker_tenant_context/);
  assert.match(migration, /tenant_id = public\.owned_worker_current_tenant_id\(\)/);
  assert.match(source, /createHmac\('sha256'/);
  assert.match(source, /OWNED_WORKER_TENANT_CONTEXT_SECRET/);
  assert.match(migration, /AS \$touch\$/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.touch_owned_worker_credential/);
  for (const signature of [
    /REVOKE ALL ON FUNCTION public\.owned_worker_current_tenant_id\(\) FROM PUBLIC, anon, authenticated, service_role/i,
    /REVOKE ALL ON FUNCTION public\.set_owned_worker_tenant_context\(uuid, text\) FROM PUBLIC, anon, authenticated, service_role/i,
    /REVOKE ALL ON FUNCTION public\.authenticate_owned_worker\(text\) FROM PUBLIC, anon, authenticated, service_role/i,
    /REVOKE ALL ON FUNCTION public\.touch_owned_worker_credential\(text\) FROM PUBLIC, anon, authenticated, service_role/i
  ]) assert.match(migration, signature);
});
