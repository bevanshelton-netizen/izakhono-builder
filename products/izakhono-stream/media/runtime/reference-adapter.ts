import type { MediaAdapter, MediaJob } from "./media-runtime";

/**
 * Deterministic adapter for contract/integration testing.
 * It creates synthetic URIs only; it does not process or publish media.
 */
export const referenceAdapter: MediaAdapter = {
  async verifyUpload(job: MediaJob) {
    return Boolean(job.sourceUri && job.sourceUri.startsWith("ref://"));
  },
  async transcode(job: MediaJob) {
    return [
      `ref://${job.tenantId}/${job.assetId}/video/1080p`,
      `ref://${job.tenantId}/${job.assetId}/video/720p`,
      `ref://${job.tenantId}/${job.assetId}/video/480p`,
    ];
  },
  async package(job: MediaJob) {
    return `ref://${job.tenantId}/${job.assetId}/package/hls-master.m3u8`;
  },
  async protect(job: MediaJob, packageUri: string) {
    return `${packageUri}?protection=reference&asset=${job.assetId}`;
  },
  async publish(job: MediaJob) {
    return `ref://${job.tenantId}/${job.assetId}/published`;
  },
};
