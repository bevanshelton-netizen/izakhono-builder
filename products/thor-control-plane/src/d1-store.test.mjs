import assert from "node:assert/strict";
import { D1ThorStore } from "./d1-store.mjs";

// A tiny SQL adapter contract test validates row mapping and guarded updates.
// Full SQL/concurrency behaviour must also be exercised against a real D1 test DB.
const calls = [];
const row = {
  id: "task-1", project_id: "kora", title: "Build", instruction: "Build it",
  depends_on_json: "[]", priority: 100, state: "queued", attempts: 0,
  max_attempts: 2, worker_id: null, lease_until: null, result_json: null,
  last_error: null, created_at: "2026-11-12T12:00:00.000Z", updated_at: "2026-11-12T12:00:00.000Z",
};
const db = {
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
const store = new D1ThorStore(db, () => Date.parse("2026-11-12T12:00:00.000Z"));
const claimed = await store.claimNext("worker-1", 5_000);
assert.equal(claimed.id, "task-1");
assert.equal(claimed.workerId, "worker-1");
const guardedUpdate = calls.find(call => call.sql.includes("UPDATE thor_tasks") && call.sql.includes("state = 'running'"));
assert.ok(guardedUpdate);
assert.match(guardedUpdate.sql, /NOT EXISTS/);
console.log("THOR D1 adapter contract: all tests passed.");
