import assert from 'node:assert/strict';
import { toSarif } from './sarif.js';
import type { ScanReport } from './types.js';

const report: ScanReport = {
  schemaVersion: '1.0',
  scanner: 'IZAKHONO-FORTRESS-SECURITY',
  startedAt: '2026-10-27T00:00:00.000Z',
  completedAt: '2026-10-27T00:00:01.000Z',
  scopeOwner: 'IZAKHONO',
  assetsScanned: 1,
  evidenceDigest: 'digest',
  findings: [{
    id: 'finding-1',
    assetId: 'asset-1',
    severity: 'HIGH',
    kind: 'TCP',
    title: 'PostgreSQL service exposed',
    description: 'A database service is reachable.',
    evidence: 'host=127.0.0.1; port=5432',
    remediation: 'Restrict database access.'
  }]
};

const sarif = toSarif(report);
assert.equal(sarif.version, '2.1.0');
assert.equal(sarif.runs.length, 1);
assert.equal(sarif.runs[0].results.length, 1);
assert.equal(sarif.runs[0].results[0].level, 'error');
assert.equal(sarif.runs[0].results[0].ruleId, 'FORTRESS/TCP/POSTGRESQL-SERVICE-EXPOSED');
assert.equal((sarif.runs[0].results[0].fingerprints as Record<string, string>).fortressFindingId, 'finding-1');

console.log('FORTRESS SARIF test: PASS');
