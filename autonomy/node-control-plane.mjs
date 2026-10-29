import fs from 'node:fs';
import path from 'node:path';
import { registerHeartbeat, listNodes, selectReadyNode } from './node-registry.mjs';

const root = process.cwd();
const registryPath = path.join(root, 'autonomy', 'node-registry.json');

function saveRegistry(registry) {
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
}

export function ingestHeartbeat(heartbeat) {
  const registry = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    : { schema: 'izakhono.node-registry/v1', nodes: {} };
  const updated = registerHeartbeat(registry, heartbeat);
  saveRegistry(updated);
  return updated.nodes[heartbeat.nodeId];
}

export function fleetStatus() {
  const registry = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    : { schema: 'izakhono.node-registry/v1', nodes: {} };
  return listNodes(registry);
}

export function deploymentTarget(requirements = {}) {
  const registry = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    : { schema: 'izakhono.node-registry/v1', nodes: {} };
  return selectReadyNode(registry, requirements);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [operation = 'status', payload = '{}'] = process.argv.slice(2);
  const input = JSON.parse(payload);
  let result;
  if (operation === 'heartbeat') result = ingestHeartbeat(input);
  else if (operation === 'target') result = deploymentTarget(input);
  else result = fleetStatus();
  console.log(JSON.stringify(result, null, 2));
}
