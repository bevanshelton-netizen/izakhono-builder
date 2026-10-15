import { adapterRegistry, prepareAdapter } from './services/adapters.mjs';
import { prepareServiceDispatch } from './services/dispatcher.mjs';

const adapters = adapterRegistry();
if (adapters.length !== 7) throw new Error(`expected 7 adapters, got ${adapters.length}`);
if (adapters.some(x => x.status !== 'foundation' || x.execution !== 'prepare_only' || !x.requiresFortressGate)) throw new Error('adapter boundary failed');

const nav = prepareAdapter({service:'nav', action:'navigation'});
if (nav.ok || nav.dispatchable !== false || nav.reason !== 'runtime_not_verified') throw new Error('nav adapter must remain blocked until runtime is verified');

const foundation = prepareServiceDispatch({service:'nav', action:'navigation', runtime:{service_slug:'nav',state:'foundation',health:'unknown'}});
if (foundation.dispatchable !== false || foundation.reason !== 'runtime_not_verified') throw new Error('foundation runtime gate failed');

const payment = prepareServiceDispatch({service:'commerce', action:'payments', payment:true, verified:false, runtime:{service_slug:'commerce',state:'verified',health:'healthy'}});
if (payment.dispatchable !== false || !payment.requiresHumanReview) throw new Error('payment review gate failed');

const unsupported = prepareServiceDispatch({service:'search', action:'payments'});
if (unsupported.dispatchable !== false || unsupported.reason !== 'unsupported_capability') throw new Error('unsupported capability gate failed');

console.log('IZAKHONO ONE adapter/dispatch test: PASS');
