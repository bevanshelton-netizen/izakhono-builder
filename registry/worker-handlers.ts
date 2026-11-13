import type { SupervisorWorkerHandler, SupervisorWorkerHandlers, WorkerResult } from "./worker-executor";

/**
 * A deliberately narrow, read-only verification boundary.
 * Implementations may inspect a checked-out repository and run approved
 * validation commands, but this worker itself cannot choose commands,
 * write files, publish artifacts, or deploy.
 */
export type BuildVerificationRequest = {
  jobId: string;
  idempotencyKey: string;
  attempt: number;
  repository: string;
  revision: string;
  checks: readonly ("typecheck" | "unit-tests" | "manifest")[];
};

export type BuildVerificationReport = {
  summary: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  revision: string;
};

export type ReadOnlyBuildVerifier = (
  request: BuildVerificationRequest,
) => Promise<BuildVerificationReport>;

const allowedChecks = new Set(["typecheck", "unit-tests", "manifest"]);

function parseBuildInput(input: unknown): {
  repository: string;
  revision: string;
  checks: Array<"typecheck" | "unit-tests" | "manifest">;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("build_input_must_be_an_object");
  }
  const value = input as Record<string, unknown>;
  if (typeof value.repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository)) {
    throw new Error("build_repository_must_be_owner_repo");
  }
  if (typeof value.revision !== "string" || !/^[a-f0-9]{7,64}$/i.test(value.revision)) {
    throw new Error("build_revision_must_be_a_commit_sha");
  }
  if (!Array.isArray(value.checks) || value.checks.length === 0 || value.checks.length > 3) {
    throw new Error("build_checks_must_be_a_non_empty_allowlist");
  }
  const checks = value.checks.map((check) => {
    if (typeof check !== "string" || !allowedChecks.has(check)) {
      throw new Error("build_check_not_allowlisted");
    }
    return check as "typecheck" | "unit-tests" | "manifest";
  });
  if (new Set(checks).size !== checks.length) throw new Error("duplicate_build_check");
  return { repository: value.repository, revision: value.revision, checks };
}

export function createBuildWorkerHandler(verifier: ReadOnlyBuildVerifier): SupervisorWorkerHandler {
  return async (job, context): Promise<WorkerResult> => {
    if (job.workerId !== "build-worker") throw new Error("worker_ownership_mismatch");
    const input = parseBuildInput(job.input);
    const report = await verifier({
      jobId: job.id,
      idempotencyKey: context.idempotencyKey,
      attempt: context.attempt,
      ...input,
    });
    if (!report || report.revision.toLowerCase() !== input.revision.toLowerCase()) {
      throw new Error("verification_revision_mismatch");
    }
    const returned = Array.isArray(report.checks) ? report.checks : [];
    const expected = new Set(input.checks);
    const names = new Set<string>();
    for (const check of returned) {
      if (!check || typeof check.name !== "string" || !expected.has(check.name as typeof input.checks[number]) ||
          typeof check.passed !== "boolean" || typeof check.detail !== "string" || names.has(check.name)) {
        throw new Error("invalid_build_verification_report");
      }
      names.add(check.name);
    }
    if (names.size !== expected.size || input.checks.some((name) => !names.has(name))) {
      throw new Error("build_verification_report_incomplete");
    }
    return {
      summary: report.summary,
      checks: returned,
      artifact: { repository: input.repository, revision: input.revision, verificationOnly: true },
    };
  };
}

export function createWorkerHandlers(verifier: ReadOnlyBuildVerifier): SupervisorWorkerHandlers {
  return { "build-worker": createBuildWorkerHandler(verifier) };
}
