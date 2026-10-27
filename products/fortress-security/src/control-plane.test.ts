import assert from 'node:assert/strict';
import { buildSnapshot, renderControlPlane } from './control-plane.js';

const findings = [
  { id: 'f1', assetId: 'a1', title: 'Critical exposure', severity: 'CRITICAL', state: 'OPEN', firstSeen: '2026-10-27T00:00:00Z', lastSeen: '2026-10-27T00:00:00Z' },
  { id: 'f2', assetId: 'a1', title: 'High exposure', severity: 'HIGH', state: 'VERIFIED', firstSeen: '2026-10-27T00:00:00Z', lastSeen: '2026-10-27T00:00:00Z' },
  { id: 'f3', assetId: 'a2', title: 'Regression', severity: 'MEDIUM', state: 'REGRESSED', firstSeen: '2026-10-27T00:00:00Z', lastSeen: '2026-10-27T00:00:00Z' },
] as const;

const scans = [
  { id: 's1', assetId: 'a1', startedAt: '2026-10-26T00:00:00Z', completedAt: '2026-10-26T00:01:00Z', findings: 2, critical: 1, high: 1, medium: 0, low: 0 },
  { id: 's2', assetId: 'a2', startedAt: '2026-10-27T00:00:00Z', completedAt: '2026-10-27T00:01:00Z', findings: 1, critical: 0, high: 0, medium: 1, low: 0 },
];

const snapshot = buildSnapshot(findings, scans, 2, '2026-10-27T00:02:00Z');
assert.equal(snapshot.assets, 2);
assert.equal(snapshot.findings, 3);
assert.equal(snapshot.open, 1);
assert.equal(snapshot.verified, 1);
assert.equal(snapshot.regressed, 1);
assert.equal(snapshot.findingsBySeverity.CRITICAL, 1);
assert.equal(snapshot.findingsBySeverity.HIGH, 1);
assert.equal(snapshot.findingsBySeverity.MEDIUM, 1);
assert.equal(snapshot.recentScans[0].id, 's2');
assert.match(renderControlPlane(snapshot), /Risk score:/);

console.log('FORTRESS control-plane test: PASS');
