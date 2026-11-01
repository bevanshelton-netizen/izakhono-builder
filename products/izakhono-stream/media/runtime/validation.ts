import type { MediaJob } from "./media-runtime";

export interface ValidationResult {
  ok: boolean;
  checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }>;
}

/** Contract-level gate. Production validation must add real media probes. */
export function validatePlayableJob(job: MediaJob): ValidationResult {
  const checks = [
    {
      name: "terminal-state",
      status: job.state === "PLAYABLE" ? "PASS" : "FAIL",
      detail: `state=${job.state}`,
    },
    {
      name: "tenant-isolation",
      status: job.tenantId.length > 0 ? "PASS" : "FAIL",
      detail: "tenant identifier present",
    },
    {
      name: "asset-identity",
      status: job.assetId.length > 0 ? "PASS" : "FAIL",
      detail: "asset identifier present",
    },
    {
      name: "evidence",
      status: job.evidence.length > 0 ? "PASS" : "FAIL",
      detail: `${job.evidence.length} evidence record(s) attached`,
    },
  ] as const;

  return { ok: checks.every((check) => check.status === "PASS"), checks: [...checks] };
}
