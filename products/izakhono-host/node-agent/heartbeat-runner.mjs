#!/usr/bin/env node

/**
 * IZAKHONO NODE persistent heartbeat runner.
 *
 * This process deliberately delegates measurement to the canonical autonomy
 * heartbeat module. It never stores credentials and never prints secrets.
 *
 * Environment:
 *   IZAKHONO_NODE_ID             stable node identifier (required)
 *   IZAKHONO_HEARTBEAT_INTERVAL_MS  default 60000
 *   IZAKHONO_HEARTBEAT_COMMAND   optional command to receive JSON heartbeat
 *                                on stdin; stdout is treated as an ACK.
 *
 * If no transport command is configured, the runner remains local-only and
 * writes heartbeat records to the configured state file. This is intentional:
 * a node must not pretend to be connected to the control plane.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const heartbeat = path.resolve(here, '../../../autonomy/node-heartbeat.mjs');
const statePath = process.env.IZAKHONO_HEARTBEAT_STATE || '/var/lib/izakhono-node/heartbeat.json';
const intervalMs = Math.max(10000, Number(process.env.IZAKHONO_HEARTBEAT_INTERVAL_MS || 60000));

function collect() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [heartbeat, 'heartbeat'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err.trim() || `heartbeat exited ${code}`));
      try { resolve(JSON.parse(out)); }
      catch { reject(new Error('heartbeat returned invalid JSON')); }
    });
  });
}

function writeLocal(record) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(record, null, 2) + '\n', { mode: 0o640 });
}

function transport(record) {
  const command = process.env.IZAKHONO_HEARTBEAT_COMMAND;
  if (!command) return Promise.resolve({ delivered: false, reason: 'transport-not-configured' });

  return new Promise(resolve => {
    const child = spawn('/bin/sh', ['-c', command], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.on('error', error => resolve({ delivered: false, reason: error.message }));
    child.on('close', code => resolve({
      delivered: code === 0,
      reason: code === 0 ? 'acknowledged' : `transport-exit-${code}`,
      ack: stdout.trim().slice(0, 200),
    }));
    child.stdin.end(JSON.stringify(record));
  });
}

async function beat() {
  try {
    const record = await collect();
    const delivery = await transport(record);
    const enriched = {
      ...record,
      transport: delivery,
      emittedAt: new Date().toISOString(),
    };
    writeLocal(enriched);
    console.log(JSON.stringify({
      status: record.status,
      nodeId: record.nodeId,
      delivered: delivery.delivered,
      at: enriched.emittedAt,
    }));
  } catch (error) {
    const failure = {
      schema: 'izakhono.node-heartbeat/v1',
      status: 'degraded',
      nodeId: process.env.IZAKHONO_NODE_ID || null,
      error: error.message,
      emittedAt: new Date().toISOString(),
    };
    writeLocal(failure);
    console.error(JSON.stringify(failure));
  }
}

if (!process.env.IZAKHONO_NODE_ID) {
  console.error('IZAKHONO_NODE_ID is required');
  process.exit(2);
}

await beat();
const timer = setInterval(beat, intervalMs);
process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });
