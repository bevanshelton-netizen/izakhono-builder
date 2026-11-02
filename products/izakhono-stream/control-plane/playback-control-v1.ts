import { authorizeEntitlement, type EntitlementLookup } from './entitlement-authorizer-v1';

export type PlaybackDecision = 'AUTHORIZED' | 'DENIED';

export interface PlaybackControlRequest {
  tenantId: string;
  assetId: string;
  userId: string;
  planId?: string;
  device: { id: string; platform: string; drm?: 'WIDEVINE' | 'FAIRPLAY' | 'PLAYREADY' | 'NONE' };
  now?: string;
}

export interface PlaybackControlContext {
  entitlement: boolean;
  rightsStart?: string;
  rightsEnd?: string;
  deviceAllowed: boolean;
  hlsManifestUrl?: string;
  drmLicenseUrl?: string;
  playbackToken?: string;
}

export interface PlaybackControlResult {
  decision: PlaybackDecision;
  sessionId: string;
  expiresAt: string;
  playback?: { manifestUrl: string; token: string; drmLicenseUrl?: string };
  audit: { tenantId: string; assetId: string; userId: string; decision: PlaybackDecision; reason?: string };
}

export function authorizePlayback(req: PlaybackControlRequest, ctx: PlaybackControlContext): PlaybackControlResult {
  const now = new Date(req.now ?? new Date().toISOString());
  const sessionId = `ps_${req.tenantId}_${req.userId}_${req.assetId}_${now.getTime()}`;
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  if (!ctx.entitlement) return deny(req, sessionId, expiresAt, 'ENTITLEMENT_REQUIRED');
  if (!ctx.deviceAllowed) return deny(req, sessionId, expiresAt, 'DEVICE_POLICY_DENIED');
  if (ctx.rightsStart && now < new Date(ctx.rightsStart)) return deny(req, sessionId, expiresAt, 'RIGHTS_NOT_STARTED');
  if (ctx.rightsEnd && now >= new Date(ctx.rightsEnd)) return deny(req, sessionId, expiresAt, 'RIGHTS_EXPIRED');
  if (!ctx.hlsManifestUrl || !ctx.playbackToken) return deny(req, sessionId, expiresAt, 'PLAYBACK_RESOLUTION_UNAVAILABLE');

  return {
    decision: 'AUTHORIZED', sessionId, expiresAt,
    playback: { manifestUrl: ctx.hlsManifestUrl, token: ctx.playbackToken, ...(ctx.drmLicenseUrl ? { drmLicenseUrl: ctx.drmLicenseUrl } : {}) },
    audit: { tenantId: req.tenantId, assetId: req.assetId, userId: req.userId, decision: 'AUTHORIZED' }
  };
}

export interface EntitlementPlaybackResolution {
  manifestUrl: string;
  playbackToken: string;
  drmLicenseUrl?: string;
}

export interface EntitlementPlaybackDependencies {
  entitlements: EntitlementLookup;
  resolvePlayback: (request: {
    tenantId: string;
    assetId: string;
    identityId: string;
    entitlementId: string;
    device: PlaybackControlRequest['device'];
  }) => Promise<EntitlementPlaybackResolution>;
  deviceAllowed: (device: PlaybackControlRequest['device']) => boolean;
}

/**
 * Authoritative playback-session gate. A media grant is resolved only after
 * the current entitlement, rights window and device policy have all passed.
 */
export async function authorizePlaybackSession(
  req: PlaybackControlRequest,
  deps: EntitlementPlaybackDependencies
): Promise<PlaybackControlResult> {
  const now = req.now ?? new Date().toISOString();
  const at = new Date(now);
  const sessionId = `ps_${req.tenantId}_${req.userId}_${req.assetId}_${at.getTime()}`;
  const expiresAt = new Date(at.getTime() + 5 * 60 * 1000).toISOString();

  if (!deps.deviceAllowed(req.device)) return deny(req, sessionId, expiresAt, 'DEVICE_POLICY_DENIED');

  const entitlement = await deps.entitlements.find(req.tenantId, req.userId, req.planId ?? req.assetId);
  const decision = await authorizeEntitlement(
    { find: async () => entitlement },
    req.tenantId,
    req.userId,
    req.planId ?? req.assetId,
    now
  );

  if (!decision.allowed || !decision.entitlementId) {
    return deny(req, sessionId, expiresAt, decision.reason ?? 'ENTITLEMENT_REQUIRED');
  }

  const resolved = await deps.resolvePlayback({
    tenantId: req.tenantId,
    assetId: req.assetId,
    identityId: req.userId,
    entitlementId: decision.entitlementId,
    device: req.device,
  });

  if (!resolved.manifestUrl || !resolved.playbackToken) {
    return deny(req, sessionId, expiresAt, 'PLAYBACK_RESOLUTION_UNAVAILABLE');
  }

  return {
    decision: 'AUTHORIZED',
    sessionId,
    expiresAt,
    playback: {
      manifestUrl: resolved.manifestUrl,
      token: resolved.playbackToken,
      ...(resolved.drmLicenseUrl ? { drmLicenseUrl: resolved.drmLicenseUrl } : {})
    },
    audit: { tenantId: req.tenantId, assetId: req.assetId, userId: req.userId, decision: 'AUTHORIZED' }
  };
}

function deny(req: PlaybackControlRequest, sessionId: string, expiresAt: string, reason: string): PlaybackControlResult {
  return { decision: 'DENIED', sessionId, expiresAt, audit: { tenantId: req.tenantId, assetId: req.assetId, userId: req.userId, decision: 'DENIED', reason } };
}
