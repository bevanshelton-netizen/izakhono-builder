import { createSupabaseNodeStore } from './supabase-node-store.mjs';
import { createPersistentNodeControl } from './persistent-node-control.mjs';

export function createNodeControlApi(options = {}) {
  const store = options.store || createSupabaseNodeStore(options);
  const control = options.control || createPersistentNodeControl({ store, controlToken: options.controlToken, nodeTokens: options.nodeTokens });
  return { store, control };
}
