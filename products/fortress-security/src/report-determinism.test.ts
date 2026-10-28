import assert from 'node:assert/strict';
import { createSecurityReport } from './report.js';

const base = { tenantId: 'tenant-d', actorId: 'owner', role: 'OWNER' as const, generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset'], scanIds: ['scan'], riskScore: 10, findings: [] };
const a = createSecurityReport(base);
const b = createSecurityReport(base);
assert.equal(a.reportId, b.reportId);
assert.equal(a.integrityDigest, b.integrityDigest);
console.log('FORTRESS report determinism passed');
