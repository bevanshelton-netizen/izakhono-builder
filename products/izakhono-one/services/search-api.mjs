import { createSupabaseSearchStore } from './supabase-search-store.mjs';
import { readSearchSnapshot, prepareSearchSnapshotWrite, commitSearchSnapshot, storeContract } from './search-store.mjs';

export function createSearchApi({ store = createSupabaseSearchStore() } = {}) {
  return {
    contract() { return storeContract(store); },
    async read() { return readSearchSnapshot({ store }); },
    async prepare({ principal, records, expectedVersion, correlationId, generatedAt } = {}) {
      return prepareSearchSnapshotWrite({ principal, store, records, expectedVersion, correlationId, generatedAt });
    },
    async commit({ prepared, expectedVersion } = {}) {
      return commitSearchSnapshot({ prepared, store, expectedVersion });
    }
  };
}
