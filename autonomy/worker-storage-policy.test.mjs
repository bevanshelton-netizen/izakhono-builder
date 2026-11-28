import assert from 'node:assert/strict';
import { hasPersistentAgentStorage } from './worker-storage-policy.mjs';

assert.equal(hasPersistentAgentStorage({}), true, 'local owned runtime may use its private data directory');
assert.equal(hasPersistentAgentStorage({ GITHUB_ACTIONS: 'false' }), true);
assert.equal(hasPersistentAgentStorage({ GITHUB_ACTIONS: 'true' }), false, 'ephemeral CI storage must fail closed');
assert.equal(hasPersistentAgentStorage({ GITHUB_ACTIONS: 'true', IZAKHONO_NODE_DATA_DIR: '/mnt/izakhono-node-data' }), true);
assert.equal(hasPersistentAgentStorage({ GITHUB_ACTIONS: 'true', IZAKHONO_AGENT_STATE_PATH: '/mnt/state.json' }), false);
assert.equal(hasPersistentAgentStorage({ GITHUB_ACTIONS: 'true', IZAKHONO_AGENT_STATE_PATH: '/mnt/state.json', IZAKHONO_AGENT_QUEUE_PATH: '/mnt/queue.json' }), true);
assert.equal(hasPersistentAgentStorage({ GITHUB_ACTIONS: 'true', IZAKHONO_NODE_DATA_DIR: '   ' }), false);

console.log('Persistent worker storage policy tests passed');
