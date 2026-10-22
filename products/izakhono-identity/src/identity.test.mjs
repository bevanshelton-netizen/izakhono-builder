import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentity, ensureIdentity, getIdentity, normalizeAddress, validateIdentity } from './identity.mjs';

test('normalizes and validates IZAKHONO identity', () => {
  assert.equal(normalizeAddress('Bevan@IZAKHONO'), 'bevan@izakhono');
});

test('creates canonical owner identity idempotently', () => {
  const first = createIdentity('bevan@izakhono', { displayName: 'Bevan Shelton', role: 'owner' });
  const second = ensureIdentity('BEVAN@IZAKHONO');
  assert.equal(first.address, 'bevan@izakhono');
  assert.equal(first.identityId, second.identityId);
  assert.equal(getIdentity('bevan@izakhono').mailbox, 'bevan@izakhono');
});

test('rejects identities outside the private namespace', () => {
  assert.throws(() => normalizeAddress('bevan@example.com'), /invalid_izakhono_identity/);
});

test('reports identity existence', () => {
  const result = validateIdentity('bevan@izakhono');
  assert.equal(result.valid, true);
  assert.equal(result.exists, true);
});
