export interface QueueDbStatement {
  bind(...values: unknown[]): QueueDbStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta?: { changes?: number } }>;
}
export interface QueueDb { prepare(sql: string): QueueDbStatement; }

export type QueueJob = {
  id: string;
  projectId: string;
  instruction: string;
  requestedBy: string;
  status: string;
  requiresApproval: boolean;
  approvedBy?: string;
  events: Array<{ at: string; status: string; detail: string }>;
  createdAt: string;
  updatedAt: string;
};

export type JobProcessor = (job: QueueJob) => Promise<{
  ok: boolean;
  summary: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}>;

export class NativeBuilderQueue {
  constructor(
    private readonly db: QueueDb,
    private readonly processor: JobProcessor,
    private readonly workerId: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    if (!workerId.trim()) throw new Error("workerId is required");
  }

  async processOne(): Promise<{ claimed: false } | { claimed: true; jobId: string; status: "succeeded" | "failed"; summary: string }> {
    const stamp = this.now();
    const row = await this.db.prepare(
      "SELECT id, payload_json FROM native_builder_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1",
    ).first<{ id: string; payload_json: string }>();
    if (!row) return { claimed: false };

    const claim = await this.db.prepare(
      "UPDATE native_builder_jobs SET status='running', updated_at=?1 WHERE id=?2 AND status='queued'",
    ).bind(stamp, row.id).run();
    if (claim.meta?.changes !== 1) return { claimed: false };

    const job = JSON.parse(row.payload_json) as QueueJob;
    let outcome: { ok: boolean; summary: string; checks: Array<{ name: string; passed: boolean; detail: string }> };
    if (job.requiresApproval && !job.approvedBy) {
      outcome = { ok: false, summary: "Independent approval is required.", checks: [{ name: "approval", passed: false, detail: "Execution was not started." }] };
    } else {
      try {
        outcome = await this.processor(job);
      } catch (error) {
        outcome = { ok: false, summary: error instanceof Error ? error.message : String(error), checks: [{ name: "processor", passed: false, detail: "Processor reported an error." }] };
      }
    }

    const passed = outcome.ok && outcome.checks.length > 0 && outcome.checks.every(check => check.passed);
    const status = passed ? "succeeded" : "failed";
    const finished = this.now();
    const updated: QueueJob = {
      ...job,
      status,
      updatedAt: finished,
      events: [...job.events, { at: finished, status, detail: outcome.summary }],
    };
    await this.db.prepare(
      "UPDATE native_builder_jobs SET status=?1, updated_at=?2, payload_json=?3 WHERE id=?4 AND status='running'",
    ).bind(status, finished, JSON.stringify(updated), job.id).run();

    await this.db.prepare(
      "INSERT INTO native_builder_execution_evidence (id, job_id, worker_id, evidence_type, evidence_json, created_at) VALUES (?1, ?2, ?3, 'result', ?4, ?5)",
    ).bind(crypto.randomUUID(), job.id, this.workerId, JSON.stringify(outcome), finished).run();

    return { claimed: true, jobId: job.id, status, summary: outcome.summary };
  }
}
