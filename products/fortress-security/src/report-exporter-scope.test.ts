import assert from 'node:assert/strict';
import { exportSecurityReport } from './report-exporter.js';
const result = exportSecurityReport({ tenantId: 'tenant-scope', actorId: 'owner', role: 'OWNER', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset-1'], scanIds: ['scan-1'], riskScore: 10, findings: [] });
assert.deepEqual(result.report.scope, ['asset-1']);
assert.deepEqual(result.report.scanIds, ['scan-1']);
console.log('FORTRESS exporter scope passed');
