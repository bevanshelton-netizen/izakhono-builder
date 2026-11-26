import { verify as cryptoVerify } from 'node:crypto';

const REQUIRED_FIELDS = [
  'version', 'approvalId', 'repository', 'commitSha', 'workload',
  'environment', 'action', 'approvedBy', 'keyId', 'issuedAt', 'expiresAt',
];

function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non_finite_number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error('unsupported_object');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/**
 * Verify an Ed25519-signed release approval.
 *
 * keyring entries are supplied by the caller from an independently controlled
 * trust store. This module deliberately contains no production trust roots.
 */
export function verifySignedReleaseApproval({
  statement,
  signature,
  keyring,
  expected,
  now = Date.now(),
  clockSkewMs = 60_000,
  maxValidityMs = 7 * 24 * 60 * 60 * 1000,
}) {
  const fail = (reason) => ({ ok: false, reason });
  if (!statement || typeof statement !== 'object' || Array.isArray(statement)) return fail('invalid_statement');
  if (REQUIRED_FIELDS.some((field) => !Object.hasOwn(statement, field))) return fail('missing_field');
  if (statement.version !== 1) return fail('unsupported_version');
  if (!/^[0-9a-f]{40}$/.test(statement.commitSha)) return fail('invalid_commit_sha');
  if (typeof statement.approvalId !== 'string' || !statement.approvalId.trim()) return fail('invalid_approval_id');
  if (REQUIRED_FIELDS.some((field) => typeof statement[field] !== 'string' || !statement[field].trim() && field !== 'version')) {
    return fail('invalid_field');
  }
  if (!validTimestamp(statement.issuedAt) || !validTimestamp(statement.expiresAt)) return fail('invalid_timestamp');

  const issuedAt = Date.parse(statement.issuedAt);
  const expiresAt = Date.parse(statement.expiresAt);
  if (issuedAt > now + clockSkewMs) return fail('issued_in_future');
  if (expiresAt <= now) return fail('expired');
  if (expiresAt <= issuedAt || expiresAt - issuedAt > maxValidityMs) return fail('invalid_validity_window');

  const key = keyring?.[statement.keyId];
  if (!key || !key.publicKey) return fail('unknown_key');
  if (key.revokedAt && Date.parse(key.revokedAt) <= now) return fail('revoked_key');
  if (key.notBefore && Date.parse(key.notBefore) > now + clockSkewMs) return fail('key_not_yet_valid');
  if (key.notAfter && Date.parse(key.notAfter) <= now) return fail('key_expired');
  if (key.principal && key.principal !== statement.approvedBy) return fail('principal_key_mismatch');

  const scopeFields = ['repository', 'commitSha', 'workload', 'environment', 'action'];
  for (const field of scopeFields) {
    if (expected?.[field] !== statement[field]) return fail(`scope_mismatch_${field}`);
  }

  if (typeof signature !== 'string' || !/^[A-Za-z0-9_-]+$/.test(signature)) return fail('invalid_signature_encoding');
  let signatureBytes;
  try {
    signatureBytes = Buffer.from(signature, 'base64url');
    if (signatureBytes.length !== 64 || signatureBytes.toString('base64url') !== signature) return fail('invalid_signature_encoding');
    if (!cryptoVerify(null, Buffer.from(canonicalize(statement)), key.publicKey, signatureBytes)) return fail('signature_invalid');
  } catch {
    return fail('signature_invalid');
  }

  return { ok: true, reason: 'verified', approvalId: statement.approvalId, keyId: statement.keyId };
}
