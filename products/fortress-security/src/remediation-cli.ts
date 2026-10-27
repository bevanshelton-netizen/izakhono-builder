#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createLedger, summarize, verifyRemediation } from './remediation.js';
import type { RemediationLedger } from './remediation.js';
import type { ScanReport } from './types.js';

const [command, reportPath, previousPath] = process.argv.slice(2);

if (!command || !reportPath || !['create', 'verify'].includes(command)) {
  console.error('Usage: node --import tsx remediation-cli.ts <create|verify> <report.json> [ledger.json]');
  process.exit(2);
}

const report = JSON.parse(await fs.readFile(reportPath, 'utf8')) as ScanReport;
let ledger: RemediationLedger;

if (command === 'create') {
  const previous = previousPath
    ? JSON.parse(await fs.readFile(previousPath, 'utf8')) as RemediationLedger
    : undefined;
  ledger = createLedger(report, previous);
} else {
  if (!previousPath) throw new Error('verify requires a previous remediation ledger');
  const previous = JSON.parse(await fs.readFile(previousPath, 'utf8')) as RemediationLedger;
  ledger = verifyRemediation(previous, report);
}

console.log(JSON.stringify({ ledger, summary: summarize(ledger) }, null, 2));
