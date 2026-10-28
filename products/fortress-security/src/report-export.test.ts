import assert from 'node:assert/strict';
import { createSecurityReport, redactReport, verifySecurityReport } from './report.js';

const report = createSecurityReport({
  tenantId: 'tenant-export', actorId: 'owner', role: 'OWNER', generatedAt: '2026-10-28T03:30:00.000Z',
  scope: ['asset-a'], scanIds: ['scan-a'], riskScore: 5,
  findings: [{ id: 'f', severity: 'LOW', title: 'token=do-not-share', status: 'OPEN' }],
});
const redacted = redactReport(report);
assert.match(redacted.findings[0].title, /REDACTED/);
assert.equal(verifySecurityReport(report), true);
assert.equal(verifySecurityReport({ ...report, integrityDigest: 'tampered' }), false);
console.log('FORTRESS export integrity tests passed');
