import assert from "node:assert/strict";
import { D1ThorStore } from "./d1-store.mjs";

// A tiny SQL adapter contract test validates row mapping and guarded updates.
// Full SQL/concurrency behaviour must also be exercised against a real D1 test DB.
const calls = [];
const batches = [];
const row = {
  id: "task-1", project_id: "kora", title: "Build", instruction: "Build it",
  worker_envelope_json: JSON.stringify({ taskId: "task-1", projectId: "kora" }), depends_on_json: "[]", priority: 100, state: "queued", attempts: 0,
  max_attempts: 2, worker_id: null, lease_until: null, result_json: null,
  last_error: null, created_at: "2026-11-12T12:00:00.000Z", updated_at: "2026-11-12T12:00:00.000Z",
};
const db = {
  async batch(statements) {
    batches.push(statements.map(statement => statement.sql));
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  },
  prepare(sql) {
    const statement = {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        calls.push({ sql, values: this.values, method: "first" });
        if (sql.includes("SELECT t.id")) return { id: "task-1" };
        if (sql.includes("SELECT *")) return { ...row, state: "running", worker_id: "worker-1", attempts: 1, lease_until: "2026-11-12T12:00:05.000Z" };
        return null;
      },
      async run() {
        calls.push({ sql, values: this.values, method: "run" });
        return { meta: { changes: 1 } };
      },
      async all() { return { results: [] }; },
    };
    return statement;
  },
};
assert.throws(() => new D1ThorStore({ prepare() {} }), error => error.code === "DB_REQUIRED");
const store = new D1ThorStore(db, () => Date.parse("2026-11-12T12:00:00.000Z"));
const envelope = { taskId: "task-1", projectId: "kora" };
await store.createTask({
  id: "task-1", projectId: "kora", title: "Build", instruction: "Build it",
  workerEnvelope: envelope, dependsOn: [], priority: 100, maxAttempts: 2,
  createdAt: "2026-11-12T12:00:00.000Z",
});
const taskInsert = calls.find(call => call.sql.includes("INSERT INTO thor_tasks"));
assert.ok(taskInsert);
assert.match(taskInsert.sql, /worker_envelope_json/);
assert.equal(taskInsert.values[4], JSON.stringify(envelope));
assert.equal(batches[0].length, 2);
assert.match(batches[0][1], /WHERE changes\(\) = 1/);

const claimed = await store.claimNext("worker-1", 5_000, { requireWorkerEnvelope: true });
assert.equal(claimed.id, "task-1");
assert.equal(claimed.workerId, "worker-1");
assert.equal(claimed.workerEnvelope.taskId, "task-1");
const guardedUpdate = calls.find(call => call.sql.includes("UPDATE thor_tasks") && call.sql.includes("state = 'running'"));
assert.ok(guardedUpdate);
assert.match(guardedUpdate.sql, /NOT EXISTS/);
assert.match(guardedUpdate.sql, /worker_envelope_json IS NOT NULL/);
const claimBatch = batches.find(batch => batch.some(sql => sql.includes("UPDATE thor_tasks") && sql.includes("state = 'running'")));
assert.ok(claimBatch);
assert.equal(claimBatch.length, 2);
assert.ok(claimBatch[1].includes("WHERE changes() = 1"));
console.log("THOR D1 adapter contract: all tests passed.");
