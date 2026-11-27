import test from 'node:test';
import assert from 'node:assert/strict';
import { createOciWorkloadPolicy } from './oci-workload-policy.mjs';

const digest = 'sha256:' + 'a'.repeat(64);
const policy = () => createOciWorkloadPolicy({
  approvedWorkloadClasses: ['izakhono-nav'],
  allowedImageDigests: [digest],
  allowedNetworkProfiles: ['nav-private-egress'],
  limits: { maxCpuMillicores: 2000, maxMemoryMiB: 4096, maxDiskMiB: 20000 },
  verifyProvenance: async ({ digest: candidate }) => candidate === digest
});
const request = () => ({
  workloadClass: 'izakhono-nav',
  imageDigest: digest,
  provenance: { issuer: 'ci-test', signature: 'test-signature' },
  resources: { cpuMillicores: 1000, memoryMiB: 2048, diskMiB: 10000, networkProfile: 'nav-private-egress' },
  isolation: { rootless: true, privileged: false, hostNetwork: false, hostPid: false, hostIpc: false, hostPaths: [], dockerSocket: false },
  persistentVolume: { volumeId: 'nav-data-01', mountPath: '/var/lib/izakhono/workload-data', retentionPolicy: 'retain' }
});

test('admits only approved immutable releases with verified provenance and bounded isolation', async () => {
  const admitted = await policy().authorize(request());
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.imageDigest, digest);
  assert.equal(admitted.isolation.rootless, true);
  assert.equal(admitted.persistentVolume.retentionPolicy, 'retain');
  assert.ok(Object.isFrozen(admitted));
});

test('fails closed for unapproved classes, tags, digests and invalid provenance', async () => {
  const p = policy();
  await assert.rejects(p.authorize({ ...request(), workloadClass: 'arbitrary' }), /CLASS_NOT_APPROVED/);
  await assert.rejects(p.authorize({ ...request(), imageDigest: 'latest' }), /DIGEST_INVALID/);
  await assert.rejects(p.authorize({ ...request(), imageDigest: 'sha256:' + 'b'.repeat(64) }), /NOT_ALLOWLISTED/);
  const bad = createOciWorkloadPolicy({
    approvedWorkloadClasses: ['izakhono-nav'], allowedImageDigests: [digest],
    allowedNetworkProfiles: ['nav-private-egress'],
    limits: { maxCpuMillicores: 2000, maxMemoryMiB: 4096, maxDiskMiB: 20000 },
    verifyProvenance: async () => false
  });
  await assert.rejects(bad.authorize(request()), /PROVENANCE_NOT_VERIFIED/);
});

test('rejects browser-controlled commands, provider config and unknown request fields', async () => {
  const p = policy();
  await assert.rejects(p.authorize({ ...request(), command: 'sh' }), /FIELD_NOT_ALLOWED:command/);
  await assert.rejects(p.authorize({ ...request(), providerUrl: 'https://example.invalid' }), /FIELD_NOT_ALLOWED:providerUrl/);
});

test('rejects privileged, host namespace, host path and Docker socket access', async () => {
  const p = policy();
  for (const patch of [
    { privileged: true }, { hostNetwork: true }, { hostPid: true }, { hostIpc: true },
    { hostPaths: ['/'] }, { dockerSocket: true }, { rootless: false }
  ]) {
    await assert.rejects(p.authorize({ ...request(), isolation: { ...request().isolation, ...patch } }), /ISOLATION_REQUIREMENTS_NOT_MET/);
  }
});

test('enforces resource ceilings, approved network and persistent volume retention', async () => {
  const p = policy();
  await assert.rejects(p.authorize({ ...request(), resources: { ...request().resources, cpuMillicores: 2001 } }), /CPU_OUT_OF_RANGE/);
  await assert.rejects(p.authorize({ ...request(), resources: { ...request().resources, networkProfile: 'public-anywhere' } }), /NETWORK_PROFILE_NOT_APPROVED/);
  await assert.rejects(p.authorize({ ...request(), persistentVolume: { ...request().persistentVolume, mountPath: '/host' } }), /VOLUME_MOUNT_NOT_APPROVED/);
  await assert.rejects(p.authorize({ ...request(), persistentVolume: { ...request().persistentVolume, retentionPolicy: 'delete-now' } }), /VOLUME_RETENTION_INVALID/);
});

test('requires an explicit provenance verifier and non-empty allow-lists', () => {
  assert.throws(() => createOciWorkloadPolicy({}), /ALLOWLISTS_REQUIRED/);
  assert.throws(() => createOciWorkloadPolicy({
    approvedWorkloadClasses: ['izakhono-nav'], allowedImageDigests: [digest],
    allowedNetworkProfiles: ['nav-private-egress'], limits: {}
  }), /PROVENANCE_VERIFIER_REQUIRED/);
});
