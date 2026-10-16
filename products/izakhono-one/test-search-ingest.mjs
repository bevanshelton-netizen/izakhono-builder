import assert from 'node:assert/strict';
import { deduplicateRecords, freshnessStatus, normalizeSource, prepareIngestion, sourceKindsList } from './services/search-ingest.mjs';

assert.deepEqual(sourceKindsList(), ['owned','approved_external','untrusted']);

const source = normalizeSource({ source_id:'izakhono-owned', name:'IZAKHONO Owned Index', kind:'owned', uri:'https://search.izakhono.local/', status:'approved', approved:true, license:'owned', last_checked_at:'2026-10-16T18:00:00.000Z', freshness_seconds:3600 });
assert.equal(source.approved, true);
assert.equal(source.uri, 'https://search.izakhono.local');
assert.equal(freshnessStatus(source, new Date('2026-10-16T18:30:00.000Z')).fresh, true);
assert.equal(freshnessStatus(source, new Date('2026-10-16T20:00:01.000Z')).reason, 'stale');

const records = [
  { id:'a', title:'Johannesburg Skills', description:'Training', url:'https://example.org/a/', country:'South Africa', region:'Gauteng' },
  { id:'b', title:'Johannesburg Skills duplicate', description:'Training', url:'https://example.org/a', country:'South Africa', region:'Gauteng' },
  { id:'c', title:'Durban Skills', description:'Training', url:'https://example.org/c', country:'South Africa', region:'KwaZulu-Natal' }
];
const deduped = deduplicateRecords(records);
assert.equal(deduped.records.length, 2);
assert.equal(deduped.duplicates.length, 1);

const principal = { id:'operator-1', role:'operator', authenticated:true, verified:true };
const prepared = prepareIngestion({ principal, source, records:[records[0], records[2]], now:new Date('2026-10-16T18:30:00.000Z'), correlationId:'ingest-test-1' });
assert.equal(prepared.ok, true);
assert.equal(prepared.mode, 'prepare_only');
assert.equal(prepared.sideEffects, false);
assert.equal(prepared.fortress.decision, 'allow');
assert.equal(prepared.ingestion.inserted, 2);
assert.equal(prepared.provenance, true);

const unapproved = prepareIngestion({ principal, source:{ source_id:'unknown', kind:'untrusted', status:'pending', approved:false }, records:[records[0]] });
assert.equal(unapproved.ok, false);
assert.equal(unapproved.reason, 'source_not_approved');
assert.equal(unapproved.sideEffects, false);

const unauthenticated = prepareIngestion({ principal:{ id:'operator-2', role:'operator', authenticated:false, verified:false }, source, records:[records[0]] });
assert.equal(unauthenticated.ok, false);
assert.equal(unauthenticated.reason, 'fortress_authorization_denied');

console.log('SEARCH_INGEST_TESTS=PASS');
