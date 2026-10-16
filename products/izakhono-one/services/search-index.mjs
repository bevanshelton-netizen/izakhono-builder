const maxRecords = 10000;

function clean(value, limit) {
  return String(value ?? '').trim().slice(0, limit);
}

export function normalizeIndexRecord(input = {}) {
  return {
    id: clean(input.id, 160),
    title: clean(input.title, 240),
    description: clean(input.description, 600),
    url: clean(input.url, 1000),
    source: clean(input.source || 'owned', 160),
    country: clean(input.country, 80),
    region: clean(input.region, 100),
    category: clean(input.category, 100),
    language: clean(input.language, 40),
    indexed_at: input.indexed_at || null
  };
}

export function validateIndexRecord(record = {}) {
  const value = normalizeIndexRecord(record);
  const errors = [];
  if (!value.id) errors.push('id_required');
  if (!value.title) errors.push('title_required');
  if (!value.url) errors.push('url_required');
  return { valid:errors.length === 0, errors, record:value };
}

export function ingestOwnedRecords(records = []) {
  if (!Array.isArray(records)) return { ok:false, inserted:0, rejected:0, errors:['records_array_required'], records:[] };
  const accepted = [];
  const errors = [];
  for (const record of records.slice(0, maxRecords)) {
    const result = validateIndexRecord(record);
    if (result.valid) accepted.push(result.record);
    else errors.push({ id:result.record.id || null, errors:result.errors });
  }
  return { ok:errors.length === 0, inserted:accepted.length, rejected:errors.length, records:accepted, errors, maxRecords };
}

export function indexManifest(records = []) {
  const ingested = ingestOwnedRecords(records);
  return { provider:'owned', version:'index_v1', records:ingested.inserted, rejected:ingested.rejected, tracking:false, mutable:false };
}
