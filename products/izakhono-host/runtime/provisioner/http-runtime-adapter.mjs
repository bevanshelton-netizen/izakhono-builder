import { createProviderHttpClient } from './provider-http-client.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function requireId(value, name) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(name + '_INVALID');
  return value;
}

export function createHttpRuntimeAdapter(config) {
  const client = createProviderHttpClient(config);
  return Object.freeze({
    async resolveTarget({ runtimeTargetId, signal }) {
      const id = requireId(runtimeTargetId, 'RUNTIME_TARGET_ID');
      const result = await client.request('GET', '/v1/runtime-targets/' + encodeURIComponent(id), undefined, signal);
      if (result.runtimeTargetId !== id || result.approved !== true || result.enabled !== true) return null;
      const providerTargetRef = requireId(result.providerTargetRef, 'PROVIDER_TARGET_REF');
      return { id, providerTargetRef };
    },

    async provision({ target, workload, signal }) {
      const result = await client.request('POST', '/v1/runtime-targets/' + encodeURIComponent(target.id) + '/workloads', {
        workloadId: workload.workload_id,
        workloadClass: workload.workload_class,
        logicalNodeId: workload.logical_node_id,
        releaseDigest: workload.release_digest,
        healthPath: workload.health_path,
        internalPort: workload.internal_port,
        providerTargetRef: target.providerTargetRef
      }, signal);
      return { id: requireId(result.resourceId, 'RUNTIME_RESOURCE_ID') };
    },

    async deploy({ target, resource, releaseDigest, workload, signal }) {
      return client.request('POST', '/v1/runtime-targets/' + encodeURIComponent(target.id) + '/workloads/' + encodeURIComponent(requireId(resource.id, 'RUNTIME_RESOURCE_ID')) + '/release', {
        releaseDigest,
        workloadId: workload.workload_id
      }, signal);
    },

    async inspect({ target, resource, signal }) {
      const result = await client.request('GET', '/v1/runtime-targets/' + encodeURIComponent(target.id) + '/workloads/' + encodeURIComponent(requireId(resource.id, 'RUNTIME_RESOURCE_ID')), undefined, signal);
      return { healthy: result.healthy === true, releaseDigest: String(result.releaseDigest || '').toLowerCase() };
    },

    async stop({ target, resource, signal }) {
      return client.request('POST', '/v1/runtime-targets/' + encodeURIComponent(target.id) + '/workloads/' + encodeURIComponent(requireId(resource.id, 'RUNTIME_RESOURCE_ID')) + '/stop', {}, signal);
    },

    async destroy({ target, resource, signal }) {
      return client.request('POST', '/v1/runtime-targets/' + encodeURIComponent(target.id) + '/workloads/' + encodeURIComponent(requireId(resource.id, 'RUNTIME_RESOURCE_ID')) + '/destroy', { preservePersistentData: true }, signal);
    },

    async backup({ target, resource, signal }) {
      const result = await client.request('POST', '/v1/runtime-targets/' + encodeURIComponent(target.id) + '/workloads/' + encodeURIComponent(requireId(resource.id, 'RUNTIME_RESOURCE_ID')) + '/backup', {}, signal);
      return {
        backupId: requireId(result.backupId, 'BACKUP_ID'),
        sha256: String(result.sha256 || '').toLowerCase(),
        bytes: Number(result.bytes)
      };
    },

    async restore({ target, resource, backupId, signal }) {
      return client.request('POST', '/v1/runtime-targets/' + encodeURIComponent(target.id) + '/workloads/' + encodeURIComponent(requireId(resource.id, 'RUNTIME_RESOURCE_ID')) + '/restore', {
        backupId: requireId(backupId, 'BACKUP_ID')
      }, signal);
    }
  });
}
