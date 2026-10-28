import assert from 'node:assert/strict';
import { createSecurityReport } from './report.js';

const a = createSecurityReport({ tenantId: 'tenant-a', actorId: 'a', role: 'OWNER', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['a'], scanIds: ['s-a'], riskScore: 20, findings: [] });
const b = createSecurityReport({ tenantId: 'tenant-b', actorId: 'b', role: 'OWNER', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['b'], scanIds: ['s-b'], riskScore: 20, findings: [] });
assert.notEqual(a.reportId, b.reportId);
assert.notEqual(a.tenantId, b.tenantId);
console.log('FORTRESS tenant report contract passed');
