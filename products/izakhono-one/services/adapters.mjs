import { resolveService, supports } from './contracts.mjs';

const adapterKinds = Object.freeze({
  search:'discovery',
  connecta:'social',
  ai:'intelligence',
  cloud:'workspace',
  commerce:'commerce',
  nav:'mobility',
  fortress:'security'
});

export function resolveAdapter(service) {
  const contract = resolveService(service);
  if (!contract) return null;
  return {
    service,
    kind: adapterKinds[service],
    status:'foundation',
    capabilities:[...contract.capabilities],
    execution:'prepare_only',
    sideEffects:false,
    provider:'replaceable',
    requiresVerifiedRuntime:true,
    requiresFortressGate:true
  };
}

export function prepareAdapter({service, action}={}) {
  const adapter = resolveAdapter(service);
  if (!adapter) return {ok:false, reason:'unknown_service'};
  if (!supports(service, action)) return {ok:false, reason:'unsupported_capability', service, action};
  return {ok:true, service, action, adapter, mode:'prepare_only', dispatchable:false, reason:'runtime_verification_required', sideEffects:false};
}

export function adapterRegistry() {
  return Object.keys(adapterKinds).map(resolveAdapter);
}
