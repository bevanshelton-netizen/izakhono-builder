#!/usr/bin/env node
import fs from 'node:fs/promises';
import { scan } from './scanner.js';
import { toSarif } from './sarif.js';
import type { ScanScope } from './types.js';

const args = process.argv.slice(2);
const scopePath = args.find(arg => !arg.startsWith('--'));
const sarifIndex = args.indexOf('--sarif');
const sarifPath = sarifIndex >= 0 ? args[sarifIndex + 1] : undefined;
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : undefined;
const noFail = args.includes('--no-fail');

if (!scopePath) {
  console.error('Usage: FORTRESS_AUTHORIZED_SCAN=1 node --import tsx src/cli.ts scope.json [--json report.json] [--sarif report.sarif] [--no-fail]');
  process.exit(2);
}

if ((sarifIndex >= 0 && !sarifPath) || (jsonIndex >= 0 && !jsonPath)) {
  console.error('FORTRESS output flag requires a file path.');
  process.exit(2);
}

try {
  const scope = JSON.parse(await fs.readFile(scopePath, 'utf8')) as ScanScope;
  const report = await scan(scope);
  const json = JSON.stringify(report, null, 2);
  console.log(json);

  if (jsonPath) await fs.writeFile(jsonPath, `${json}\n`, 'utf8');
  if (sarifPath) await fs.writeFile(sarifPath, `${JSON.stringify(toSarif(report), null, 2)}\n`, 'utf8');

  const blocking = report.findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  process.exit(noFail ? 0 : blocking.length ? 1 : 0);
} catch (error) {
  console.error(`FORTRESS scan blocked/failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
