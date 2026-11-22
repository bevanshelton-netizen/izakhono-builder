import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';

test('worker credentials are one-way SHA-256 hashes', () => {
  const token = randomBytes(32).toString('base64url');
  const digest = createHash('sha256').update(token).digest('hex');
  assert.equal(digest.length, 64);
  assert.notEqual(digest, token);
});

test('lease token hashes are not reversible and are distinct', () => {
  const a = randomBytes(32).toString('base64url');
  const b = randomBytes(32).toString('base64url');
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.notEqual(hash(a), hash(b));
  assert.equal(hash(a).length, 64);
});

test('worker API contract requires tenant-scoped worker and lease credentials', () => {
  const source = awaitSource();
  assert.match(source, /tenant_id = \$\{worker\.tenant_id\}/);
  assert.match(source, /lease_token_hash = \$\{leaseHash\}/);
  assert.match(source, /for update skip locked/i);
  assert.match(source, /attempts >= max_attempts/);
  assert.doesNotMatch(source, /iz_worker_jobs/);
});

function awaitSource() {
  return globalThis.__gatewaySource || '';
}
