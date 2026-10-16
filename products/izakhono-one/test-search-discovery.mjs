import assert from 'node:assert/strict';
import { discoveryKinds, executeDiscovery, normalizeDiscoverySource, prepareDiscovery } from './services/search-discovery.mjs';

assert.deepEqual(discoveryKinds(), ['catalog','feed','api','reader']);
const source = normalizeDiscoverySource({ source_id:'owned-catalog', kind:'owned', status:'approved', approved:true, uri:'https://owned.example/catalog/', enabled:true, discovery_kind:'catalog' });
assert.equal(source.uri, 'https://owned.example/catalog');
assert.equal(source.discovery_kind, 'catalog');

const principal = { id:'operator-1', role:'operator', authenticated:true, verified:true };
const prepared = prepareDiscovery({ principal, source, correlationId:'discover-1' });
assert.equal(prepared.ok, true);
assert.equal(prepared.dispatchable, true);
assert.equal(prepared.readerRequired, true);
assert.equal(prepared.networkAccess, 'injected_reader_only');

const executed = executeDiscovery({ prepared, reader:() => ({ records:[{id:'r1', title:'Johannesburg', url:'https://example.org/jhb'}] }) });
assert.equal(executed.ok, true);
assert.equal(executed.executed, true);
assert.equal(executed.records[0].provenance.source_id, 'owned-catalog');
assert.equal(executed.sideEffects, false);

const missingReader = executeDiscovery({ prepared });
assert.equal(missingReader.ok, false);
assert.equal(missingReader.reason, 'reader_required');

const disabled = prepareDiscovery({ principal, source:{...source, enabled:false} });
assert.equal(disabled.ok, false);
assert.equal(disabled.reason, 'source_disabled');

const untrusted = prepareDiscovery({ principal, source:{source_id:'bad',kind:'untrusted',status:'pending',approved:false,enabled:true} });
assert.equal(untrusted.ok, false);
assert.equal(untrusted.reason, 'source_not_approved');

const denied = prepareDiscovery({ principal:{id:'operator-2',role:'operator',authenticated:false,verified:false}, source });
assert.equal(denied.ok, false);
assert.equal(denied.reason, 'fortress_authorization_denied');

console.log('SEARCH_DISCOVERY_TESTS=PASS');
