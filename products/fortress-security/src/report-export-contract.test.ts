import assert from 'node:assert/strict';
import { createSecurityReport, renderMarkdownReport } from './report.js';
const report = createSecurityReport({ tenantId: 'tenant-contract', actorId: 'analyst', role: 'ANALYST', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset'], scanIds: ['scan'], riskScore: 25, findings: [] });
assert.match(renderMarkdownReport(report), /Risk score: 25\/100/);
assert.match(renderMarkdownReport(report), /Integrity digest:/);
console.log('FORTRESS export contract passed');
