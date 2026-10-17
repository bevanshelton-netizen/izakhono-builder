export const runtimeStates = Object.freeze(['foundation','staging','verified','degraded','disabled']);
export const runtimeHealth = Object.freeze(['unknown','healthy','degraded','unhealthy']);

export function normalizeRuntimeState(input = {}) {
  const state = runtimeStates.includes(input.state) ? input.state : 'foundation';
  const health = runtimeHealth.includes(input.health) ? input.health : 'unknown';
  return {
    service_slug: String(input.service_slug || '').trim(),
    state,
    health,
    version: String(input.version || 'v1'),
    last_check_at: input.last_check_at || null,
    last_event_at: input.last_event_at || null,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  };
}

export function publicRuntimeView(input = {}) {
  const value = normalizeRuntimeState(input);
  return {
    service_slug: value.service_slug,
    state: value.state,
    health: value.health,
    version: value.version,
    last_check_at: value.last_check_at
  };
}

export function canServeRuntime(state, health, databaseSecurity = null) {
  if (state !== 'verified' || health !== 'healthy') return false;
  if (databaseSecurity === null || databaseSecurity === undefined) return true;
  return databaseSecurity.ready_for_verified_runtime === true;
}
