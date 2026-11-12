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
assert.equal((await store.getTask("b")).state, "succeeded");

// A dependent task becomes eligible only after its prerequisite succeeds.
const dependent = await thor.runOne("worker-c", async task => ({ dependsOn: task.dependsOn }));
assert.equal(dependent.task.id, "c");
assert.equal(dependent.task.state, "succeeded");

// Isolated dependency gate: a running prerequisite does not unlock its child.
const dependencyStore = new MemoryThorStore(clock);
const dependencyThor = new ThorOrchestrator({ store: dependencyStore, clock, leaseMs: 5_000 });
await dependencyThor.submit({ id: "parent", projectId: "demo", title: "Parent", instruction: "Build parent" });
await dependencyThor.submit({ id: "child", projectId: "demo", title: "Child", instruction: "Build child", dependsOn: ["parent"] });
const parent = await dependencyStore.claimNext("parent-worker", 5_000);
assert.equal(parent.id, "parent");
assert.equal(await dependencyStore.claimNext("child-worker", 5_000), null);
await dependencyStore.finish("parent", "parent-worker", { ok: true });
const child = await dependencyStore.claimNext("child-worker", 5_000);
assert.equal(child.id, "child");

// Failure is retried and does not freeze unrelated work.
await thor.submit({ id: "retry", projectId: "edu-build", title: "Retry task", instruction: "Transient failure", maxAttempts: 2 });
const failedOnce = await thor.runOne("worker-d", async () => { throw new Error("temporary"); });
assert.equal(failedOnce.task.state, "queued");
assert.equal(failedOnce.task.attempts, 1);
const succeeded = await thor.runOne("worker-e", async () => ({ ok: true }));
assert.equal(succeeded.task.state, "succeeded");

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
await assert.rejects(() => store.finish("lease", "lost-worker", "late"), /active lease/);
const final = await store.finish("lease", "replacement-worker", "recovered");
assert.equal(final.state, "succeeded");

// An exhausted lease is terminal instead of being reclaimed forever.
const exhaustedStore = new MemoryThorStore(clock);
const exhaustedThor = new ThorOrchestrator({ store: exhaustedStore, clock, leaseMs: 5_000 });
await exhaustedThor.submit({ id: "exhausted", projectId: "demo", title: "Exhausted lease", instruction: "Must terminate", maxAttempts: 1 });
const exhaustedClaim = await exhaustedStore.claimNext("last-worker", 5_000);
assert.equal(exhaustedClaim.attempts, 1);
now += 5_001;
assert.equal(await exhaustedStore.claimNext("replacement", 5_000), null);
assert.equal((await exhaustedStore.getTask("exhausted")).state, "failed");

// An expired worker cannot revive, complete or fail its lease before recovery.
const expiryStore = new MemoryThorStore(clock);
const expiryThor = new ThorOrchestrator({ store: expiryStore, clock, leaseMs: 5_000 });
await expiryThor.submit({ id: "expired-finish", projectId: "demo", title: "Expired finish", instruction: "Reject stale finish", maxAttempts: 2 });
const staleFinisher = await expiryStore.claimNext("stale-finisher", 5_000);
now += 5_001;
assert.equal(await expiryStore.heartbeat(staleFinisher.id, "stale-finisher", 5_000), false);
await assert.rejects(() => expiryStore.finish(staleFinisher.id, "stale-finisher", "late"), /active lease/);
const replacementFinisher = await expiryStore.claimNext("replacement-finisher", 5_000);
assert.equal(replacementFinisher.workerId, "replacement-finisher");
await expiryStore.finish(replacementFinisher.id, "replacement-finisher", "on time");

await expiryThor.submit({ id: "expired-fail", projectId: "demo", title: "Expired fail", instruction: "Reject stale failure", maxAttempts: 2 });
const staleFailure = await expiryStore.claimNext("stale-failure", 5_000);
now += 5_001;
await assert.rejects(() => expiryStore.fail(staleFailure.id, "stale-failure", new Error("late failure")), /active lease/);
const replacementFailure = await expiryStore.claimNext("replacement-failure", 5_000);
assert.equal(replacementFailure.id, "expired-fail");


// Long-running executors receive automatic lease renewal and can finish safely.
const longTaskStore = new MemoryThorStore();
const longTaskThor = new ThorOrchestrator({ store: longTaskStore, leaseMs: 1_000 });
await longTaskThor.submit({ id: "long-task", projectId: "kora", title: "Long task", instruction: "Run longer than one lease", maxAttempts: 2 });
const longTaskResult = await longTaskThor.runOne("long-worker", async () => {
  await new Promise(resolve => setTimeout(resolve, 1_250));
  return { completed: true };
});
assert.equal(longTaskResult.task.state, "succeeded");
assert.ok(longTaskStore.events.some(event => event.taskId === "long-task" && event.type === "heartbeat"));

const snapshot = await thor.snapshot();
assert.equal(snapshot.counts.succeeded, 5);
assert.equal(snapshot.counts.queued, 0);
console.log("THOR orchestration core: all tests passed.");
