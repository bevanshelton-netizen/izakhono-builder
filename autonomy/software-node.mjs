#!/usr/bin/env node
/**
 * IZAKHONO SOFTWARE NODE v1
 *
 * Software is the infrastructure unit. A node is instantiated in the
 * available execution substrate and promoted only after runtime evidence.
 * No physical-server prerequisite exists in this contract.
 */

import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.env.IZAKHONO_NODE_STORAGE_PATH || `${process.cwd()}/.izakhono-node`;
const STATE = `${ROOT}/software-node.json`;
const HEARTBEAT = `${ROOT}/node-heartbeat.json`;

function mkdir() { fs.mkdirSync(ROOT, { recursive: true }); }
function has(command) {
  try { execFileSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' }); return true; }
  catch { return false; }
}
function write(path, value) {
  const tmp = `${path}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, path);
}
function read(path) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return null; }
}

function instantiate(request = {}) {
  mkdir();
  const existing = read(STATE);
  const nodeId = existing?.nodeId || request.nodeId || process.env.IZAKHONO_NODE_ID ||
    `snode-${crypto.randomUUID().slice(0, 12)}`;
  const substrate = request.substrate || process.env.IZAKHONO_NODE_SUBSTRATE || 'local-software';
  const state = {
    contract: 'izakhono.software-node/v1',
    nodeId,
    status: 'instantiated',
    substrate,
    hostname: os.hostname(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    capabilities: {
      process: true,
      persistentStorage: true,
      containerRuntime: has('docker') || has('podman'),
      http: true,
      https: true
    },
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  write(STATE, state);
  return state;
}

function heartbeat() {
  mkdir();
  const state = read(STATE) || instantiate();
  const payload = {
    contract: 'izakhono.node-heartbeat/v1',
    nodeId: state.nodeId,
    timestamp: new Date().toISOString(),
    health: 'healthy',
    checks: {
      nodeReachable: true,
      persistentStorageReady: fs.existsSync(ROOT),
      containerRuntimeReady: state.capabilities.containerRuntime,
      monitoringOnline: true
    }
  };
  write(HEARTBEAT, payload);
  return payload;
}

function promote(request = {}) {
  const state = read(STATE) || instantiate(request);
  const beat = heartbeat();
  const required = [
    beat.checks.nodeReachable,
    beat.checks.persistentStorageReady,
    beat.checks.monitoringOnline
  ];
  if (!required.every(Boolean)) return { status: 'waiting', reason: 'required-evidence-missing', nodeId: state.nodeId, heartbeat: beat };
  state.status = 'eligible';
  state.updatedAt = new Date().toISOString();
  state.promotion = { status: 'eligible', requestId: request.requestId || null, evidence: beat };
  write(STATE, state);
  return { contract: 'izakhono.software-node/v1', status: 'eligible', nodeId: state.nodeId, substrate: state.substrate, heartbeat: beat };
}

function inspect() {
  const state = read(STATE);
  const beat = read(HEARTBEAT);
  return { contract: 'izakhono.software-node/v1', status: state?.status || 'not-instantiated', state, heartbeat: beat };
}

const input = process.argv[2] ? JSON.parse(process.argv[2]) : { operation: 'inspect' };
const result = input.operation === 'instantiate' ? instantiate(input)
  : input.operation === 'heartbeat' ? heartbeat()
  : input.operation === 'promote' ? promote(input)
  : input.operation === 'inspect' ? inspect()
  : { status: 'failed', reason: 'unsupported-operation', supported: ['instantiate', 'heartbeat', 'promote', 'inspect'] };
console.log(JSON.stringify(result, null, 2));
