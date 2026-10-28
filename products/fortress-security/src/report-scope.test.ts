import assert from 'node:assert/strict';
import { createSecurityReport, verifySecurityReport } from './report.js';

const report = createSecurityReport({ tenantId: 'tenant-scope', actorId: 'admin', role: 'SECURITY_ADMIN', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset-a', 'asset-b'], scanIds: ['scan-a'], riskScore: 50, findings: [] });
assert.equal(report.scope.length, 2);
assert.equal(verifySecurityReport(report), true);
console.log('FORTRESS scope integrity passed');
