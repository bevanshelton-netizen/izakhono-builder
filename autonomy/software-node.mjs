#!/usr/bin/env node
/**
 * IZAKHONO SOFTWARE NODE v1
 *
 * NODE identity is logical software identity. This local adapter can instantiate
 * that identity in a replaceable substrate, but it must not mark the substrate
 * production-eligible without explicit authentication, container, backup,
 * FORTRESS and monitoring evidence.
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
function writableStorage() {
  try {
    fs.accessSync(ROOT, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
function write(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
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
    identityType: 'software-runtime',
    substrate,
    runtimeHostIsSeparate: true,
    hostname: os.hostname(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    capabilities: {
      process: true,
      persistentStorage: writableStorage(),
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
  const checks = {
    nodeReachable: true,
    nodeAuthenticated: Boolean(process.env.IZAKHONO_NODE_AUTH),
    persistentStorageReady: writableStorage(),
    containerRuntimeReady: state.capabilities.containerRuntime,
    backupTested: process.env.IZAKHONO_BACKUP_TESTED === 'true',
    securityGatePassed: process.env.IZAKHONO_SECURITY_GATE === 'passed',
    monitoringOnline: process.env.IZAKHONO_MONITORING === 'online'
  };
  const health = Object.values(checks).every(Boolean) ? 'healthy' : 'degraded';
  const payload = {
    contract: 'izakhono.node-heartbeat/v1',
    nodeId: state.nodeId,
    identityType: 'software-runtime',
    runtimeHostIsSeparate: true,
    timestamp: new Date().toISOString(),
    health,
    checks
  };
  write(HEARTBEAT, payload);
  return payload;
}

function promote(request = {}) {
  const state = read(STATE) || instantiate(request);
  const beat = heartbeat();
  const missing = Object.entries(beat.checks).filter(([, passed]) => passed !== true).map(([name]) => name);
  if (missing.length) {
    state.status = 'waiting';
    state.updatedAt = new Date().toISOString();
    state.promotion = { status: 'waiting', requestId: request.requestId || null, missing, evidence: beat };
    write(STATE, state);
    return { contract: 'izakhono.software-node/v1', status: 'waiting', reason: 'required-evidence-missing', missing, nodeId: state.nodeId, heartbeat: beat };
  }
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
