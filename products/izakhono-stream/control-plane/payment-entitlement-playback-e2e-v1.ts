import type { EntitlementLookup, EntitlementRecord } from './entitlement-authorizer-v1';
import { authorizePlaybackSession, type PlaybackControlRequest } from './playback-control-v1';

export type PaymentStatus = 'PAID' | 'REFUNDED' | 'CANCELLED' | 'FAILED';

export interface SandboxPaymentEvent {
  eventId: string;
  tenantId: string;
  provider: 'IKHOKHA';
  transactionId: string;
  userId: string;
  productId: string;
  status: PaymentStatus;
  occurredAt: string;
}

export interface E2EEntitlementStore extends EntitlementLookup {
  applyPayment(event: SandboxPaymentEvent): Promise<EntitlementRecord | null>;
  countByEvent(eventId: string): Promise<number>;
}

export interface E2EPlaybackDependencies {
  entitlements: E2EEntitlementStore;
  resolvePlayback: (request: {
    tenantId: string;
    assetId: string;
    identityId: string;
    entitlementId: string;
    device: PlaybackControlRequest['device'];
  }) => Promise<{ manifestUrl: string; playbackToken: string; drmLicenseUrl?: string }>;
  deviceAllowed: (device: PlaybackControlRequest['device']) => boolean;
}

export async function runPaymentEntitlementPlaybackAcceptance(
  event: SandboxPaymentEvent,
  request: PlaybackControlRequest,
  deps: E2EPlaybackDependencies,
) {
  if (event.provider !== 'IKHOKHA') throw new Error('UNSUPPORTED_PROVIDER');
  if (event.tenantId !== request.tenantId || event.userId !== request.userId) {
    throw new Error('TENANT_OR_IDENTITY_MISMATCH');
  }

  const entitlement = await deps.entitlements.applyPayment(event);
  const eventCount = await deps.entitlements.countByEvent(event.eventId);

  const playback = await authorizePlaybackSession(request, {
    entitlements: deps.entitlements,
    resolvePlayback: deps.resolvePlayback,
    deviceAllowed: deps.deviceAllowed,
  });

  return {
    payment: { eventId: event.eventId, status: event.status },
    entitlement: entitlement
      ? { entitlementId: entitlement.entitlementId, status: entitlement.status }
      : null,
    replay: { eventId: event.eventId, appliedCount: eventCount },
    playback: {
      decision: playback.decision,
      sessionId: playback.sessionId,
      expiresAt: playback.expiresAt,
      manifestUrl: playback.playback?.manifestUrl,
      tokenIssued: Boolean(playback.playback?.token),
      drmLicenseUrl: playback.playback?.drmLicenseUrl,
      reason: playback.audit.reason,
    },
  };
}

export function assertPaymentEntitlementPlaybackAcceptance(result: Awaited<ReturnType<typeof runPaymentEntitlementPlaybackAcceptance>>) {
  if (result.payment.status !== 'PAID') throw new Error('PAYMENT_NOT_PAID');
  if (!result.entitlement || result.entitlement.status !== 'ACTIVE') throw new Error('ENTITLEMENT_NOT_ACTIVE');
  if (result.replay.appliedCount !== 1) throw new Error('REPLAY_NOT_IDEMPOTENT');
  if (result.playback.decision !== 'AUTHORIZED') throw new Error('PLAYBACK_NOT_AUTHORIZED');
  if (!result.playback.manifestUrl?.endsWith('master.m3u8')) throw new Error('HLS_MANIFEST_INVALID');
  if (!result.playback.tokenIssued) throw new Error('PLAYBACK_TOKEN_MISSING');
  return true;
}
