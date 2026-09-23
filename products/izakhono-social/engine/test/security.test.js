import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  hashToken,
  normalizeHandle,
  validHandle,
} from '../src/security.js';

test('password hashes verify without storing plaintext', async () => {
  const password = 'correct horse battery staple';
  const stored = await hashPassword(password);
  assert.equal(await verifyPassword(password, stored.salt, stored.hash), true);
  assert.equal(await verifyPassword('wrong password', stored.salt, stored.hash), false);
  assert.notEqual(stored.hash, password);
});

test('session tokens hash deterministically', () => {
  const session = newSessionToken();
  assert.equal(hashToken(session.token), session.tokenHash);
  assert.notEqual(session.token, session.tokenHash);
});

test('handles are normalized and validated', () => {
  assert.equal(normalizeHandle('@Bevan.Shelton'), 'bevan.shelton');
  assert.equal(validHandle('bevan.shelton'), true);
});
