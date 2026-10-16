import { adapterRegistry, prepareAdapter } from './services/adapters.mjs';
import { prepareServiceDispatch } from './services/dispatcher.mjs';

const adapters = adapterRegistry();
if (adapters.length !== 7) throw new Error(`expected 7 adapters, got ${adapters.length}`);
if (adapters.some(x => x.status !== 'foundation' || x.execution !== 'prepare_only' || !x.requiresFortressGate)) throw new Error('adapter boundary failed');

const blocked = prepareAdapter({service:'nav', action:'navigation'});
if (blocked.ok || blocked.dispatchable !== false || blocked.reason !== 'fortress_authorization_denied') throw new Error('missing principal must fail FORTRESS closed');

const nav = prepareAdapter({service:'nav', action:'navigation', principal:{id:'operator-1',role:'operator',authenticated:true,verified:true}});
if (nav.ok || nav.dispatchable !== false || nav.reason !== 'runtime_not_verified') throw new Error('nav adapter must remain blocked until runtime is verified');

const foundation = prepareServiceDispatch({service:'nav', action:'navigation', principal:{id:'operator-1',role:'operator',authenticated:true,verified:true}, runtime:{service_slug:'nav',state:'foundation',health:'unknown'}});
if (foundation.dispatchable !== false || foundation.reason !== 'runtime_not_verified' || foundation.fortress?.decision !== 'allow') throw new Error('foundation runtime/FORTRESS gate failed');

const payment = prepareServiceDispatch({service:'commerce', action:'payments', principal:{id:'operator-1',role:'operator',authenticated:true,verified:false}, payment:true, runtime:{service_slug:'commerce',state:'verified',health:'healthy'}});
if (payment.dispatchable !== false || payment.reason !== 'fortress_review_required' || !payment.requiresHumanReview) throw new Error('payment FORTRESS review gate failed');

const unsupported = prepareServiceDispatch({service:'search', action:'payments', principal:{id:'operator-1',role:'operator',authenticated:true,verified:true}});
if (unsupported.dispatchable !== false || unsupported.reason !== 'unsupported_capability') throw new Error('unsupported capability gate failed');

console.log('IZAKHONO ONE adapter/dispatch/FORTRESS test: PASS');
