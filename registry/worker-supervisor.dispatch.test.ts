import { strict as assert } from "node:assert";
import { selectRunnableSupervisorJobs } from "./worker-supervisor";
import type { SupervisorJob } from "./supervisor-store";
import type { SupervisorWorkerHandlers } from "./worker-executor";

const makeJob = (overrides: Partial<SupervisorJob>): SupervisorJob => ({
  id: "job-default", source: "test", sourceId: "default", title: "Test job",
  workerId: "custom-worker", priority: 1, risk: "low", status: "queued",
  dependencyIds: [], attempts: 0, input: {}, evidence: {},
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});
const handler = async () => ({ summary: "ok", checks: [{ name: "contract", passed: true, detail: "ok" }] });
const handlers: SupervisorWorkerHandlers = { "custom-worker": handler, "build-worker": handler };
const jobs = [
  makeJob({ id: "custom", sourceId: "custom", priority: 20 }),
  makeJob({ id: "gated", sourceId: "gated", workerId: "custom-worker", risk: "high", priority: 100 }),
  makeJob({ id: "human", sourceId: "human", workerId: "custom-worker", humanGate: "owner_approval", priority: 90 }),
  makeJob({ id: "unregistered", sourceId: "unregistered", workerId: "unregistered-worker", priority: 80 }),
  makeJob({ id: "waiting", sourceId: "waiting", workerId: "custom-worker", dependencyIds: ["missing-dependency"], priority: 70 }),
  makeJob({ id: "build-no-input", sourceId: "build-no-input", workerId: "build-worker", priority: 60 }),
  makeJob({ id: "build-ready", sourceId: "build-ready", workerId: "build-worker", priority: 50, input: { repository: "owner/repo", revision: "abcdef1234567", checks: ["typecheck"] } }),
];
const selected = selectRunnableSupervisorJobs(jobs, handlers, 10);
assert.deepEqual(selected.map(job => job.id), ["custom", "build-ready"]);
assert.deepEqual(selectRunnableSupervisorJobs(jobs, handlers, 1).map(job => job.id), ["custom"]);
console.log("registered worker dispatch tests: ok (explicit handlers, risk gates, human gates, dependencies, immutable build inputs, priority and limit)");
