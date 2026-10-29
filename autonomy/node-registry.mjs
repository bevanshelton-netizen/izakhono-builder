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
  if (!heartbeat?.nodeId) throw new Error('nodeId is required');
  const registry = readRegistry();
  const now = new Date().toISOString();
  const existing = registry.nodes[heartbeat.nodeId] || {};
  registry.nodes[heartbeat.nodeId] = {
    ...existing,
    nodeId: heartbeat.nodeId,
    identity: heartbeat.identity || {},
    status: heartbeat.status || 'unknown',
    capacity: heartbeat.capacity || {},
    readiness: heartbeat.readiness || {},
    lastSeenAt: heartbeat.timestamp || now,
    receivedAt: now,
    heartbeatId: heartbeat.heartbeatId || safeHash(`${heartbeat.nodeId}:${heartbeat.timestamp || now}`),
    staleAfterMs,
  };
  writeRegistry(registry);
  return registry.nodes[heartbeat.nodeId];
}

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || 'list';
  if (command === 'list') console.log(JSON.stringify(listNodes(), null, 2));
  else if (command === 'get') console.log(JSON.stringify(getNode(process.argv[3]), null, 2));
  else throw new Error(`Unsupported command: ${command}`);
}
