const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const REQUEST_KEYS = new Set(['workloadClass', 'imageDigest', 'provenance', 'resources', 'isolation', 'persistentVolume']);
const RESOURCE_KEYS = new Set(['cpuMillicores', 'memoryMiB', 'diskMiB', 'networkProfile']);
const ISOLATION_KEYS = new Set(['rootless', 'privileged', 'hostNetwork', 'hostPid', 'hostIpc', 'hostPaths', 'dockerSocket']);
const VOLUME_KEYS = new Set(['volumeId', 'mountPath', 'retentionPolicy']);

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + '_INVALID');
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(label + '_FIELD_NOT_ALLOWED:' + key);
}

function boundedInteger(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(label + '_OUT_OF_RANGE');
  return value;
}

/** Fail-closed admission policy only; this module never launches containers or calls a provider. */
export function createOciWorkloadPolicy(config) {
  if (!config || typeof config !== 'object') throw new TypeError('OCI_POLICY_CONFIG_REQUIRED');
  const classes = new Set(config.approvedWorkloadClasses || []);
  const digests = new Set(config.allowedImageDigests || []);
  const networks = new Set(config.allowedNetworkProfiles || []);
  const limits = config.limits || {};
  if (!classes.size || !digests.size || !networks.size) throw new Error('OCI_POLICY_ALLOWLISTS_REQUIRED');
  for (const digest of digests) if (typeof digest !== 'string' || !DIGEST.test(digest)) throw new Error('OCI_POLICY_DIGEST_INVALID');
  if (typeof config.verifyProvenance !== 'function') throw new Error('OCI_PROVENANCE_VERIFIER_REQUIRED');

  return Object.freeze({
    async authorize(request) {
      exactKeys(request, REQUEST_KEYS, 'OCI_REQUEST');
      if (!classes.has(request.workloadClass)) throw new Error('OCI_WORKLOAD_CLASS_NOT_APPROVED');
      if (typeof request.imageDigest !== 'string' || !DIGEST.test(request.imageDigest)) throw new Error('OCI_IMAGE_DIGEST_INVALID');
      if (!digests.has(request.imageDigest)) throw new Error('OCI_IMAGE_DIGEST_NOT_ALLOWLISTED');
      if (!request.provenance || typeof request.provenance !== 'object' || Array.isArray(request.provenance)) throw new Error('OCI_PROVENANCE_REQUIRED');
      if (await config.verifyProvenance({ digest: request.imageDigest, provenance: request.provenance }) !== true) throw new Error('OCI_PROVENANCE_NOT_VERIFIED');

      exactKeys(request.resources, RESOURCE_KEYS, 'OCI_RESOURCES');
      const cpuMillicores = boundedInteger(request.resources.cpuMillicores, 1, limits.maxCpuMillicores, 'OCI_CPU');
      const memoryMiB = boundedInteger(request.resources.memoryMiB, 1, limits.maxMemoryMiB, 'OCI_MEMORY');
      const diskMiB = boundedInteger(request.resources.diskMiB, 1, limits.maxDiskMiB, 'OCI_DISK');
      if (!networks.has(request.resources.networkProfile)) throw new Error('OCI_NETWORK_PROFILE_NOT_APPROVED');

      exactKeys(request.isolation, ISOLATION_KEYS, 'OCI_ISOLATION');
      if (request.isolation.rootless !== true || request.isolation.privileged !== false ||
          request.isolation.hostNetwork !== false || request.isolation.hostPid !== false ||
          request.isolation.hostIpc !== false || request.isolation.dockerSocket !== false ||
          !Array.isArray(request.isolation.hostPaths) || request.isolation.hostPaths.length !== 0) {
        throw new Error('OCI_ISOLATION_REQUIREMENTS_NOT_MET');
      }

      exactKeys(request.persistentVolume, VOLUME_KEYS, 'OCI_PERSISTENT_VOLUME');
      if (typeof request.persistentVolume.volumeId !== 'string' || !ID.test(request.persistentVolume.volumeId)) throw new Error('OCI_VOLUME_ID_INVALID');
      if (request.persistentVolume.mountPath !== '/var/lib/izakhono/workload-data') throw new Error('OCI_VOLUME_MOUNT_NOT_APPROVED');
      if (!['retain', 'owner-approved-delete'].includes(request.persistentVolume.retentionPolicy)) throw new Error('OCI_VOLUME_RETENTION_INVALID');

      return Object.freeze({
        admitted: true,
        workloadClass: request.workloadClass,
        imageDigest: request.imageDigest,
        resources: Object.freeze({ cpuMillicores, memoryMiB, diskMiB, networkProfile: request.resources.networkProfile }),
        isolation: Object.freeze({ rootless: true, privileged: false, hostNetwork: false, hostPid: false, hostIpc: false, dockerSocket: false }),
        persistentVolume: Object.freeze({ volumeId: request.persistentVolume.volumeId, mountPath: request.persistentVolume.mountPath, retentionPolicy: request.persistentVolume.retentionPolicy })
      });
    }
  });
}
