import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const policy = JSON.parse(fs.readFileSync(path.join(root, 'control-plane-state.json'), 'utf8'));

const PUBLIC_GATES = [
  'releaseApproved',
  'health',
  'deployment',
  'edge',
  'tls',
  'dns',
  'smokeTest',
  'rollbackReady'
];

export function evaluateActivation(record) {
  const evidence = record?.evidence ?? {};
  const missing = PUBLIC_GATES.filter((gate) => evidence[gate] !== true);
  if (missing.length === 0) return { state: 'LIVE_VERIFIED', missing: [] };
  if (evidence.health === true && evidence.deployment === true) {
    return { state: 'DEGRADED', missing };
  }
  return { state: 'FAILED', missing };
}

export function assertProviderNeutral(record) {
  if (!record?.target?.provider || !record?.target?.nodeId) throw new Error('Target identity is required');
  if (!['owned', 'external-resilience', 'external-auxiliary'].includes(record.target.routeClass)) {
    throw new Error('Unsupported runtime route class');
  }
  if (record.authority && record.authority !== policy.authority) {
    throw new Error('Invalid authority model');
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const sample = {
    target: { nodeId: 'CONTABO-VPS-01', provider: 'contabo', routeClass: 'external-resilience' },
    evidence: Object.fromEntries(PUBLIC_GATES.map((gate) => [gate, true]))
  };
  assertProviderNeutral(sample);
  const result = evaluateActivation(sample);
  if (result.state !== 'LIVE_VERIFIED') process.exit(1);
  console.log(JSON.stringify({ policy: policy.policy, result }, null, 2));
}
