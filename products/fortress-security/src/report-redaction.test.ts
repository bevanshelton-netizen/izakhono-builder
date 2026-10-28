import assert from 'node:assert/strict';
import { createSecurityReport, redactReport } from './report.js';

const report = createSecurityReport({ tenantId: 'tenant-redact', actorId: 'admin', role: 'SECURITY_ADMIN', generatedAt: '2026-10-28T03:30:00.000Z', scope: ['asset'], scanIds: ['scan'], riskScore: 1, findings: [{ id: 'f', severity: 'INFO', title: 'password=topsecret token=abc123 api-key=xyz', status: 'OPEN' }] });
const redacted = redactReport(report);
assert.doesNotMatch(redacted.findings[0].title, /topsecret|abc123|xyz/);
console.log('FORTRESS redaction boundary passed');
