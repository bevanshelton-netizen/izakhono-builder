import { executeSearchProvider, normalizeSearchRequest, prepareSearchRequest, rankSignals, searchModes, searchProviders } from './services/search.mjs';

if (searchModes().length !== 5) throw new Error('SEARCH mode registry failed');
if (searchProviders()[0] !== 'owned') throw new Error('owned-first SEARCH provider failed');
if (normalizeSearchRequest({q:'  jobs in Johannesburg  ', mode:'local'}).query !== 'jobs in Johannesburg') throw new Error('SEARCH normalization failed');
if (!rankSignals(normalizeSearchRequest({q:'businesses in Johannesburg'})).african) throw new Error('African discovery signal failed');

const blocked = prepareSearchRequest({query:'Izakhono Africa'});
if (blocked.ok || blocked.reason !== 'fortress_authorization_denied') throw new Error('SEARCH must fail closed without principal');

const foundation = prepareSearchRequest({query:'Izakhono Africa',mode:'business',principal:{id:'u1',role:'member',authenticated:true,verified:true},runtime:{service_slug:'search',state:'foundation',health:'unknown'}});
if (foundation.ok || foundation.reason !== 'runtime_not_verified' || foundation.provider !== 'owned' || foundation.sideEffects !== false) throw new Error('SEARCH foundation gate failed');

const notReady = executeSearchProvider({prepared:foundation,executor:() => ({items:[]})});
if (notReady.executed || notReady.reason !== 'search_not_ready') throw new Error('SEARCH execution must remain blocked before verification');

const verified = prepareSearchRequest({query:'schools in Johannesburg',mode:'local',principal:{id:'u1',role:'member',authenticated:true,verified:true},runtime:{service_slug:'search',state:'verified',health:'healthy'}});
const executed = executeSearchProvider({prepared:verified,executor:({request,provider}) => ({query:request.query,provider,items:[]})});
if (!executed.ok || !executed.executed || executed.provider !== 'owned' || executed.sideEffects !== false) throw new Error('SEARCH verified execution boundary failed');

const rejectedProvider = executeSearchProvider({prepared:verified,provider:'unknown',executor:() => ({})});
if (rejectedProvider.executed || rejectedProvider.reason !== 'unsupported_provider') throw new Error('SEARCH unknown provider must fail closed');

console.log('IZAKHONO ONE SEARCH adapter tests: PASS');
