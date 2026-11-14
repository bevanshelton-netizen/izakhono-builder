import { strict as assert } from "node:assert";
import { NativeBuilderQueue, type QueueDb, type QueueDbStatement, type QueueJob } from "./queue.js";

type Row = { id: string; payload_json: string };
class MemoryQueueDb implements QueueDb {
  jobs = new Map<string, QueueJob>();
  evidence: Array<{ id: string; jobId: string; workerId: string; payload: string }> = [];
  prepare(sql: string): QueueDbStatement {
    const normalized = sql.replace(/\s+/g, " ").trim();
    let values: unknown[] = [];
    const statement: QueueDbStatement = {
      bind: (...args: unknown[]) => { values = args; return statement; },
      first: async <T>() => {
        if (!normalized.startsWith("SELECT id, payload_json FROM native_builder_jobs")) throw new Error("Unexpected first query: " + normalized);
        const row = [...this.jobs.values()].filter(job =>
          job.status === "queued" && (!job.requiresApproval || Boolean(job.approvedBy)),
        ).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        return row ? ({ id: row.id, payload_json: JSON.stringify(row) } as T) : null;
      },
      run: async () => {
        if (normalized.startsWith("UPDATE native_builder_jobs SET status='running'")) {
          const [stamp, id] = values as [string, string];
          const job = this.jobs.get(id);
          if (!job || job.status !== "queued" || (job.requiresApproval && !job.approvedBy)) return { meta: { changes: 0 } };
          this.jobs.set(id, { ...job, status: "running", updatedAt: stamp });
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith("UPDATE native_builder_jobs SET status=?1")) {
          const [status, stamp, payload, id] = values as [string, string, string, string];
          const job = this.jobs.get(id);
          if (!job || job.status !== "running") return { meta: { changes: 0 } };
          this.jobs.set(id, { ...(JSON.parse(payload) as QueueJob), status, updatedAt: stamp });
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith("INSERT INTO native_builder_execution_evidence")) {
          const [id, jobId, workerId, payload] = values as [string, string, string, string, string];
          this.evidence.push({ id, jobId, workerId, payload });
          return { meta: { changes: 1 } };
        }
        throw new Error("Unexpected run query: " + normalized);
      },
    };
    return statement;
  }
}
const makeJob = (id: string, requiresApproval = false): QueueJob => ({
  id, projectId: "project-1", instruction: "Build a verified site", requestedBy: "owner",
  status: "queued", requiresApproval, events: [], createdAt: "2026-11-14T08:00:00.000Z",
  updatedAt: "2026-11-14T08:00:00.000Z",
});

const db = new MemoryQueueDb();
db.jobs.set("success", makeJob("success"));
db.jobs.set("gated", makeJob("gated", true));
const processor = async (job: QueueJob) => ({
  ok: true, summary: "Validated " + job.id,
  checks: [{ name: "artifact-validation", passed: true, detail: "Artifact passed deterministic validation." }],
});
const worker = new NativeBuilderQueue(db, processor, "native-builder-test", () => "2026-11-14T08:01:00.000Z");
const [first, second] = await Promise.all([worker.processOne(), worker.processOne()]);
assert.equal([first, second].filter(result => result.claimed).length, 1, "only one concurrent worker may claim the queued job");
assert.equal(db.jobs.get("success")?.status, "succeeded");
assert.equal(db.evidence.length, 1);
assert.equal(db.jobs.get("gated")?.status, "queued", "unapproved gated jobs must remain queued");

db.jobs.set("approved", { ...makeJob("approved", true), approvedBy: "independent-approver" });
const failingWorker = new NativeBuilderQueue(
  db,
  async () => ({ ok: false, summary: "Validation failed", checks: [{ name: "security", passed: false, detail: "Policy check failed." }] }),
  "native-builder-test",
  () => "2026-11-14T08:02:00.000Z",
);
const failed = await failingWorker.processOne();
assert.equal(failed.claimed, true);
assert.equal(failed.status, "failed");
assert.equal(db.jobs.get("approved")?.status, "failed");
assert.equal(db.evidence.length, 2);

console.log("[PASS] Native Builder queue claims once under concurrent workers, respects approval gates and persists evidence for success/failure.");
