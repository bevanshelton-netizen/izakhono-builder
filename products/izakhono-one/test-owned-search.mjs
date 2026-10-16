import { createOwnedSearchExecutor, localDiscoverySignals, ownedSearchIndexStats } from './services/owned-search.mjs';

const signals = localDiscoverySignals({query:'schools in Johannesburg',country:'South Africa',region:'Gauteng'});
if (!signals.africa || signals.matches[0]?.country !== 'south africa') throw new Error('African local discovery failed');

const index = [
  {id:'1',title:'Johannesburg Skills Centre',description:'Education and skills training in Gauteng',url:'https://example.org/jhb',country:'South Africa',region:'Gauteng',category:'education',source:'owned'},
  {id:'2',title:'Cape Town Furniture',description:'Furniture manufacturing',url:'https://example.org/ct',country:'South Africa',region:'Western Cape',category:'business',source:'owned'},
  {id:'3',title:'London Weather',description:'Weather information',url:'https://example.org/london',country:'United Kingdom',region:'London',category:'weather',source:'owned'}
];

const execute = createOwnedSearchExecutor({index});
const result = execute({request:{query:'Johannesburg skills',country:'South Africa',region:'Gauteng'},signals});
if (result.items[0]?.id !== '1' || result.items.length !== 1) throw new Error('Owned search ranking failed');
if (ownedSearchIndexStats(index).records !== 3 || ownedSearchIndexStats(index).tracking !== false) throw new Error('Owned search index policy failed');

console.log('IZAKHONO ONE owned SEARCH tests: PASS');
