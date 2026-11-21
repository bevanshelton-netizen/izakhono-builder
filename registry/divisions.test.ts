import assert from 'node:assert/strict';
import { DIVISIONS, getDivision, validateDivisionRegistry, workersForDivision } from './divisions';

const validation = validateDivisionRegistry();
assert.equal(validation.valid, true, JSON.stringify(validation));
assert.equal(DIVISIONS.length, 15);
assert.equal(new Set(DIVISIONS.map((division) => division.id)).size, 15);
assert.ok(DIVISIONS.every((division) => division.mandate.length > 20));
assert.ok(DIVISIONS.every((division) => division.accountableRole.length > 0));
assert.ok(DIVISIONS.every((division) => division.defaultApprovalBoundaries.length > 0));

const security = getDivision('security-fortress');
assert.ok(security);
assert.ok(security.workerIds.includes('prompt-policy-worker'));
assert.ok(workersForDivision('security-fortress').some((worker) => worker.id === 'credential-worker'));
assert.deepEqual(workersForDivision('unknown-division'), []);

console.log('[PASS] IZAKHONO division registry: 15 divisions mapped to existing specialist workers with measurable outcomes and approval boundaries.');
