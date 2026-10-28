import assert from 'node:assert/strict';
import { createSecurityReport } from './report.js';
const make = (tenantId: string) => createSecurityReport({ tenantId, actorId: 'owner', role: 'OWNER', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset'], scanIds: ['scan'], riskScore: 0, findings: [] });
assert.notEqual(make('tenant-a').reportId, make('tenant-b').reportId);
console.log('FORTRESS tenant identity passed');
