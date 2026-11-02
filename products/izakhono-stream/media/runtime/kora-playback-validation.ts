import {
  referencePlaybackResolutionAdapter,
  type PlaybackResolutionRequest,
} from "./playback-resolution";

export type KoraPlaybackValidation = {
  valid: boolean;
  errors: string[];
  resolution?: Awaited<ReturnType<typeof referencePlaybackResolutionAdapter.resolve>>;
};

export async function validateKoraPlaybackResolution(
  request: PlaybackResolutionRequest,
): Promise<KoraPlaybackValidation> {
  const errors: string[] = [];

  if (request.tenantId !== "kora-network") {
    errors.push("KORA validation requires tenantId=kora-network");
  }
  if (!request.assetId) errors.push("assetId is required");
  if (!request.identityId) errors.push("identityId is required");
  if (!request.entitlementId) errors.push("entitlementId is required");

  if (errors.length) return { valid: false, errors };

  try {
    const resolution = await referencePlaybackResolutionAdapter.resolve(request);

    if (!resolution.playlistUri.endsWith("/master.m3u8")) {
      errors.push("resolved playlist must terminate in /master.m3u8");
    }
    if (!resolution.authorizationRequired) {
      errors.push("playback authorization must remain enabled");
    }
    if (!resolution.drmPolicyRef) {
      errors.push("DRM policy reference is required");
    }
    if (!resolution.evidence.includes("entitlement-validated")) {
      errors.push("entitlement validation evidence is required");
    }

    return { valid: errors.length === 0, errors, resolution };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "playback resolution failed"],
    };
  }
}
