import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RUNTIME_ADAPTER_METHODS,
  assertRuntimeAdapter,
  createRuntimeAdapterRegistry
} from './runtime-adapter-contract.mjs';

function adapter(overrides = {}) {
  return Object.fromEntries([
    ...RUNTIME_ADAPTER_METHODS.map(name => [name, async () => ({ ok: true })]),
    ...Object.entries(overrides)
  ]);
}

test('requires the complete provider-neutral HOST lifecycle surface', () => {
  const complete = adapter();
  assert.equal(assertRuntimeAdapter(complete), complete);
  for (const method of RUNTIME_ADAPTER_METHODS) {
    const incomplete = adapter();
    delete incomplete[method];
    assert.throws(() => assertRuntimeAdapter(incomplete), new RegExp(method));
  }
});

test('registers only allow-listed adapter IDs and prevents replacement', () => {
  const registry = createRuntimeAdapterRegistry();
  const implementation = adapter();
  assert.equal(registry.register('oci-managed', implementation), 'oci-managed');
  assert.equal(registry.get('oci-managed'), implementation);
  assert.equal(registry.has('oci-managed'), true);
  assert.deepEqual(registry.list(), ['oci-managed']);
  assert.throws(() => registry.register('OCI Managed', adapter()), /stable lowercase/);
  assert.throws(() => registry.register('oci-managed', adapter()), /already registered/);
});

test('does not infer or require physical machine identity', () => {
  const registry = createRuntimeAdapterRegistry();
  registry.register('provider-neutral', adapter());
  assert.equal(typeof registry.get('provider-neutral').resolveTarget, 'function');
});
