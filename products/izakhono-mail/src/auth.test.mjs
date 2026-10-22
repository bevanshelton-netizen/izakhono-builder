import assert from 'node:assert/strict';
import test from 'node:test';
import { createUser, login, authenticate, revoke } from './auth.mjs';

const address = `test-${Date.now()}@izakhono`;
const password = 'IZAKHONO-Test-Password-2026!';

test('password authentication creates and validates a private identity session', () => {
  const user = createUser({ address, password, displayName: 'Test User' });
  assert.equal(user.address, address);
  const session = login({ address, password });
  assert.equal(session.address, address);
  const identity = authenticate(session.token);
  assert.equal(identity.address, address);
  assert.equal(revoke(session.token), true);
  assert.equal(authenticate(session.token), null);
});
