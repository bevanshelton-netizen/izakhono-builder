#!/usr/bin/env node
import fs from 'node:fs/promises';
import { scan } from './scanner.js';
import type { ScanScope } from './types.js';

const scopePath = process.argv[2];
if (!scopePath) {
  console.error('Usage: FORTRESS_AUTHORIZED_SCAN=1 node --import tsx src/cli.ts scope.json');
  process.exit(2);
}

try {
  const scope = JSON.parse(await fs.readFile(scopePath, 'utf8')) as ScanScope;
  const report = await scan(scope);
  console.log(JSON.stringify(report, null, 2));
  const blocking = report.findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  process.exit(blocking.length ? 1 : 0);
} catch (error) {
  console.error(`FORTRESS scan blocked/failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
