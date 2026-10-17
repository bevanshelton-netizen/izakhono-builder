import assert from 'node:assert/strict';
import { createSupabaseSearchStore } from './services/supabase-search-store.mjs';

const unavailable = createSupabaseSearchStore({ url: '', key: '' });
assert.equal(unavailable.contract.available, false);
assert.equal((await unavailable.readSnapshot()).reason, 'supabase_search_store_not_configured');

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, method: options.method || 'GET' });
  if (!options.method || options.method === 'GET') {
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('', { status: 201 });
};

const store = createSupabaseSearchStore({
  url: 'https://example.supabase.co/',
  key: 'test-service-role-key',
  fetchImpl
});

assert.equal(store.contract.available, true);
assert.equal(store.contract.persistence, 'supabase');

const read = await store.readSnapshot();
assert.equal(read.ok, true);
assert.equal(read.snapshot, null);

const write = await store.writeSnapshot({
  version: 1,
  generated_at: '2026-10-17T00:00:00.000Z',
  provider: 'owned',
  records: 1,
  content_hash: 'hash-1',
  entries: [{ id: 'one' }]
}, 0);
assert.equal(write.ok, true);
assert.equal(write.version, 1);

const event = await store.appendEvent({
  type: 'search.index.snapshot_prepared',
  version: 1,
  correlation_id: 'test-correlation',
  delta: { added: 1 },
  content_hash: 'hash-1'
});
assert.equal(event.ok, true);
assert.equal(calls.length, 3);
assert.deepEqual(calls.map(call => call.method), ['GET', 'POST', 'POST']);

console.log('supabase search store adapter tests passed');
