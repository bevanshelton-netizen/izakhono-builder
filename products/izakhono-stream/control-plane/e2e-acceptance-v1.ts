import { authorizePlaybackSession, type PlaybackControlRequest } from './playback-control-v1';
import type { EntitlementRecord } from './entitlement-authorizer-v1';

type Result = { id: string; pass: boolean; detail: string };

const now = '2026-11-02T15:00:00.000Z';
const base: PlaybackControlRequest = {
  tenantId: 'kora-network', assetId: 'asset-001', userId: 'user-001',
  device: { id: 'device-001', platform: 'WEB', drm: 'NONE' }, now
};

function entitlement(status: 'ACTIVE' | 'REVOKED', tenantId = 'kora-network', userId = 'user-001'): EntitlementRecord {
  return { entitlementId: 'ent-001', tenantId, userId, productId: 'kora-svod-monthly', status, startsAt: '2026-11-01T00:00:00.000Z' };
}

async function run(): Promise<Result[]> {
  const active = entitlement('ACTIVE');
  const revoked = entitlement('REVOKED');
  const store = (record: EntitlementRecord | null) => ({ find: async (tenantId: string, userId: string) =>
    record && record.tenantId === tenantId && record.userId === userId ? record : null });
  const resolve = async () => ({ manifestUrl: 'ref://hls/kora-network/asset-001/master.m3u8', playbackToken: 'short-lived-reference-token' });

  const authorized = await authorizePlaybackSession(base, { entitlements: store(active), resolvePlayback: resolve, deviceAllowed: () => true });
  const missing = await authorizePlaybackSession(base, { entitlements: store(null), resolvePlayback: resolve, deviceAllowed: () => true });
  const revokedResult = await authorizePlaybackSession(base, { entitlements: store(revoked), resolvePlayback: resolve, deviceAllowed: () => true });
  const wrongTenant = await authorizePlaybackSession({ ...base, tenantId: 'other-tenant' }, { entitlements: store(active), resolvePlayback: resolve, deviceAllowed: () => true });
  const wrongIdentity = await authorizePlaybackSession({ ...base, userId: 'other-user' }, { entitlements: store(active), resolvePlayback: resolve, deviceAllowed: () => true });
  const blockedDevice = await authorizePlaybackSession(base, { entitlements: store(active), resolvePlayback: resolve, deviceAllowed: () => false });
  const noMedia = await authorizePlaybackSession(base, { entitlements: store(active), resolvePlayback: async () => ({ manifestUrl: '', playbackToken: '' }), deviceAllowed: () => true });

  return [
    { id: 'E2E-006', pass: authorized.decision === 'AUTHORIZED' && !!authorized.playback?.manifestUrl && !!authorized.playback?.token, detail: 'authorized playback resolves HLS and short-lived token' },
    { id: 'E2E-007', pass: missing.decision === 'DENIED', detail: 'missing entitlement denied' },
    { id: 'E2E-003', pass: revokedResult.decision === 'DENIED', detail: 'revoked entitlement denied' },
    { id: 'E2E-008', pass: wrongTenant.decision === 'DENIED', detail: 'wrong tenant denied' },
    { id: 'E2E-009', pass: wrongIdentity.decision === 'DENIED', detail: 'wrong identity denied' },
    { id: 'E2E-011', pass: blockedDevice.decision === 'DENIED', detail: 'disallowed device denied' },
    { id: 'E2E-012', pass: noMedia.decision === 'DENIED', detail: 'missing media resolution denied' }
  ];
}

export async function runE2EAcceptance(): Promise<{ passed: number; failed: number; results: Result[] }> {
  const results = await run();
  return { passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
}
