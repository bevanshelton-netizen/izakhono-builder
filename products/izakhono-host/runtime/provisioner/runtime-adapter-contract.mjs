const ADAPTER_ID = /^[a-z0-9][a-z0-9._-]{1,62}$/;

export const RUNTIME_ADAPTER_METHODS = Object.freeze([
  'resolveTarget',
  'provision',
  'deploy',
  'inspect',
  'stop',
  'destroy',
  'backup',
  'restore'
]);

/**
 * Validate the HOST-facing adapter surface without coupling HOST to a provider.
 * Adapter methods must be implemented by trusted server-side code; browser
 * requests must never select arbitrary modules, commands, images or credentials.
 */
export function assertRuntimeAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError('A runtime adapter object is required');
  }
  const missing = RUNTIME_ADAPTER_METHODS.filter(name => typeof adapter[name] !== 'function');
  if (missing.length) {
    throw new TypeError(`Runtime adapter is missing methods: ${missing.join(', ')}`);
  }
  return adapter;
}

/**
 * A small allow-listed registry. The target ID is a logical HOST binding, not
 * a hostname, IP address, VM name or physical machine identifier.
 */
export function createRuntimeAdapterRegistry() {
  const adapters = new Map();

  return Object.freeze({
    register(adapterId, adapter) {
      if (typeof adapterId !== 'string' || !ADAPTER_ID.test(adapterId)) {
        throw new TypeError('adapterId must be a stable lowercase identifier');
      }
      assertRuntimeAdapter(adapter);
      if (adapters.has(adapterId)) throw new Error(`Runtime adapter already registered: ${adapterId}`);
      adapters.set(adapterId, adapter);
      return adapterId;
    },

    get(adapterId) {
      return adapters.get(adapterId) || null;
    },

    has(adapterId) {
      return adapters.has(adapterId);
    },

    list() {
      return [...adapters.keys()].sort();
    }
  });
}
