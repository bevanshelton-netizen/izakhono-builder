import assert from 'node:assert/strict';
import { applyIndexDelta, buildIndexSnapshot, diffIndex } from './services/search-index-state.mjs';

const first=[
 {id:'a',title:'Alpha',url:'https://example.org/a'},
 {id:'b',title:'Beta',url:'https://example.org/b'}
];
const snapshot=buildIndexSnapshot(first,1,new Date('2026-10-16T20:00:00.000Z'));
assert.equal(snapshot.version,1);
assert.equal(snapshot.records,2);

const second=[
 {id:'a',title:'Alpha Updated',url:'https://example.org/a'},
 {id:'c',title:'Gamma',url:'https://example.org/c'}
];
const delta=diffIndex(snapshot,second);
assert.equal(delta.added.length,1);
assert.equal(delta.changed.length,1);
assert.equal(delta.removed.length,1);
assert.equal(delta.added[0].id,'c');
assert.equal(delta.changed[0].id,'a');
assert.equal(delta.removed[0].id,'b');

const applied=applyIndexDelta(snapshot,second,new Date('2026-10-16T21:00:00.000Z'));
assert.equal(applied.snapshot.version,2);
assert.equal(applied.snapshot.records,2);
assert.deepEqual(applied.snapshot.entries.map(record=>record.id).sort(),['a','c']);
assert.equal(applied.snapshot.entries.find(record=>record.id==='a').title,'Alpha Updated');

console.log('SEARCH_INDEX_STATE_TESTS=PASS');
