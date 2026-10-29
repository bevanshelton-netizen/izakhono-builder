import os from 'node:os';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const VERSION = '1.0.0';
const nodeId = process.env.IZAKHONO_NODE_ID || os.hostname();
const storagePath = process.env.IZAKHONO_NODE_STORAGE_PATH || process.cwd();

function commandAvailable(command) {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function diskStats(target) {
  try {
    const stat = fs.statfsSync(target);
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bavail) * Number(stat.bsize);
    return { totalBytes: total, freeBytes: free, available: true };
  } catch (error) {
    return { totalBytes: null, freeBytes: null, available: false, error: error.message };
  }
}

function runtime() {
  const docker = commandAvailable('docker');
  const podman = commandAvailable('podman');
  return {
    containerRuntime: docker ? 'docker' : podman ? 'podman' : 'none',
    docker,
    podman,
    ready: docker || podman,
  };
}

export function collectHeartbeat() {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const disk = diskStats(storagePath);
  const container = runtime();
  const load = os.loadavg();
  const checks = {
    nodeReachable: true,
    persistentStorageReady: disk.available,
    containerRuntimeReady: container.ready,
    monitoringOnline: true,
  };
  const degraded = Object.values(checks).some((value) => value === false);

  return {
    contract: 'izakhono.node-heartbeat/v1',
    version: VERSION,
    node: {
      id: nodeId,
      hostname: os.hostname(),
      platform: process.platform,
      architecture: process.arch,
      agentRuntime: process.version,
      uptimeSeconds: Math.floor(os.uptime()),
    },
    health: degraded ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    capacity: {
      cpuCount: os.cpus().length,
      loadAverage: load,
      memoryTotalBytes: memoryTotal,
      memoryFreeBytes: memoryFree,
      memoryUsedPercent: Number(((1 - memoryFree / memoryTotal) * 100).toFixed(2)),
      storagePath,
      storage: disk,
    },
    runtime: container,
    checks,
  };
}

function main() {
  const mode = process.argv[2] || 'heartbeat';
  if (!['heartbeat', 'check'].includes(mode)) {
    process.stdout.write(JSON.stringify({ status: 'failed', reason: `unsupported-mode:${mode}` }) + '\n');
    process.exitCode = 2;
    return;
  }
  const payload = collectHeartbeat();
  if (mode === 'check') payload.status = payload.health === 'healthy' ? 'ready' : 'degraded';
  process.stdout.write(JSON.stringify(payload) + '\n');
}

main();
