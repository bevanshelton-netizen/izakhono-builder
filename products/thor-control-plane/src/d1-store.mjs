/**
 * Cloudflare D1 adapter for THOR tasks.
 *
 * Every task transition and its audit event are committed in one D1 batch.
 * claimNext rechecks lease and dependency predicates in the conditional UPDATE;
 * the following event INSERT is gated by SQLite changes() so a losing worker
 * cannot create a false claim event. Keep this adapter behind a private binding.
 */
import { ThorError } from "./index.mjs";

const parse = (value, fallback = null) => {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

const mapRow = row => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  instruction: row.instruction,
  workerEnvelope: parse(row.worker_envelope_json),
  dependsOn: parse(row.depends_on_json, []),
  priority: row.priority,
  state: row.state,
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  workerId: row.worker_id,
  leaseUntil: row.lease_until,
  result: parse(row.result_json),
  lastError: row.last_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class D1ThorStore {
  constructor(db, clock = () => Date.now()) {
    if (!db?.prepare || typeof db.batch !== "function") {
      throw new ThorError("A D1 database binding with transactional batch support is required", "DB_REQUIRED");
    }
    this.db = db;
    this.clock = clock;
  }

  stamp() { return new Date(this.clock()).toISOString(); }

  eventStatement(taskId, type, workerId, detail = {}, createdAt = this.stamp()) {
    return this.db.prepare(
      `INSERT INTO thor_task_events (id, task_id, event_type, worker_id, event_json, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE changes() = 1`,
    ).bind(crypto.randomUUID(), taskId, type, workerId ?? null, JSON.stringify(detail), createdAt);
  }

  async createTask(task) {
    const insert = this.db.prepare(
      `INSERT INTO thor_tasks
       (id, project_id, title, instruction, worker_envelope_json, depends_on_json, priority, state, attempts, max_attempts, worker_id, lease_until, result_json, last_error, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'queued', 0, ?8, NULL, NULL, NULL, NULL, ?9, ?9)`,
    ).bind(task.id, task.projectId, task.title, task.instruction,
      task.workerEnvelope ? JSON.stringify(task.workerEnvelope) : null,
      JSON.stringify(task.dependsOn), task.priority, task.maxAttempts, task.createdAt);
    const event = this.eventStatement(task.id, "created", null, {
      projectId: task.projectId, dependsOn: task.dependsOn,
    }, task.createdAt);
    await this.db.batch([insert, event]);
    return task;
  }

  async getTask(id) {
    const row = await this.db.prepare("SELECT * FROM thor_tasks WHERE id = ?1").bind(id).first();
    return row ? mapRow(row) : null;
  }

  async listTasks() {
    const result = await this.db.prepare("SELECT * FROM thor_tasks ORDER BY created_at, id").all();
    return (result.results ?? []).map(mapRow);
  }

  async reapExhaustedLeases() {
    const now = this.stamp();
    const expired = await this.db.prepare(
      "SELECT id, worker_id, attempts FROM thor_tasks WHERE state = 'running' AND lease_until <= ?1 AND attempts >= max_attempts",
    ).bind(now).all();
    let reaped = 0;
    for (const task of expired.results ?? []) {
      const update = this.db.prepare(
        "UPDATE thor_tasks SET state = 'failed', worker_id = NULL, lease_until = NULL, last_error = COALESCE(last_error, 'Worker lease expired after maximum attempts'), updated_at = ?1 WHERE id = ?2 AND state = 'running' AND lease_until <= ?1 AND attempts >= max_attempts",
      ).bind(now, task.id);
      const event = this.eventStatement(task.id, "failed", task.worker_id, {
        reason: "lease_exhausted", attempts: task.attempts,
      }, now);
      const results = await this.db.batch([update, event]);
      if (results[0]?.meta?.changes === 1) reaped += 1;
    }
    return reaped;
  }

  async claimNext(workerId, leaseMs, options = {}) {
    await this.reapExhaustedLeases();
    const envelopeFilter = options.requireWorkerEnvelope ? " AND t.worker_envelope_json IS NOT NULL" : "";
    const updateEnvelopeFilter = options.requireWorkerEnvelope ? " AND worker_envelope_json IS NOT NULL" : "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const now = this.stamp();
      const leaseUntil = new Date(this.clock() + leaseMs).toISOString();
      const candidate = await this.db.prepare(
        `SELECT t.id FROM thor_tasks t
         WHERE (t.state = 'queued' OR (t.state = 'running' AND t.lease_until <= ?1 AND t.attempts < t.max_attempts))
           ${envelopeFilter}
           AND NOT EXISTS (
             SELECT 1 FROM json_each(t.depends_on_json) dep
             LEFT JOIN thor_tasks prerequisite ON prerequisite.id = dep.value
             WHERE prerequisite.id IS NULL OR prerequisite.state <> 'succeeded'
           )
         ORDER BY t.priority ASC, t.created_at ASC, t.id ASC LIMIT 1`,
      ).bind(now).first();
      if (!candidate) return null;

      const update = this.db.prepare(
        `UPDATE thor_tasks
         SET state = 'running', worker_id = ?1, attempts = attempts + 1,
             lease_until = ?2, updated_at = ?3
         WHERE id = ?4
           AND (state = 'queued' OR (state = 'running' AND lease_until <= ?3 AND attempts < max_attempts))
           ${updateEnvelopeFilter}
           AND NOT EXISTS (
             SELECT 1 FROM json_each(thor_tasks.depends_on_json) dep
             LEFT JOIN thor_tasks prerequisite ON prerequisite.id = dep.value
             WHERE prerequisite.id IS NULL OR prerequisite.state <> 'succeeded'
           )`,
      ).bind(workerId, leaseUntil, now, candidate.id);
      const event = this.eventStatement(candidate.id, "claimed", workerId, { leaseUntil }, now);
      const results = await this.db.batch([update, event]);

      if (results[0]?.meta?.changes === 1) return this.getTask(candidate.id);
    }
    return null;
  }

  async heartbeat(taskId, workerId, leaseMs) {
    const now = this.stamp();
    const leaseUntil = new Date(this.clock() + leaseMs).toISOString();
    const update = this.db.prepare(
      "UPDATE thor_tasks SET lease_until = ?1, updated_at = ?2 WHERE id = ?3 AND state = 'running' AND worker_id = ?4 AND lease_until > ?2",
    ).bind(leaseUntil, now, taskId, workerId);
    const event = this.eventStatement(taskId, "heartbeat", workerId, { leaseUntil }, now);
    const results = await this.db.batch([update, event]);
    return results[0]?.meta?.changes === 1;
  }

  async finish(taskId, workerId, result) {
    const now = this.stamp();
    const update = this.db.prepare(
      "UPDATE thor_tasks SET state = 'succeeded', result_json = ?1, worker_id = NULL, lease_until = NULL, updated_at = ?2 WHERE id = ?3 AND state = 'running' AND worker_id = ?4 AND lease_until > ?2",
    ).bind(JSON.stringify(result ?? null), now, taskId, workerId);
    const event = this.eventStatement(taskId, "succeeded", workerId, {
      artifactDigest: result?.artifactDigest ?? null,
    }, now);
    const results = await this.db.batch([update, event]);
    if (results[0]?.meta?.changes !== 1) throw new ThorError("Worker does not own this running task", "LEASE_NOT_OWNED");
    return this.getTask(taskId);
  }

  async fail(taskId, workerId, error) {
    const current = await this.getTask(taskId);
    if (!current || current.state !== "running" || current.workerId !== workerId) {
      throw new ThorError("Worker does not own this running task", "LEASE_NOT_OWNED");
    }
    const retry = current.attempts < current.maxAttempts;
    const state = retry ? "queued" : "failed";
    const message = String(error?.message ?? error).slice(0, 2000);
    const now = this.stamp();
    const update = this.db.prepare(
      "UPDATE thor_tasks SET state = ?1, last_error = ?2, worker_id = NULL, lease_until = NULL, updated_at = ?3 WHERE id = ?4 AND state = 'running' AND worker_id = ?5 AND lease_until > ?3",
    ).bind(state, message, now, taskId, workerId);
    const event = this.eventStatement(taskId, retry ? "retry_queued" : "failed", workerId, { error: message }, now);
    const results = await this.db.batch([update, event]);
    if (results[0]?.meta?.changes !== 1) throw new ThorError("Worker lease changed during failure handling", "LEASE_NOT_OWNED");
    return this.getTask(taskId);
  }

  async cancel(taskId) {
    const now = this.stamp();
    const update = this.db.prepare(
      "UPDATE thor_tasks SET state = 'cancelled', updated_at = ?1 WHERE id = ?2 AND state = 'queued'",
    ).bind(now, taskId);
    const event = this.eventStatement(taskId, "cancelled", null, {}, now);
    const results = await this.db.batch([update, event]);
    if (results[0]?.meta?.changes !== 1) throw new ThorError("Only queued tasks can be cancelled", "INVALID_CANCEL");
    return this.getTask(taskId);
  }
}
