import assert from 'node:assert/strict';
import { createLedger, summarize, verifyRemediation } from './remediation.js';
import type { ScanReport } from './types.js';

const finding = {
  id: 'F-001', assetId: 'fortress-self', severity: 'HIGH' as const, kind: 'TCP' as const,
  title: 'SSH exposed', description: 'SSH is reachable', evidence: 'tcp/22 open',
  remediation: 'Restrict SSH to approved management networks.'
};

const report = (findings = [finding]): ScanReport => ({
  schemaVersion: '1.0', scanner: 'IZAKHONO-FORTRESS-SECURITY',
  startedAt: '2026-10-27T00:00:00Z', completedAt: '2026-10-27T00:01:00Z',
  scopeOwner: 'IZAKHONO', assetsScanned: 1, findings,
  evidenceDigest: 'digest-1'
});

const initial = createLedger(report());
assert.equal(initial.records[0].status, 'OPEN');
assert.equal(summarize(initial).OPEN, 1);

const clean = verifyRemediation(initial, report([]));
assert.equal(clean.records[0].status, 'VERIFIED');
assert.equal(clean.records[0].verifiedAt, '2026-10-27T00:01:00Z');

const regression = verifyRemediation(clean, report());
assert.equal(regression.records[0].status, 'REGRESSED');
assert.equal(summarize(regression).REGRESSED, 1);

console.log('FORTRESS remediation lifecycle test: PASS');
