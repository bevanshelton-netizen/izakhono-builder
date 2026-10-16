import { canServeRuntime } from './runtime.mjs';
import { authorizeRequest } from './fortress.mjs';

const modes = Object.freeze(['web','local','business','product','content']);
const providers = Object.freeze(['owned','replaceable_external']);
const africanSignals = Object.freeze(['africa','south africa','johannesburg','cape town','durban','gqeberha','pretoria','ghana','kenya','nigeria','zambia','zimbabwe','botswana','namibia','mozambique','tanzania','uganda']);

export function normalizeSearchRequest(input = {}) {
  const query = String(input.query || input.q || '').trim().slice(0, 500);
  const mode = modes.includes(input.mode) ? input.mode : 'web';
  const country = String(input.country || '').trim().slice(0, 80);
  return { query, mode, country, language: String(input.language || '').trim().slice(0, 40) || null, region: String(input.region || '').trim().slice(0, 80) || null };
}

export function rankSignals(request) {
  const text = `${request.query} ${request.country} ${request.region}`.toLowerCase();
  return { african: africanSignals.some(signal => text.includes(signal)), privacy_first: true, no_tracking: true };
}

export function prepareSearchRequest({ query, q, mode, country, language, region, principal, runtime, correlationId } = {}) {
  const request = normalizeSearchRequest({ query, q, mode, country, language, region });
  if (!request.query) return { ok:false, reason:'query_required', mode:'prepare_only', sideEffects:false };
  const fortress = authorizeRequest({ principal, service:'search', action:'read', resource:'service:search', correlationId });
  if (fortress.decision !== 'allow') return { ok:false, reason:fortress.decision === 'review' ? 'fortress_review_required' : 'fortress_authorization_denied', mode:'prepare_only', fortress, requiresHumanReview:fortress.decision === 'review', sideEffects:false };
  const runtimeValue = runtime || { service_slug:'search', state:'foundation', health:'unknown' };
  const ready = canServeRuntime(runtimeValue.state, runtimeValue.health);
  const signals = rankSignals(request);
  return { ok:ready, mode:'prepare_only', dispatchable:ready, request, signals, provider:providers[0], fallback:providers[1], fortress, runtime:{state:runtimeValue.state,health:runtimeValue.health,ready}, reason:ready?'ready_for_search_provider':'runtime_not_verified', sideEffects:false };
}

export function executeSearchProvider({ prepared, provider, executor } = {}) {
  if (!prepared?.dispatchable || prepared.mode !== 'prepare_only') return { ok:false, executed:false, reason:'search_not_ready', sideEffects:false };
  if (!prepared.fortress || prepared.fortress.decision !== 'allow') return { ok:false, executed:false, reason:'fortress_gate_required', sideEffects:false };
  const selected = provider || prepared.provider;
  if (!providers.includes(selected)) return { ok:false, executed:false, reason:'unsupported_provider', sideEffects:false };
  if (typeof executor !== 'function') return { ok:false, executed:false, reason:'provider_executor_required', provider:selected, sideEffects:false };
  const result = executor({ request:prepared.request, provider:selected, signals:prepared.signals });
  return { ok:true, executed:true, provider:selected, result, sideEffects:false };
}

export function searchModes() { return [...modes]; }
export function searchProviders() { return [...providers]; }
