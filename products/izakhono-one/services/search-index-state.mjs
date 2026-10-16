import { createHash } from 'node:crypto';
import { normalizeIndexRecord } from './search-index.mjs';

function digest(record) {
  return createHash('sha256').update(JSON.stringify(normalizeIndexRecord(record))).digest('hex');
}

export function buildIndexSnapshot(records = [], version = 1, generatedAt = new Date()) {
  const normalized = Array.isArray(records) ? records.map(normalizeIndexRecord) : [];
  const byId = new Map(normalized.filter(record => record.id).map(record => [record.id, { ...record, content_hash:digest(record) }]));
  return { version, generated_at:generatedAt.toISOString(), provider:'owned', records:byId.size, content_hash:createHash('sha256').update(JSON.stringify([...byId.values()])).digest('hex'), entries:[...byId.values()] };
}

export function diffIndex(previous = null, incoming = []) {
  const oldEntries = new Map((previous?.entries || []).map(record => [record.id, record]));
  const nextEntries = new Map((Array.isArray(incoming) ? incoming : []).map(record => [record.id, { ...normalizeIndexRecord(record), content_hash:digest(record) }]));
  const added=[]; const changed=[]; const removed=[];
  for (const [id, record] of nextEntries) {
    if (!oldEntries.has(id)) added.push(record);
    else if (oldEntries.get(id).content_hash !== record.content_hash) changed.push(record);
  }
  for (const [id, record] of oldEntries) if (!nextEntries.has(id)) removed.push(record);
  return { added, changed, removed, unchanged:Math.max(0,nextEntries.size-added.length-changed.length) };
}

export function applyIndexDelta(previous = null, incoming = [], generatedAt = new Date()) {
  const current = previous?.entries || [];
  const delta = diffIndex(previous, incoming);
  const removedIds = new Set(delta.removed.map(record => record.id));
  const changedIds = new Set(delta.changed.map(record => record.id));
  const retained = current.filter(record => !removedIds.has(record.id) && !changedIds.has(record.id));
  const updated = [...retained, ...delta.changed, ...delta.added];
  return { snapshot:buildIndexSnapshot(updated,Number(previous?.version || 0)+1,generatedAt), delta };
}
