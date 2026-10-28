import assert from 'node:assert/strict';
import { buildDashboard, verifyDashboardIntegrity } from './ops-dashboard.js';

const dashboard = buildDashboard({
  tenantId: 'tenant-a', generatedAt: '2026-10-28T04:00:00.000Z', assets: 4, riskScore: 42,
  findings: [
    { severity: 'HIGH', status: 'OPEN' },
    { severity: 'MEDIUM', status: 'VERIFIED' },
    { severity: 'LOW', status: 'IN_PROGRESS' }
  ],
  scans: [
    { id: 'scan-2', completedAt: '2026-10-28T03:00:00.000Z', findingCount: 3, riskScore: 42 },
    { id: 'scan-1', completedAt: '2026-10-27T03:00:00.000Z', findingCount: 4, riskScore: 55 }
  ]
});

assert.equal(dashboard.trend, 'IMPROVING');
assert.equal(dashboard.severity.HIGH, 1);
assert.equal(dashboard.remediation.VERIFIED, 1);
assert.equal(dashboard.recentScans.length, 2);
assert.equal(verifyDashboardIntegrity(dashboard), true);
assert.equal(verifyDashboardIntegrity({ ...dashboard, riskScore: 99 }), false);
console.log('FORTRESS operations-dashboard tests passed');
