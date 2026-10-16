import { ingestOwnedRecords, indexManifest, validateIndexRecord } from './services/search-index.mjs';

const valid = validateIndexRecord({id:'jhb-1',title:'Johannesburg Skills Centre',url:'https://example.org/jhb',country:'South Africa',region:'Gauteng'});
if (!valid.valid) throw new Error('Valid SEARCH index record rejected');

const invalid = validateIndexRecord({title:'Missing URL'});
if (invalid.valid || !invalid.errors.includes('id_required') || !invalid.errors.includes('url_required')) throw new Error('Invalid SEARCH index record accepted');

const batch = ingestOwnedRecords([
  {id:'1',title:'Izakhono Africa',url:'https://example.org/1',country:'South Africa',region:'Gauteng'},
  {id:'2',title:'KORA',url:'https://example.org/2',country:'Ghana',region:'Accra'},
  {id:'3',title:'Broken'}
]);
if (!batch.ok || batch.inserted !== 2 || batch.rejected !== 1) throw new Error('SEARCH ingestion validation failed');
if (indexManifest(batch.records).provider !== 'owned' || indexManifest(batch.records).tracking !== false) throw new Error('SEARCH index manifest policy failed');

console.log('IZAKHONO ONE SEARCH index tests: PASS');
