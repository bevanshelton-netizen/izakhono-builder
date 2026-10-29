import fs from 'node:fs';
import path from 'node:path';
import { registerHeartbeat, listNodes, selectReadyNode } from './node-registry.mjs';

const root = process.cwd();
const registryPath = process.env.IZAKHONO_NODE_REGISTRY_PATH || path.join(root, 'autonomy', 'node-registry.json');

export function ingestHeartbeat(heartbeat) {
  return registerHeartbeat(heartbeat);
}

export function fleetStatus() {
  return listNodes();
}

export function deploymentTarget(requirements = {}) {
  return selectReadyNode(requirements);
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
