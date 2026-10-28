import assert from 'node:assert/strict';
import { canExportReport, createSecurityReport, redactReport, renderMarkdownReport, verifySecurityReport } from './report.js';

const input = {
  tenantId: 'tenant-a', actorId: 'security-admin', role: 'SECURITY_ADMIN' as const,
  generatedAt: '2026-10-28T03:30:00.000Z', scope: ['https://example.test'], scanIds: ['scan-1'], riskScore: 72,
  findings: [
    { id: 'f1', severity: 'HIGH' as const, title: 'API key=super-secret', status: 'OPEN' as const, evidenceDigest: 'abc' },
    { id: 'f2', severity: 'MEDIUM' as const, title: 'Missing header', status: 'VERIFIED' as const },
  ],
};

assert.equal(canExportReport('VIEWER'), false);
assert.equal(canExportReport('ANALYST'), true);
const report = createSecurityReport(input);
assert.equal(report.summary.totalFindings, 2);
assert.equal(report.summary.severity.HIGH, 1);
assert.equal(report.summary.remediation.VERIFIED, 1);
assert.equal(verifySecurityReport(report), true);
assert.equal(verifySecurityReport({ ...report, riskScore: 1 }), false);
assert.match(renderMarkdownReport(report), /FORTRESS Security Report/);
assert.match(redactReport(report).findings[0].title, /\[REDACTED\]/);
assert.throws(() => createSecurityReport({ ...input, role: 'VIEWER' }), /export denied/);
console.log('FORTRESS report tests passed');
