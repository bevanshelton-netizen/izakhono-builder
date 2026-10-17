import { authorizeRequest } from './fortress.mjs';
import { normalizeDiscoveredRecord, sourceTrust } from './search-ingest.mjs';

const discoveryKindValues = Object.freeze(['catalog','feed','api','reader']);

export function normalizeDiscoverySource(input = {}) {
  const trust = sourceTrust(input);
  return { ...trust.source, discovery_kind: discoveryKindValues.includes(input.discovery_kind) ? input.discovery_kind : 'reader', enabled: Boolean(input.enabled), fetch_policy: input.fetch_policy === 'manual' ? 'manual' : 'controlled' };
}

export function prepareDiscovery({ principal, source = {}, correlationId } = {}) {
  const normalized = normalizeDiscoverySource(source);
  const fortress = authorizeRequest({ principal, service:'search', action:'execute', resource:'service:search:discovery', correlationId });
  if (fortress.decision !== 'allow') return { ok:false, reason:fortress.decision === 'review' ? 'fortress_review_required' : 'fortress_authorization_denied', mode:'prepare_only', sideEffects:false, fortress };
  const trust = sourceTrust(normalized);
  if (!trust.trusted) return { ok:false, reason:'source_not_approved', mode:'prepare_only', sideEffects:false, source:trust.source, fortress };
  if (!normalized.enabled) return { ok:false, reason:'source_disabled', mode:'prepare_only', sideEffects:false, source:normalized, fortress };
  return { ok:true, mode:'prepare_only', sideEffects:false, dispatchable:true, source:normalized, fortress, readerRequired:true, networkAccess:'injected_reader_only' };
}

export function executeDiscovery({ prepared, reader } = {}) {
  if (!prepared?.dispatchable || prepared.mode !== 'prepare_only') return { ok:false, executed:false, reason:'discovery_not_ready', sideEffects:false };
  if (!prepared.fortress || prepared.fortress.decision !== 'allow') return { ok:false, executed:false, reason:'fortress_gate_required', sideEffects:false };
  if (typeof reader !== 'function') return { ok:false, executed:false, reason:'reader_required', sideEffects:false };
  const raw = reader({ source:prepared.source });
  if (!Array.isArray(raw?.records)) return { ok:false, executed:false, reason:'reader_records_required', sideEffects:false };
  const records = raw.records.map(record => normalizeDiscoveredRecord(record, prepared.source));
  return { ok:true, executed:true, source:prepared.source, records, provenance:true, sideEffects:false };
}

export function discoveryKinds() { return [...discoveryKindValues]; }
