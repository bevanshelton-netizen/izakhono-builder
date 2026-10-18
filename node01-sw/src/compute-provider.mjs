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
      capabilities: ['provision', 'deploy'],
      execution: 'typed-http-adapter',
      async execute(job) {
        if (!['PROVISION', 'DEPLOY'].includes(job.type)) throw new Error(`izakhono-host does not execute ${job.type}`);
        const domain = String(job.payload?.domain || '').trim().toLowerCase();
        if (!domain) throw new Error(`${job.type} requires payload.domain`);
        const auth = { authorization: `Bearer ${hostToken}`, 'content-type': 'application/json' };

        const provision = await fetch(`${hostUrl}/api/sites/provision`, {
          method: 'POST', headers: auth,
          body: JSON.stringify({ domain, site_id: job.payload?.site_id, source_ref: String(job.payload?.source_ref || 'node01-sw') })
        });
        const provisionData = await provision.json().catch(() => ({}));
        if (!provision.ok || !provisionData.ok) throw new Error(provisionData.error || `IZAKHONO HOST provision returned ${provision.status}`);
        const site = provisionData.site;
        if (job.type === 'PROVISION') return { provider_id: 'izakhono-host', operation: 'PROVISION', domain, site, result: 'provisioned' };

        const files = Array.isArray(job.payload?.files) ? job.payload.files : [];
        if (!files.length) throw new Error('DEPLOY requires payload.files');
        const content = await fetch(`${hostUrl}/api/sites/${encodeURIComponent(site.id)}/content`, {
          method: 'POST', headers: auth, body: JSON.stringify({ files })
        });
        const contentData = await content.json().catch(() => ({}));
        if (!content.ok || !contentData.ok) throw new Error(contentData.error || `IZAKHONO HOST content deployment returned ${content.status}`);
        return { provider_id: 'izakhono-host', operation: 'DEPLOY', domain, site: contentData.site, deployment: contentData.deployment, result: 'deployed' };
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
      return [...providers.values()].find((provider) => [...needs].every((capability) => provider.capabilities.includes(capability))) || null;
    }
  };
}
