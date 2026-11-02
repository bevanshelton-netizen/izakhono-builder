export type PlaybackResolutionRequest = {
  tenantId: string;
  assetId: string;
  profile?: "VOD" | "LINEAR";
  identityId: string;
  entitlementId: string;
};

export type PlaybackResolution = {
  tenantId: string;
  assetId: string;
  profile: "VOD" | "LINEAR";
  playlistUri: string;
  authorizationRequired: true;
  drmPolicyRef?: string;
  evidence: string[];
};

export type PlaybackResolutionAdapter = {
  resolve(request: PlaybackResolutionRequest): Promise<PlaybackResolution>;
};

/**
 * Reference-only playback resolver. It proves the control-plane boundary
 * without issuing real CDN URLs, DRM licenses, or origin credentials.
 */
export const referencePlaybackResolutionAdapter: PlaybackResolutionAdapter = {
  async resolve(request) {
    if (!request.tenantId || !request.assetId || !request.identityId || !request.entitlementId) {
      throw new Error("tenant, asset, identity and entitlement are required");
    }

    const profile = request.profile ?? "VOD";

    return {
      tenantId: request.tenantId,
      assetId: request.assetId,
      profile,
      playlistUri: `ref://hls/${request.tenantId}/${request.assetId}/master.m3u8`,
      authorizationRequired: true,
      drmPolicyRef: `ref://drm/${request.tenantId}/stream-standard-v1`,
      evidence: [
        "identity-validated",
        "entitlement-validated",
        "rights-window-validated",
        "device-policy-validated",
        "hls-output-resolved",
      ],
    };
  },
};
