import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const registryPath = process.env.IZAKHONO_NODE_REGISTRY_PATH || path.join(root, 'autonomy', 'node-registry.json');
const staleAfterMs = Number(process.env.IZAKHONO_NODE_STALE_MS || 180000);

function readRegistry() {
  if (!fs.existsSync(registryPath)) return { schema: 'izakhono.node-registry/v1', nodes: {} };
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function writeRegistry(registry) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
}

function safeHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function recordHeartbeat(heartbeat) {
  const nodeId = heartbeat?.nodeId || heartbeat?.node?.id;
  if (!nodeId) throw new Error('nodeId is required');

  const registry = readRegistry();
  const now = new Date().toISOString();
  const existing = registry.nodes[nodeId] || {};
  const checks = heartbeat.checks || heartbeat.readiness || {};
  const health = heartbeat.health || heartbeat.status || 'unknown';

  registry.nodes[nodeId] = {
    ...existing,
    nodeId,
    identity: heartbeat.identity || heartbeat.node || {},
    status: health,
    capacity: heartbeat.capacity || {},
    readiness: checks,
    runtime: heartbeat.runtime || existing.runtime || {},
    lastSeenAt: heartbeat.timestamp || now,
    receivedAt: now,
    heartbeatId: heartbeat.heartbeatId || safeHash(`${nodeId}:${heartbeat.timestamp || now}`),
    staleAfterMs,
  };
  writeRegistry(registry);
  return registry.nodes[nodeId];
}

export const registerHeartbeat = recordHeartbeat;

export function listNodes() {
  const registry = readRegistry();
  const now = Date.now();
  return Object.values(registry.nodes).map((node) => ({
    ...node,
    health: now - Date.parse(node.lastSeenAt) <= (node.staleAfterMs || staleAfterMs) ? 'online' : 'stale',
  }));
}

export function getNode(nodeId) {
  return listNodes().find((node) => node.nodeId === nodeId) || null;
}

export function selectReadyNode(requirements = {}) {
  const excluded = new Set(requirements.excludeNodeIds || []);
  const candidates = listNodes().filter((node) =>
    node.health === 'online' &&
    node.status === 'healthy' &&
    !excluded.has(node.nodeId)
  );
  const requiredChecks = requirements.requiredChecks || [
    'nodeReachable',
    'persistentStorageReady',
    'containerRuntimeReady',
    'monitoringOnline'
  ];

  const eligible = candidates.filter((node) => requiredChecks.every((check) => node.readiness?.[check] === true));
  if (!eligible.length) {
    return {
      status: 'waiting',
      reason: candidates.length ? 'no-node-meets-readiness-requirements' : 'no-fresh-healthy-node',
      requiredChecks,
      excludedNodeIds: [...excluded],
      candidates: candidates.map((node) => node.nodeId),
    };
  }

  eligible.sort((a, b) => {
    const aLoad = Number(a.capacity?.loadAverage?.[0] ?? Number.MAX_SAFE_INTEGER);
    const bLoad = Number(b.capacity?.loadAverage?.[0] ?? Number.MAX_SAFE_INTEGER);
    return aLoad - bLoad;
  });

  const selected = eligible[0];
  return {
    status: 'ready',
    nodeId: selected.nodeId,
    node: selected,
    reason: 'healthy-node-selected',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || 'list';
  if (command === 'list') console.log(JSON.stringify(listNodes(), null, 2));
  else if (command === 'get') console.log(JSON.stringify(getNode(process.argv[3]), null, 2));
  else if (command === 'target') console.log(JSON.stringify(selectReadyNode(JSON.parse(process.argv[3] || '{}')), null, 2));
  else throw new Error(`Unsupported command: ${command}`);
}
