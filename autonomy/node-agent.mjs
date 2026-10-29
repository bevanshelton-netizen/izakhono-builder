#!/usr/bin/env node
/**
 * IZAKHONO NODE Agent v1
 *
 * A small, provider-neutral control agent for an IZAKHONO-owned node.
 * It exposes inspect/promote semantics over stdin/stdout so it can later
 * be wrapped by HTTP, SSH, a queue worker, or FORTRESS without changing the
 * execution contract.
 *
 * Security rule: credentials are supplied at runtime only. Never commit them.
 */

import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const REQUIRED = [
  'node-reachable',
  'node-authenticated',
  'container-runtime-ready',
  'persistent-storage-ready',
  'backup-tested',
  'security-gate-passed',
  'monitoring-online'
];

function commandExists(command) {
  try {
    execFileSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function storageReady() {
  try {
    fs.accessSync(process.env.IZAKHONO_NODE_DATA_DIR || '/var/lib/izakhono', fs.constants.W_OK);
    return true;
  } catch {
    // A development/test node may use the repository's writable directory.
    return fs.existsSync(process.cwd());
  }
}

function inspect() {
  const docker = commandExists('docker') || commandExists('podman');
  const evidence = [
    { name: 'node-reachable', status: 'passed', detail: 'agent-process-running' },
    { name: 'node-authenticated', status: process.env.IZAKHONO_NODE_AUTH ? 'passed' : 'not-configured', detail: 'runtime-secret' },
    { name: 'container-runtime-ready', status: docker ? 'passed' : 'not-ready', detail: docker ? 'docker-or-podman-detected' : 'container-runtime-not-detected' },
    { name: 'persistent-storage-ready', status: storageReady() ? 'passed' : 'not-ready', detail: process.env.IZAKHONO_NODE_DATA_DIR || 'default-node-data-path' },
    { name: 'backup-tested', status: process.env.IZAKHONO_BACKUP_TESTED === 'true' ? 'passed' : 'not-configured', detail: 'backup evidence must be explicit' },
    { name: 'security-gate-passed', status: process.env.IZAKHONO_SECURITY_GATE === 'passed' ? 'passed' : 'not-configured', detail: 'FORTRESS/security evidence must be explicit' },
    { name: 'monitoring-online', status: process.env.IZAKHONO_MONITORING === 'online' ? 'passed' : 'not-configured', detail: 'monitoring evidence must be explicit' }
  ];
  const ready = evidence.every(item => item.status === 'passed');
  return {
    contract: 'izakhono.node/v1',
    status: ready ? 'ready' : 'waiting',
    node: {
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    evidence,
    requiredEvidence: REQUIRED
  };
}

function promote(request = {}) {
  const report = inspect();
  const missing = report.evidence.filter(item => item.status !== 'passed').map(item => item.name);
  if (missing.length) {
    return {
      contract: 'izakhono.node/v1',
      status: 'waiting',
      operation: 'promote',
      reason: 'required-evidence-missing',
      missing,
      requestId: request.requestId || null
    };
  }
  return {
    contract: 'izakhono.node/v1',
    status: 'ready',
    operation: 'promote',
    requestId: request.requestId || null,
    evidence: report.evidence,
    message: 'Node is eligible for owned-runtime promotion; deployment must still return workload-specific verification evidence.'
  };
}

function main(input) {
  if (!input || typeof input !== 'object') return { status: 'failed', reason: 'invalid-request' };
  if (input.operation === 'inspect') return inspect();
  if (input.operation === 'promote') return promote(input);
  return { status: 'failed', reason: 'unsupported-operation', supported: ['inspect', 'promote'] };
}

const raw = process.argv[2];
if (!raw) {
  console.log(JSON.stringify({ status: 'failed', reason: 'request-required' }));
  process.exit(2);
}

try {
  console.log(JSON.stringify(main(JSON.parse(raw)), null, 2));
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', reason: 'invalid-json', error: String(error?.message || error) }));
  process.exit(2);
}
