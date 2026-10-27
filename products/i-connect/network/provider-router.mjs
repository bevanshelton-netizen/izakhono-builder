const PROVIDERS = Object.freeze([
  { id: 'cellc-mvno', category: 'mobile-mvno', priority: 1, capabilities: ['voice','sms','4g','5g','esim','physical-sim'] },
  { id: 'vodacom-circles', category: 'mobile-mvno', priority: 2, capabilities: ['voice','sms','4g','5g','esim','physical-sim','iot'] },
  { id: 'afrinet', category: 'wholesale-isp', priority: 1, capabilities: ['fibre','lte','fixed-5g','api-provisioning'] },
  { id: 'openserve', category: 'fibre-wholesale', priority: 2, capabilities: ['fibre','isp-reseller'] },
  { id: 'wirulink', category: 'wireless-wholesale', priority: 2, capabilities: ['wireless','fibre','white-label'] },
  { id: 'konekt', category: 'network-aggregation', priority: 1, capabilities: ['wireless','fibre','microwave','carrier-core'] },
  { id: 'wecom', category: 'carrier-backbone', priority: 1, capabilities: ['ip-transit','layer2','ethernet','international-connectivity'] }
]);

function eligible(provider, requirements = {}) {
  if (!provider || provider.state && provider.state !== 'ACTIVE') return false;
  const required = requirements.capabilities || [];
  return required.every((capability) => provider.capabilities.includes(capability));
}

function score(provider, telemetry = {}, requirements = {}) {
  const health = telemetry[provider.id] || {};
  if (health.ok === false) return Number.NEGATIVE_INFINITY;
  const latency = Number.isFinite(health.latencyMs) ? Math.max(0, health.latencyMs) : 250;
  const coverage = Number.isFinite(health.coverage) ? Math.max(0, Math.min(100, health.coverage)) : 50;
  const capacity = Number.isFinite(health.capacity) ? Math.max(0, Math.min(100, health.capacity)) : 50;
  const commercial = Number.isFinite(health.commercialScore) ? Math.max(0, Math.min(100, health.commercialScore)) : 50;
  const cost = Number.isFinite(health.costScore) ? Math.max(0, Math.min(100, health.costScore)) : 50;
  const latencyScore = Math.max(0, 100 - Math.min(100, latency / 10));
  const preferred = Array.isArray(requirements.preferredProviders) && requirements.preferredProviders.includes(provider.id) ? 15 : 0;
  return (latencyScore * 0.20) + (coverage * 0.25) + (capacity * 0.20) + (commercial * 0.15) + (cost * 0.10) + (preferred) + (100 - provider.priority * 5) * 0.10;
}

export function listProviders() { return PROVIDERS.map((provider) => ({ ...provider, capabilities: [...provider.capabilities] })); }

export function selectProvider({ requirements = {}, telemetry = {}, exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const candidates = PROVIDERS.filter((provider) => !excluded.has(provider.id) && eligible(provider, requirements));
  if (!candidates.length) throw new Error('no_eligible_network_provider');
  const ranked = candidates.map((provider) => ({ provider, score: score(provider, telemetry, requirements) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score || a.provider.priority - b.provider.priority || a.provider.id.localeCompare(b.provider.id));
  if (!ranked.length) throw new Error('no_healthy_network_provider');
  return { selected: ranked[0].provider, ranked, evaluatedAt: new Date().toISOString() };
}

export function failover({ currentProviderId, requirements = {}, telemetry = {} } = {}) {
  const result = selectProvider({ requirements, telemetry, exclude: [currentProviderId] });
  return { ...result, from: currentProviderId || null, reason: 'provider_failover' };
}
