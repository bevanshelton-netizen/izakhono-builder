import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifySignedReleaseApproval } from './signed-release-approval.mjs';

const now = Date.parse('2026-11-26T10:00:00.000Z');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const statement = {
  version: 1,
  approvalId: 'approval-test-001',
  repository: 'bevanshelton-netizen/izakhono-builder',
  commitSha: 'a'.repeat(40),
  workload: 'izakhono-mail',
  environment: 'staging',
  action: 'deploy',
  approvedBy: 'test-owner',
  keyId: 'ephemeral-test-key',
  issuedAt: '2026-11-26T09:00:00.000Z',
  expiresAt: '2026-11-26T11:00:00.000Z',
};
const expected = {
  repository: statement.repository,
  commitSha: statement.commitSha,
  workload: statement.workload,
  environment: statement.environment,
  action: statement.action,
};
const keyring = { [statement.keyId]: { publicKey, principal: 'test-owner' } };
const canonical = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
};
const signature = sign(null, Buffer.from(canonical(statement)), privateKey).toString('base64url');
const verify = (overrides = {}, options = {}) => verifySignedReleaseApproval({
  statement: { ...statement, ...overrides }, signature, keyring, expected, now, ...options,
});

assert.equal(verify().ok, true);
assert.equal(verify({ commitSha: 'b'.repeat(40) }).reason, 'scope_mismatch_commitSha');
assert.equal(verify({ workload: 'other-app' }).reason, 'scope_mismatch_workload');
assert.equal(verify({ environment: 'production' }).reason, 'scope_mismatch_environment');
assert.equal(verify({ action: 'rollback' }).reason, 'scope_mismatch_action');
assert.equal(verify({}, { keyring: {} }).reason, 'unknown_key');
assert.equal(verify({}, { keyring: { [statement.keyId]: { publicKey, principal: 'test-owner', revokedAt: '2026-11-26T09:30:00.000Z' } } }).reason, 'revoked_key');
assert.equal(verify({}, { keyring: { [statement.keyId]: { publicKey } } }).reason, 'key_principal_missing');
assert.equal(verify({}, { keyring: { [statement.keyId]: { publicKey, principal: 'test-owner', notAfter: 'not-a-date' } } }).reason, 'invalid_key_lifecycle_timestamp');
assert.equal(verify({}, { keyring: { [statement.keyId]: { publicKey, principal: 'test-owner', notAfter: '2026-11-26T09:30:00.000Z' } } }).reason, 'key_expired');
assert.equal(verify({ approvalId: 'approval-test-tampered' }).reason, 'signature_invalid');
assert.equal(verify({}, { now: Date.parse('2026-11-26T12:00:00.000Z') }).reason, 'expired');
assert.equal(verify({ issuedAt: '2026-11-26T12:00:00.000Z' }).reason, 'issued_in_future');
assert.equal(verify({ approvedBy: 'different-owner' }).reason, 'principal_key_mismatch');
assert.equal(verify({}, { signature: 'invalid' }).reason, 'invalid_signature_encoding');
assert.equal(verify({}, { maxValidityMs: 30 * 60 * 1000 }).reason, 'invalid_validity_window');

console.log('NODE01_SIGNED_RELEASE_APPROVAL_TEST=PASS');
