import assert from 'node:assert/strict';
import { createSecurityReport, renderMarkdownReport } from './report.js';
const report = createSecurityReport({ tenantId: 'tenant-output', actorId: 'owner', role: 'OWNER', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset'], scanIds: ['scan'], riskScore: 0, findings: [] });
assert.ok(renderMarkdownReport(report).includes('# FORTRESS Security Report'));
console.log('FORTRESS report output passed');
