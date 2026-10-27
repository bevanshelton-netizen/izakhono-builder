export function selectProvider({ product, candidates, contractProviderId = null }) {
  const eligible = candidates.filter((p) =>
    p.status === 'PRODUCTION_ELIGIBLE' &&
    p.products?.includes(product) &&
    (!contractProviderId || p.id === contractProviderId) &&
    p.health?.ok !== false &&
    p.capacity?.available !== false
  );

  return eligible.sort((a, b) => {
    const score = (p) =>
      (p.slaScore ?? 0) * 1000 +
      (p.healthScore ?? 0) * 100 +
      (p.capacityScore ?? 0) * 10 +
      (p.priority ?? 999) * -1 +
      (p.costScore ?? 0);
    return score(b) - score(a);
  })[0] ?? null;
}

export function canFailover({ currentProvider, candidate, contractProviderId = null }) {
  if (!candidate || candidate.status !== 'PRODUCTION_ELIGIBLE') return false;
  if (contractProviderId && candidate.id !== contractProviderId) return false;
  if (candidate.health?.ok === false || candidate.capacity?.available === false) return false;
  return candidate.id !== currentProvider?.id;
}

export function createProviderSwitchEvent({ customerId, serviceId, fromProviderId, toProviderId, reason, policyVersion = '1.0.0' }) {
  if (!customerId || !serviceId || !toProviderId || !reason) throw new Error('provider switch audit fields required');
  return {
    type: 'I_CONNECT_PROVIDER_SWITCH',
    occurredAt: new Date().toISOString(),
    customerId,
    serviceId,
    fromProviderId: fromProviderId ?? null,
    toProviderId,
    reason,
    policyVersion,
    reversible: true
  };
}
