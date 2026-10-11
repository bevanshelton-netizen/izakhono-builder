import { resolveService, supports } from './contracts.mjs';

const descriptors = Object.freeze({
  search: 'Discovery foundation: search/index adapters are required before live retrieval.',
  connecta: 'Community foundation: identity, feed, groups and messaging adapters are required before live social actions.',
  ai: 'Intelligence foundation: model/provider adapters are required before live generation or automation.',
  cloud: 'Workspace foundation: storage and collaboration adapters are required before live file operations.',
  commerce: 'Commerce foundation: catalog, order and verified payment adapters are required before live transactions.',
  nav: 'Mobility foundation: maps, routing, safety and vehicle adapters are required before live navigation.',
  fortress: 'Security foundation: identity, threat and audit adapters are required before live security actions.'
});

export function prepareServiceRequest({service, capability, authenticated=false, verified=false}={}) {
  const contract = resolveService(service);
  if (!contract) return {ok:false, decision:'deny', reason:'unknown_service'};
  if (!supports(service, capability)) return {ok:false, decision:'deny', reason:'unsupported_capability'};
  if (service === 'commerce' && capability === 'payments' && !verified) {
    return {ok:false, decision:'review', reason:'payment_verification_required', service, capability};
  }
  return {
    ok:true,
    decision:'review',
    reason:'foundation_adapter_required',
    service,
    capability,
    authenticated,
    description:descriptors[service]
  };
}

export function foundationDescriptor(service) {
  const contract = resolveService(service);
  if (!contract) return null;
  return {service, status:'foundation', apiVersion:contract.apiVersion, policyClass:contract.policyClass, enabled:contract.enabled, capabilities:[...contract.capabilities], description:descriptors[service]};
}
