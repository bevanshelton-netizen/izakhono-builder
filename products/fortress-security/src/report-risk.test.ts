import assert from 'node:assert/strict';
import { createSecurityReport } from './report.js';

const base = { tenantId: 'tenant-risk', actorId: 'owner', role: 'OWNER' as const, generatedAt: '2026-10-28T03:30:00.000Z', scope: [], scanIds: [], findings: [] };
assert.throws(() => createSecurityReport({ ...base, riskScore: -1 }), /risk score/);
assert.throws(() => createSecurityReport({ ...base, riskScore: 101 }), /risk score/);
assert.equal(createSecurityReport({ ...base, riskScore: 0 }).riskScore, 0);
assert.equal(createSecurityReport({ ...base, riskScore: 100 }).riskScore, 100);
console.log('FORTRESS report risk validation passed');
