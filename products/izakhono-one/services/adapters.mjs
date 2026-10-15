import { resolveService, supports } from './contracts.mjs';
import { prepareServiceDispatch } from './dispatcher.mjs';

const adapterKinds = Object.freeze({search:'discovery',connecta:'social',ai:'intelligence',cloud:'workspace',commerce:'commerce',nav:'mobility',fortress:'security'});
const adapterStatus = Object.freeze({search:'foundation',connecta:'foundation',ai:'foundation',cloud:'foundation',commerce:'foundation',nav:'foundation',fortress:'foundation'});

export function resolveAdapter(service) {
  const contract = resolveService(service);
  if (!contract) return null;
  return {service,kind:adapterKinds[service],status:adapterStatus[service],capabilities:[...contract.capabilities],execution:'prepare_only',sideEffects:false,provider:'replaceable',requiresVerifiedRuntime:true,requiresFortressGate:true};
}

export function prepareAdapter({service, action, runtime, authenticated=false, verified=false, destructive=false, payment=false, correlationId}={}) {
  const adapter = resolveAdapter(service);
  if (!adapter) return {ok:false, reason:'unknown_service', mode:'prepare_only', sideEffects:false};
  if (!supports(service, action)) return {ok:false, reason:'unsupported_capability', service, action, mode:'prepare_only', sideEffects:false};
  const dispatch = prepareServiceDispatch({service,action,runtime,authenticated,verified,destructive,payment,correlationId});
  return {...dispatch,adapter};
}

export function adapterRegistry() { return Object.keys(adapterKinds).map(resolveAdapter); }
