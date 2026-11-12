import assert from "node:assert/strict";
import { MemoryThorStore, ThorOrchestrator } from "./index.mjs";

let now = Date.parse("2026-11-12T12:00:00.000Z");
const clock = () => now;
const store = new MemoryThorStore(clock);
const thor = new ThorOrchestrator({ store, clock, leaseMs: 5_000 });

await thor.submit({ id: "a", projectId: "kora", title: "Build API", instruction: "Create API", maxAttempts: 2 });
await thor.submit({ id: "b", projectId: "nav", title: "Build UI", instruction: "Create UI" });
await thor.submit({ id: "c", projectId: "nav", title: "Integrate UI", instruction: "Integrate", dependsOn: ["b"] });

// Independent workers claim different projects concurrently.
const claims = await Promise.all([
  thor.runOne("worker-a", async task => ({ worker: "a", project: task.projectId })),
  thor.runOne("worker-b", async task => ({ worker: "b", project: task.projectId })),
]);
assert.equal(claims.filter(result => result.claimed).length, 2);
assert.notEqual(claims[0].task.id, claims[1].task.id);

// Dependency is not runnable until its prerequisite succeeds.
const blocked = await thor.runOne("worker-c", async () => "should not run");
assert.equal(blocked.claimed, false);

// Failure is retried and does not freeze unrelated work.
await thor.submit({ id: "retry", projectId: "edu-build", title: "Retry task", instruction: "Transient failure", maxAttempts: 2 });
const failedOnce = await thor.runOne("worker-d", async () => { throw new Error("temporary"); });
assert.equal(failedOnce.task.state, "queued");
assert.equal(failedOnce.task.attempts, 1);
const succeeded = await thor.runOne("worker-e", async () => ({ ok: true }));
assert.equal(succeeded.task.state, "succeeded");

// Complete prerequisite, then dependent becomes eligible.
const bTask = (await store.getTask("b"));
assert.equal(bTask.state, "succeeded");
const dependent = await thor.runOne("worker-f", async task => ({ dependsOn: task.dependsOn }));
assert.equal(dependent.task.id, "c");
assert.equal(dependent.task.state, "succeeded");

// Lease expiry permits recovery after a worker disappears.
await thor.submit({ id: "lease", projectId: "freight", title: "Recover worker", instruction: "Test lease" });
const first = await store.claimNext("lost-worker", 5_000);
assert.equal(first.id, "lease");
now += 5_001;
const recovered = await store.claimNext("replacement-worker", 5_000);
assert.equal(recovered.id, "lease");
assert.equal(recovered.attempts, 2);
assert.equal(recovered.workerId, "replacement-worker");

// Old worker cannot complete a task after lease ownership changes.
await assert.rejects(() => store.finish("lease", "lost-worker", "late"), /does not own/);
const final = await store.finish("lease", "replacement-worker", "recovered");
assert.equal(final.state, "succeeded");

const snapshot = await thor.snapshot();
assert.equal(snapshot.counts.succeeded, 5);
assert.equal(snapshot.counts.queued, 0);
console.log("THOR orchestration core: all tests passed.");
