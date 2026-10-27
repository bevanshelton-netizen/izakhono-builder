#!/usr/bin/env node
import fs from 'node:fs/promises';
import { buildSnapshot, renderControlPlane, type FindingRecord, type ScanRecord } from './control-plane.js';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node --import tsx src/control-plane-cli.ts snapshot.json');
  process.exit(2);
}

const data = JSON.parse(await fs.readFile(input, 'utf8')) as {
  assetCount: number;
  findings: FindingRecord[];
  scans: ScanRecord[];
};
const snapshot = buildSnapshot(data.findings, data.scans, data.assetCount);
console.log(renderControlPlane(snapshot));
console.log('\nJSON');
console.log(JSON.stringify(snapshot, null, 2));
