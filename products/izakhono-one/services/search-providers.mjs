const providerNames = Object.freeze(['owned','replaceable_external']);

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 20).map((item, index) => ({
    id: String(item?.id || `result-${index + 1}`),
    title: String(item?.title || '').slice(0, 240),
    url: String(item?.url || '').slice(0, 1000),
    snippet: String(item?.snippet || item?.description || '').slice(0, 600),
    source: String(item?.source || '').slice(0, 160)
  }));
}

export function providerContract(name, executor = null) {
  const provider = String(name || '').trim();
  return {
    provider,
    available: providerNames.includes(provider) && typeof executor === 'function',
    sideEffects: false,
    supports: ['web','local','business','product','content'],
    contract: 'read_only_search_v1'
  };
}

export function executeProvider({ provider, request, signals, executor } = {}) {
  const contract = providerContract(provider, executor);
  if (!contract.available) return { ok:false, executed:false, reason:'provider_executor_unavailable', contract, sideEffects:false };
  const raw = executor({ request, signals });
  return { ok:true, executed:true, provider, results:normalizeItems(raw?.results || raw?.items), metadata:{african:Boolean(signals?.african),privacy_first:true,no_tracking:true}, sideEffects:false };
}

export function providerRegistry() {
  return providerNames.map(provider => providerContract(provider));
}

export function providerNamesList() { return [...providerNames]; }
