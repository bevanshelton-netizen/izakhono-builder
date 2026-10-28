import { selectProvider } from './provider-router.mjs';

export const PROVISIONING_STATES = Object.freeze([
  'PLANNED',
  'PROVISIONING',
  'RETRYING',
  'ACTIVE',
  'FAILED'
]);

export function createProvisioningPlan({ customerId, serviceId, product, requirements = {}, telemetry = {}, maxAttempts = 2 } = {}) {
  if (!customerId || !serviceId || !product) throw new Error('customerId, serviceId and product are required');
  const route = selectProvider({ requirements, telemetry });
  return {
    jobId: crypto.randomUUID(),
    customerId,
    serviceId,
    product,
    requirements,
    primaryProviderId: route.selected.id,
    rankedProviderIds: route.ranked.map(({ provider }) => provider.id),
    maxAttempts: Math.max(1, Math.min(5, Number(maxAttempts) || 2)),
    state: 'PLANNED',
    createdAt: new Date().toISOString()
  };
}

export async function executeProvisioning({ plan, adapter, telemetry = {} } = {}) {
  if (!plan?.jobId) throw new Error('provisioning_plan_required');
  if (typeof adapter !== 'function') {
    return { ...plan, state: 'PROVISIONING', execution: 'adapter_required', providerAttempts: [] };
  }

  const attempts = [];
  const excluded = [];
  let lastError = null;
  let current = plan.primaryProviderId;

  for (let attempt = 1; attempt <= plan.maxAttempts; attempt += 1) {
    if (!current) break;
    try {
      const result = await adapter({ providerId: current, plan, attempt });
      attempts.push({ attempt, providerId: current, ok: result?.ok === true, externalReference: result?.externalReference || null });
      if (result?.ok === true) {
        return { ...plan, state: 'ACTIVE', activeProviderId: current, providerAttempts: attempts, completedAt: new Date().toISOString() };
      }
      lastError = result?.error || 'provider_provisioning_failed';
    } catch (error) {
      lastError = error?.message || 'provider_adapter_failed';
      attempts.push({ attempt, providerId: current, ok: false, error: lastError });
    }
    excluded.push(current);
    if (attempt < plan.maxAttempts) {
      const next = selectProvider({ requirements: plan.requirements, telemetry, exclude: excluded });
      current = next.selected.id;
    }
  }

  return { ...plan, state: 'FAILED', providerAttempts: attempts, error: lastError || 'provisioning_failed', failedAt: new Date().toISOString() };
}
