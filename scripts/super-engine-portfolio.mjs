#!/usr/bin/env node
/**
 * IZAKHONO Super Engine Portfolio Harness
 *
 * Discovery-first, evidence-driven portfolio validation. This script deliberately
 * reports what it can prove; it does not claim deployment or completion merely
 * because a project exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const productsDir = path.join(root, 'products');
const results = [];

function run(name, command, args, cwd = root) {
  const started = Date.now();
  try {
    execFileSync(command, args, { cwd, stdio: 'pipe', timeout: 120_000, encoding: 'utf8' });
    return { name, status: 'PASS', ms: Date.now() - started };
  } catch (error) {
    return {
      name,
      status: 'FAIL',
      ms: Date.now() - started,
      detail: String(error?.stderr || error?.stdout || error?.message || 'unknown failure').slice(0, 1000),
    };
  }
}

function add(project, check) {
  results.push({ project, ...check });
}

if (!fs.existsSync(productsDir)) {
  console.error(JSON.stringify({ status: 'BLOCKED', reason: 'products directory not found' }, null, 2));
  process.exit(2);
}

for (const name of fs.readdirSync(productsDir).sort()) {
  const dir = path.join(productsDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;

  const packageFile = path.join(dir, 'package.json');
  const hasPackage = fs.existsSync(packageFile);
  const hasReadme = fs.existsSync(path.join(dir, 'README.md'));
  const hasTests = fs.existsSync(path.join(dir, 'tests')) || fs.existsSync(path.join(dir, 'test'));

  add(name, { stage: 'DISCOVER', status: 'PASS', hasPackage, hasReadme, hasTests });

  if (!hasPackage) continue;

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  } catch (error) {
    add(name, { stage: 'PACKAGE', status: 'FAIL', detail: String(error.message) });
    continue;
  }

  if (pkg.scripts?.check) {
    add(name, { stage: 'CHECK', ...run('check', 'npm', ['run', 'check', '--if-present'], dir) });
  }

  if (pkg.scripts?.test) {
    add(name, { stage: 'TEST', ...run('test', 'npm', ['test', '--if-present'], dir) });
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  projectsDiscovered: new Set(results.map(r => r.project)).size,
  checks: results.length,
  passed: results.filter(r => r.status === 'PASS').length,
  failed: results.filter(r => r.status === 'FAIL').length,
  blocked: results.filter(r => r.status === 'BLOCKED').length,
  results,
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed ? 1 : 0;
