import { createHash } from 'node:crypto';
import { authorizeRequest } from './fortress.mjs';
import { buildIndexSnapshot, diffIndex } from './search-index-state.mjs';

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createMemorySearchStore(initialSnapshot = null) {
  let snapshot = clone(initialSnapshot);
  const events = [];
  return {
    async readSnapshot() { return clone(snapshot); },
    async writeSnapshot(nextSnapshot, expectedVersion = null) {
      if (expectedVersion !== null && Number(snapshot?.version || 0) !== Number(expectedVersion)) {
        return { ok:false, reason:'version_conflict', currentVersion:Number(snapshot?.version || 0), sideEffects:false };
      }
      snapshot = clone(nextSnapshot);
      return { ok:true, version:Number(snapshot?.version || 0), content_hash:snapshot?.content_hash || digest(snapshot), sideEffects:false };
    },
    async appendEvent(event) {
      events.push(clone(event));
      return { ok:true, event_count:events.length, sideEffects:false };
    },
    async readEvents() { return clone(events); }
  };
}

export function storeContract(store) {
  return {
    available:Boolean(store && typeof store.readSnapshot === 'function' && typeof store.writeSnapshot === 'function' && typeof store.appendEvent === 'function'),
    readSnapshot:typeof store?.readSnapshot === 'function',
    writeSnapshot:typeof store?.writeSnapshot === 'function',
    appendEvent:typeof store?.appendEvent === 'function',
    persistence:'injected',
    sideEffects:'explicit_adapter_only'
  };
}

export async function readSearchSnapshot({ store } = {}) {
  const contract = storeContract(store);
  if (!contract.available) return { ok:false, reason:'search_store_unavailable', mode:'prepare_only', sideEffects:false, contract };
  const snapshot = await store.readSnapshot();
  return { ok:true, snapshot:clone(snapshot), mode:'prepare_only', persistent:Boolean(snapshot), contract, sideEffects:false };
}

export async function prepareSearchSnapshotWrite({ principal, store, records = [], expectedVersion = null, correlationId, generatedAt = new Date() } = {}) {
  const contract = storeContract(store);
  if (!contract.available) return { ok:false, reason:'search_store_unavailable', mode:'prepare_only', sideEffects:false, contract };
  const fortress = authorizeRequest({ principal, service:'search', action:'execute', resource:'service:search:index', correlationId });
  if (fortress.decision !== 'allow') return { ok:false, reason:fortress.decision === 'review' ? 'fortress_review_required' : 'fortress_authorization_denied', mode:'prepare_only', sideEffects:false, fortress, requiresHumanReview:fortress.decision === 'review' };
  const previous = await store.readSnapshot();
  const currentVersion = Number(previous?.version || 0);
  if (expectedVersion !== null && currentVersion !== Number(expectedVersion)) return { ok:false, reason:'version_conflict', mode:'prepare_only', sideEffects:false, currentVersion, expectedVersion:Number(expectedVersion), fortress };
  const delta = diffIndex(previous, records);
  const next = buildIndexSnapshot(records, currentVersion + 1, generatedAt);
  const event = { type:'search.index.snapshot_prepared', version:next.version, correlation_id:correlationId || null, delta:{added:delta.added.length,changed:delta.changed.length,removed:delta.removed.length,unchanged:delta.unchanged}, content_hash:next.content_hash };
  return { ok:true, mode:'prepare_only', dispatchable:true, sideEffects:false, previousVersion:currentVersion, snapshot:next, delta, event, fortress, contract };
}

export async function commitSearchSnapshot({ prepared, store, expectedVersion = null } = {}) {
  const contract = storeContract(store);
  if (!contract.available) return { ok:false, committed:false, reason:'search_store_unavailable', sideEffects:false, contract };
  if (!prepared?.dispatchable || prepared.mode !== 'prepare_only') return { ok:false, committed:false, reason:'snapshot_not_ready', sideEffects:false };
  if (prepared.fortress?.decision !== 'allow') return { ok:false, committed:false, reason:'fortress_gate_required', sideEffects:false };
  const expected = expectedVersion === null ? prepared.previousVersion : Number(expectedVersion);
  const result = await store.writeSnapshot(prepared.snapshot, expected);
  if (!result.ok) return { ok:false, committed:false, reason:result.reason || 'snapshot_write_failed', sideEffects:false, ...result };
  const eventResult = await store.appendEvent(prepared.event);
  return { ok:true, committed:true, version:prepared.snapshot.version, content_hash:prepared.snapshot.content_hash, event:eventResult, sideEffects:true };
}
