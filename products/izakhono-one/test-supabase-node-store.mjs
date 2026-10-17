import assert from 'node:assert/strict';
import { createSupabaseNodeStore } from './services/supabase-node-store.mjs';

const unavailable = createSupabaseNodeStore({ url: '', key: '' });
assert.equal(unavailable.contract.available, false);
assert.equal((await unavailable.read('node-a')).reason, 'supabase_node_store_not_configured');

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, method: options.method || 'GET' });
  if (!options.method || options.method === 'GET') {
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('', { status: 201 });
};

const store = createSupabaseNodeStore({
  url: 'https://example.supabase.co/',
  key: 'test-service-role-key',
  fetchImpl
});

assert.equal(store.contract.available, true);
assert.equal(store.contract.persistence, 'supabase');

const read = await store.read('node-a');
assert.equal(read.ok, true);
assert.equal(read.node, null);

const ready = await store.listReady();
assert.equal(ready.ok, true);
assert.deepEqual(ready.nodes, []);

const upsert = await store.upsert({
  node_id: 'node-a',
  environment: 'production',
  capabilities: ['izakhono-one'],
  runtime_version: 'node-24',
  state: 'ready',
  health: 'healthy',
  security_posture: 'ready'
});
assert.equal(upsert.ok, true);
assert.equal(upsert.node.node_id, 'node-a');

const event = await store.appendEvent({
  node_id: 'node-a',
  event_type: 'node.ready',
  correlation_id: 'test-correlation',
  payload: { revision: 'abc' }
});
assert.equal(event.ok, true);
assert.deepEqual(calls.map(call => call.method), ['GET', 'GET', 'POST', 'POST']);

console.log('supabase node store adapter tests passed');
