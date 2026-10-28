import assert from 'node:assert/strict';
import { exportSecurityReport } from './report-exporter.js';
assert.throws(() => exportSecurityReport({ tenantId: 'tenant-auth', actorId: 'viewer', role: 'VIEWER', generatedAt: '2026-10-28T03:30:00.000Z', scope: [], scanIds: [], riskScore: 0, findings: [] }), /export denied/);
console.log('FORTRESS exporter authorization passed');
