import assert from 'node:assert/strict';
import { createMemorySearchStore, prepareSearchSnapshotWrite, commitSearchSnapshot, readSearchSnapshot } from './services/search-store.mjs';

const principal = { id:'owner-1', role:'owner', authenticated:true, verified:true };
const store = createMemorySearchStore();

const empty = await readSearchSnapshot({ store });
assert.equal(empty.ok, true);
assert.equal(empty.snapshot, null);

const prepared = await prepareSearchSnapshotWrite({
  principal,
  store,
  records:[
    {id:'a',title:'Alpha',url:'https://example.org/a'},
    {id:'b',title:'Beta',url:'https://example.org/b'}
  ],
  expectedVersion:0,
  correlationId:'corr-1',
  generatedAt:new Date('2026-10-17T11:00:00.000Z')
});
assert.equal(prepared.ok, true);
assert.equal(prepared.dispatchable, true);
assert.equal(prepared.snapshot.version, 1);
assert.equal(prepared.delta.added.length, 2);

const committed = await commitSearchSnapshot({ prepared, store });
assert.equal(committed.ok, true);
assert.equal(committed.committed, true);
assert.equal(committed.version, 1);

const current = await readSearchSnapshot({ store });
assert.equal(current.snapshot.version, 1);
assert.equal(current.snapshot.records, 2);

const conflict = await prepareSearchSnapshotWrite({ principal, store, records:[], expectedVersion:0, correlationId:'corr-2' });
assert.equal(conflict.ok, false);
assert.equal(conflict.reason, 'version_conflict');

const denied = await prepareSearchSnapshotWrite({ principal:{id:'member-1',role:'member',authenticated:true,verified:true}, store, records:[], expectedVersion:1 });
assert.equal(denied.ok, false);
assert.equal(denied.reason, 'fortress_authorization_denied');

const unavailable = await readSearchSnapshot({ store:null });
assert.equal(unavailable.ok, false);
assert.equal(unavailable.reason, 'search_store_unavailable');

console.log('SEARCH_STORE_TESTS=PASS');
