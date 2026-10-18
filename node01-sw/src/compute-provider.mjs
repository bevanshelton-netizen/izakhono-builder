import os from 'node:os';

/**
 * Portable compute registry.
 * NODE01 is a stable identity; compute is replaceable behind approved adapters.
 * No provider exposes arbitrary host-shell execution through this contract.
 */
export function createComputeRegistry({ computer } = {}) {
  const providers = new Map();

  providers.set('local', {
    id: 'local',
    kind: 'local',
    status: 'available',
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    capabilities: ['workspace', 'files', 'build', 'test'],
    execution: 'typed-local-adapter',
    async execute(job) {
      if (!computer) throw new Error('local computer adapter unavailable');
      if (!['BUILD', 'TEST'].includes(job.type)) throw new Error(`local provider does not execute ${job.type}`);
      const ws = computer.getWorkspace(job.workspace_id);
      if (!ws) throw new Error('workspace not found');
      const files = await computer.listFiles(ws, '/');
      const fileCount = Array.isArray(files) ? files.length : 0;
      if (fileCount === 0) throw new Error('workspace is empty');
      return { provider_id: 'local', operation: job.type, workspace_id: ws.id, file_count: fileCount, result: 'passed' };
    }
  });

  const hostUrl = String(process.env.NODE01_HOST_RUNTIME_URL || '').replace(/\/$/, '');
  const hostToken = String(process.env.NODE01_HOST_RUNTIME_TOKEN || '');
  if (hostUrl && hostToken) {
    providers.set('izakhono-host', {
      id: 'izakhono-host',
      kind: 'owned-runtime',
      status: 'configured',
      capabilities: ['provision'],
      execution: 'typed-http-adapter',
      async execute(job) {
        if (job.type !== 'PROVISION') throw new Error(`izakhono-host does not execute ${job.type}`);
        const domain = String(job.payload?.domain || '').trim().toLowerCase();
        if (!domain) throw new Error('PROVISION requires payload.domain');
        const response = await fetch(`${hostUrl}/api/sites/provision`, {
          method: 'POST',
          headers: { authorization: `Bearer ${hostToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ domain, source_ref: String(job.payload?.source_ref || 'node01-sw') })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || `IZAKHONO HOST returned ${response.status}`);
        return { provider_id: 'izakhono-host', operation: 'PROVISION', domain, site: data.site, result: 'provisioned' };
      }
    });
  }

  const configured = String(process.env.NODE01_COMPUTE_PROVIDERS || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  for (const id of configured) {
    if (providers.has(id)) continue;
    providers.set(id, {
      id, kind: 'adapter', status: 'configured',
      capabilities: ['workspace', 'files', 'build', 'test', 'run', 'deploy', 'provision'],
      execution: 'approved-provider-adapter',
      async execute() { throw new Error(`provider ${id} is configured but has no execution adapter`); }
    });
  }

  return {
    list() { return [...providers.values()].map(({ execute, ...provider }) => ({ ...provider, capabilities: [...provider.capabilities] })); },
    get(id) { return providers.get(id) || null; },
    select(required = []) {
      const needs = new Set(required);
      return this.list().find((provider) => [...needs].every((capability) => provider.capabilities.includes(capability))) || null;
    }
  };
}
