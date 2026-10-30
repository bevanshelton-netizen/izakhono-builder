import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-failover-'));
process.env.IZAKHONO_NODE_REGISTRY_PATH = path.join(tempDir, 'registry.json');
process.env.IZAKHONO_NODE_STALE_MS = '60000';
process.env.IZAKHONO_NODE_MAX_FUTURE_SKEW_MS = '30000';

const { recordHeartbeat } = await import('./node-registry.mjs');
const { selectFailoverTarget } = await import('./node-failover.mjs');

const readyChecks = {
  nodeReachable: true,
  persistentStorageReady: true,
  containerRuntimeReady: true,
  monitoringOnline: true,
};

recordHeartbeat({
  nodeId: 'NODE01',
  health: 'healthy',
  checks: readyChecks,
  capacity: { loadAverage: [2] },
});
recordHeartbeat({
  nodeId: 'NODE02',
  health: 'healthy',
  checks: readyChecks,
  capacity: { loadAverage: [1] },
});

const replacement = selectFailoverTarget('NODE01', { requiredChecks: Object.keys(readyChecks) });
assert.equal(replacement.status, 'ready');
assert.equal(replacement.replacementNodeId, 'NODE02');
assert.equal(replacement.target.nodeId, 'NODE02');

const noReplacement = selectFailoverTarget('NODE01', {
  requiredChecks: Object.keys(readyChecks),
  excludeNodeIds: ['NODE02'],
});
assert.equal(noReplacement.status, 'waiting');
assert.equal(noReplacement.reason, 'no-fresh-healthy-node');

console.log('NODE failover tests passed');
