import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { exportReport } from './report-cli.js';

const inputPath = '/tmp/fortress-report-input.json';
const outputPath = '/tmp/fortress-report-output.md';
writeFileSync(inputPath, JSON.stringify({
  tenantId: 'tenant-cli', actorId: 'analyst', role: 'ANALYST', generatedAt: '2026-10-28T03:30:00.000Z',
  scope: ['asset-1'], scanIds: ['scan-1'], riskScore: 10, findings: [],
}));
exportReport(inputPath, outputPath);
assert.match(readFileSync(outputPath, 'utf8'), /Tenant: tenant-cli/);
unlinkSync(inputPath); unlinkSync(outputPath);
console.log('FORTRESS report CLI tests passed');
