export const NETWORK_PROVIDER_STATES = new Set([
  'DISCOVERED',
  'ELIGIBLE',
  'PROVISIONING',
  'ACTIVE',
  'DEGRADED',
  'FAILED',
  'DRAINING',
  'DISABLED'
]);

export function assertProvider(provider) {
  if (!provider?.id) throw new Error('provider.id is required');
  if (!provider?.category) throw new Error('provider.category is required');
  if (!Array.isArray(provider?.capabilities)) throw new Error('provider.capabilities must be an array');
  return provider;
}

export function createNetworkOrder({ customerId, serviceId, product, requirements = {} }) {
  if (!customerId || !serviceId || !product) {
    throw new Error('customerId, serviceId and product are required');
  }
  return {
    orderId: crypto.randomUUID(),
    customerId,
    serviceId,
    product,
    requirements,
    createdAt: new Date().toISOString()
  };
}

export function providerHealth(result) {
  return {
    ok: result?.ok === true,
    latencyMs: Number.isFinite(result?.latencyMs) ? result.latencyMs : null,
    coverage: result?.coverage ?? null,
    capacity: result?.capacity ?? null,
    checkedAt: new Date().toISOString()
  };
}

export function canFailover({ current, candidate, requirements = {} }) {
  if (!candidate || candidate.id === current?.id) return false;
  if (candidate.state && candidate.state !== 'ACTIVE') return false;
  const required = requirements.capabilities || [];
  return required.every((capability) => candidate.capabilities?.includes(capability));
}
