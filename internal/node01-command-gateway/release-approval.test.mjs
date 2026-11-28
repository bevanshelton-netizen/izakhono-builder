import assert from 'node:assert/strict';
import { evaluateApprovedRelease } from './release-approval.mjs';

const approved = 'a'.repeat(40);
const different = 'b'.repeat(40);

assert.deepEqual(
  evaluateApprovedRelease({ approved_ref: approved }, approved),
  { ok: true, reason: 'approved_exact_match' },
);

assert.equal(
  evaluateApprovedRelease({}, approved).reason,
  'missing_or_invalid_approval',
);
assert.equal(
  evaluateApprovedRelease({ approved_ref: '' }, approved).reason,
  'missing_or_invalid_approval',
);
assert.equal(
  evaluateApprovedRelease({ approved_ref: 'not-a-commit' }, approved).reason,
  'missing_or_invalid_approval',
);
assert.equal(
  evaluateApprovedRelease({ approved_ref: approved }, different).reason,
  'ref_mismatch',
);
assert.equal(
  evaluateApprovedRelease({ approved_ref: approved }, 'invalid').reason,
  'invalid_requested_ref',
);

console.log('NODE01_APPROVED_RELEASE_PINNING_TEST=PASS');
