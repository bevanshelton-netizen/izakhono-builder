/**
 * IZAKHONO STREAM Media Runtime V1
 * Provider-neutral orchestration boundary.
 * This module models the runtime state machine; it does not claim to perform
 * production transcoding, DRM, CDN delivery, or storage by itself.
 */

export type MediaState =
  | "RECEIVED"
  | "UPLOAD_VERIFIED"
  | "TRANSCODE_QUEUED"
  | "TRANSCODED"
  | "PACKAGED"
  | "PROTECTED"
  | "PUBLISHED"
  | "PLAYABLE"
  | "BLOCKED";

export interface MediaJob {
  id: string;
  tenantId: string;
  assetId: string;
  sourceUri: string;
  state: MediaState;
  createdAt: string;
  updatedAt: string;
  evidence: string[];
  error?: string;
}

export interface MediaAdapter {
  verifyUpload(job: MediaJob): Promise<boolean>;
  transcode(job: MediaJob): Promise<string[]>;
  package(job: MediaJob, renditions: string[]): Promise<string>;
  protect(job: MediaJob, packageUri: string): Promise<string>;
  publish(job: MediaJob, protectedUri: string): Promise<string>;
}

const transitions: Record<MediaState, MediaState[]> = {
  RECEIVED: ["UPLOAD_VERIFIED", "BLOCKED"],
  UPLOAD_VERIFIED: ["TRANSCODE_QUEUED", "BLOCKED"],
  TRANSCODE_QUEUED: ["TRANSCODED", "BLOCKED"],
  TRANSCODED: ["PACKAGED", "BLOCKED"],
  PACKAGED: ["PROTECTED", "BLOCKED"],
  PROTECTED: ["PUBLISHED", "BLOCKED"],
  PUBLISHED: ["PLAYABLE", "BLOCKED"],
  PLAYABLE: [],
  BLOCKED: [],
};

export function transition(job: MediaJob, next: MediaState, evidence?: string): MediaJob {
  if (!transitions[job.state].includes(next)) {
    throw new Error(`Invalid media transition: ${job.state} -> ${next}`);
  }
  return {
    ...job,
    state: next,
    updatedAt: new Date().toISOString(),
    evidence: evidence ? [...job.evidence, evidence] : job.evidence,
  };
}

export async function runMediaJob(job: MediaJob, adapter: MediaAdapter): Promise<MediaJob> {
  try {
    if (!(await adapter.verifyUpload(job))) {
      return transition(job, "BLOCKED", "upload verification failed");
    }
    job = transition(job, "UPLOAD_VERIFIED", "source verified");
    job = transition(job, "TRANSCODE_QUEUED", "transcode queued");
    const renditions = await adapter.transcode(job);
    job = transition(job, "TRANSCODED", `${renditions.length} rendition(s) produced`);
    const packageUri = await adapter.package(job, renditions);
    job = transition(job, "PACKAGED", `package created: ${packageUri}`);
    const protectedUri = await adapter.protect(job, packageUri);
    job = transition(job, "PROTECTED", `content protection applied: ${protectedUri}`);
    await adapter.publish(job, protectedUri);
    job = transition(job, "PUBLISHED", "published to configured origin/edge adapter");
    return transition(job, "PLAYABLE", "playback validation may now be executed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown media runtime failure";
    return {
      ...job,
      state: "BLOCKED",
      updatedAt: new Date().toISOString(),
      error: message,
      evidence: [...job.evidence, `blocked: ${message}`],
    };
  }
}
