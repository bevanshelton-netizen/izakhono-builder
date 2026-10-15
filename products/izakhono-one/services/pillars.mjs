import { serviceContracts } from './contracts.mjs';

const descriptions = Object.freeze({
  search:'African-first discovery adapter boundary.',
  connecta:'Identity-aware social and community adapter boundary.',
  ai:'Provider-neutral intelligence and automation adapter boundary.',
  cloud:'Owned-first workspace and storage adapter boundary.',
  commerce:'Catalog, order and verified-payment adapter boundary.',
  nav:'Navigation, safety, fleet and offline adapter boundary.',
  fortress:'Identity, policy, threat and audit control boundary.'
});

export function pillarDescriptor(service) {
  const contract = serviceContracts[service];
  if (!contract) return null;
  return {
    service,
    status:'foundation',
    execution:'adapter_required',
    capabilities:[...contract.capabilities],
    readOnly:contract.readOnly,
    description:descriptions[service]
  };
}

export function listPillars() {
  return Object.keys(serviceContracts).map(pillarDescriptor);
}

export function preparePillarRequest({service, capability}={}) {
  const pillar = pillarDescriptor(service);
  if (!pillar) return {ok:false, decision:'deny', reason:'unknown_service'};
  if (!pillar.capabilities.includes(capability)) return {ok:false, decision:'deny', reason:'unsupported_capability', service, capability};
  return {ok:false, decision:'review', reason:'foundation_adapter_required', service, capability, sideEffects:false};
}
