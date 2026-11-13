import type { D1Database } from "./d1-store";
import { listSupervisorJobs, heartbeatSupervisorLease, finishSupervisorLease, type SupervisorLease, type SupervisorJob } from "./supervisor-store";

export type WorkerCheck = { name: string; passed: boolean; detail: string };
export type WorkerResult = { summary: string; checks: WorkerCheck[]; artifact?: unknown };
export type SupervisorWorkerHandler = (job: SupervisorJob, context: { attempt: number; idempotencyKey: string }) => Promise<WorkerResult>;
export type SupervisorWorkerHandlers = Record<string, SupervisorWorkerHandler>;
export type ExecutionResult =
  | { ok: true; jobId: string; outcome: "verified"; checks: WorkerCheck[] }
  | { ok: false; jobId: string; outcome: "failed" | "blocked"; reason: string; checks?: WorkerCheck[] };

/**
 * Executes exactly one already-leased job through an explicitly registered handler.
 * This adapter does not discover work, grant permissions, or deploy anything.
 * A job is verified only when the handler returns at least one named, passing check.
 */
export async function executeLeasedSupervisorJob(
  db: D1Database,
  lease: SupervisorLease,
  handlers: SupervisorWorkerHandlers,
): Promise<ExecutionResult> {
  const jobs = await listSupervisorJobs(db);
  const job = jobs.find(item => item.id === lease.jobId);
  if (!job) return { ok: false, jobId: lease.jobId, outcome: "blocked", reason: "job_not_found" };
  if (job.workerId !== lease.workerId) return { ok: false, jobId: lease.jobId, outcome: "blocked", reason: "worker_ownership_mismatch" };
  if (job.status !== "running") return { ok: false, jobId: lease.jobId, outcome: "blocked", reason: "job_not_running" };

  const handler = handlers[lease.workerId];
  if (!handler) {
    await finishSupervisorLease(db, lease, "blocked", { reason: "handler_not_registered", workerId: lease.workerId });
    return { ok: false, jobId: lease.jobId, outcome: "blocked", reason: "handler_not_registered" };
  }

  if (!await heartbeatSupervisorLease(db, lease)) {
    return { ok: false, jobId: lease.jobId, outcome: "blocked", reason: "lease_not_owned_or_expired" };
  }

  try {
    const result = await handler(job, { attempt: lease.attempt, idempotencyKey: lease.idempotencyKey });
    const checks = Array.isArray(result.checks) ? result.checks : [];
    const valid = checks.length > 0 && checks.every(check =>
      typeof check.name === "string" && check.name.trim().length > 0 &&
      typeof check.passed === "boolean" && typeof check.detail === "string"
    );
    const passed = valid && checks.every(check => check.passed);
    const detail = {
      workerId: lease.workerId,
      attempt: lease.attempt,
      idempotencyKey: lease.idempotencyKey,
      summary: typeof result.summary === "string" ? result.summary : "",
      checks,
      ...(result.artifact === undefined ? {} : { artifact: result.artifact }),
    };
    const outcome = passed ? "verified" : "failed";
    const finished = await finishSupervisorLease(db, lease, outcome, detail);
    if (!finished) return { ok: false, jobId: lease.jobId, outcome: "blocked", reason: "lease_lost_before_finish", checks };
    return passed
      ? { ok: true, jobId: lease.jobId, outcome: "verified", checks }
      : { ok: false, jobId: lease.jobId, outcome: "failed", reason: valid ? "one_or_more_checks_failed" : "missing_or_invalid_verification_checks", checks };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const finished = await finishSupervisorLease(db, lease, "failed", {
      workerId: lease.workerId, attempt: lease.attempt, idempotencyKey: lease.idempotencyKey,
      error: reason, checks: [{ name: "handler_execution", passed: false, detail: "Worker handler threw before verification." }],
    });
    return { ok: false, jobId: lease.jobId, outcome: finished ? "failed" : "blocked", reason: finished ? "handler_failed" : "lease_lost_after_handler_failure" };
  }
}
