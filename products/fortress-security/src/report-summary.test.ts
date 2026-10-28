import assert from 'node:assert/strict';
import { createSecurityReport } from './report.js';

const report = createSecurityReport({ tenantId: 'tenant-summary', actorId: 'analyst', role: 'ANALYST', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset'], scanIds: ['scan'], riskScore: 80, findings: [
  { id: '1', severity: 'CRITICAL', title: 'critical', status: 'OPEN' },
  { id: '2', severity: 'HIGH', title: 'high', status: 'IN_PROGRESS' },
  { id: '3', severity: 'LOW', title: 'low', status: 'VERIFIED' },
] });
assert.deepEqual(report.summary.severity, { CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 1, INFO: 0 });
assert.deepEqual(report.summary.remediation, { OPEN: 1, IN_PROGRESS: 1, VERIFIED: 1, REGRESSED: 0 });
console.log('FORTRESS report summary passed');
