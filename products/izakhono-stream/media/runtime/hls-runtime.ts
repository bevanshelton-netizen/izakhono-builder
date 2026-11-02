/**
 * IZAKHONO STREAM HLS Runtime Contract Adapter V1.
 * Produces a deterministic HLS output model from Media Runtime renditions.
 * It does not perform real transcoding, packaging, encryption, or CDN upload.
 */

export type HlsProfile = "VOD" | "LINEAR";

export interface HlsRendition {
  id: string;
  uri: string;
  bandwidth: number;
  width: number;
  height: number;
  codecs: string;
}

export interface HlsOutput {
  profile: HlsProfile;
  masterPlaylistUri: string;
  renditions: HlsRendition[];
  authorizationRequired: boolean;
  drmPolicyRef?: string;
  evidence: string[];
}

export interface HlsRuntimeAdapter {
  buildOutput(input: {
    tenantId: string;
    assetId: string;
    renditions: string[];
    profile: HlsProfile;
    drmPolicyRef?: string;
  }): Promise<HlsOutput>;
}

export const referenceHlsAdapter: HlsRuntimeAdapter = {
  async buildOutput(input) {
    if (!input.tenantId || !input.assetId || input.renditions.length === 0) {
      throw new Error("HLS output requires tenant, asset and at least one rendition");
    }

    const base = `ref://hls/${input.tenantId}/${input.assetId}`;
    return {
      profile: input.profile,
      masterPlaylistUri: `${base}/master.m3u8`,
      renditions: input.renditions.map((uri, index) => ({
        id: `rendition-${index + 1}`,
        uri,
        bandwidth: 500000 + index * 500000,
        width: index === 0 ? 640 : 1280,
        height: index === 0 ? 360 : 720,
        codecs: "avc1.4d401f,mp4a.40.2",
      })),
      authorizationRequired: true,
      drmPolicyRef: input.drmPolicyRef,
      evidence: [
        "reference HLS output generated",
        `profile=${input.profile}`,
        "master playlist contract satisfied",
      ],
    };
  },
};
