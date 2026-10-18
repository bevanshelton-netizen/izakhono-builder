import os from 'node:os';

/**
 * Portable compute registry.
 * NODE01 is a stable identity; compute is replaceable behind approved adapters.
 * No provider exposes arbitrary host-shell execution through this contract.
 */
export function createComputeRegistry() {
  const providers = new Map();

  providers.set('local', {
    id: 'local',
    kind: 'local',
    status: 'available',
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    capabilities: ['workspace', 'files', 'build', 'test'],
    execution: 'in-process-adapter'
  });

  const configured = String(process.env.NODE01_COMPUTE_PROVIDERS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const id of configured) {
    if (providers.has(id)) continue;
    providers.set(id, {
      id,
      kind: 'adapter',
      status: 'configured',
      capabilities: ['workspace', 'files', 'build', 'test', 'run', 'deploy', 'provision'],
      execution: 'approved-provider-adapter'
    });
  }

  return {
    list() {
      return [...providers.values()].map((provider) => ({ ...provider, capabilities: [...provider.capabilities] }));
    },
    get(id) {
      return providers.get(id) || null;
    },
    select(required = []) {
      const needs = new Set(required);
      return this.list().find((provider) => [...needs].every((capability) => provider.capabilities.includes(capability))) || null;
    }
  };
}
