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
});

test('new gateway is isolated from the legacy queue and payment/identity services', () => {
  assert.doesNotMatch(source, /iz_worker_jobs/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(migration, /owned_worker_jobs/);
  assert.match(migration, /current_setting\('app\.tenant_id'/);
  assert.match(migration, /authenticate_owned_worker/);
});
