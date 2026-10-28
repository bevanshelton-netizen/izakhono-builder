import assert from 'node:assert/strict';
import { exportSecurityReport } from './report-exporter.js';
const result = exportSecurityReport({ tenantId: 'tenant-facade', actorId: 'analyst', role: 'ANALYST', generatedAt: '2026-10-28T03:30:00.000Z', scope: [], scanIds: [], riskScore: 0, findings: [] });
assert.equal(result.report.tenantId, 'tenant-facade');
assert.match(result.markdown, /FORTRESS Security Report/);
console.log('FORTRESS exporter facade passed');
