import assert from "node:assert/strict";
import { createThorWorker } from "./worker.mjs";
import { MemoryThorStore } from "./index.mjs";

const apiToken = "thor-api-test-token";
const workerToken = "thor-worker-test-token";
const hash = async value => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
};
const env = {
  THOR_DB: { prepare() { return { async all() { return { results: [] }; } }; } },
  THOR_API_TOKEN_SHA256: await hash(apiToken),
  THOR_WORKER_TOKEN_HASHES: JSON.stringify({ "worker-01": await hash(workerToken) }),
  THOR_PROJECT_POLICIES: JSON.stringify({
    kora: {
      repository: "bevanshelton-netizen/izakhono-builder",
      baseRef: "main",
      workRefPrefix: "thor/",
      allowedPaths: ["products/thor-control-plane/src"],
      commands: ["node --test", "npm test"],
      limits: { timeoutMs: 120000, maxOutputBytes: 200000, maxChangedFiles: 12 },
      maxAttempts: 3,
    },
  }),
  THOR_LEASE_MS: "5000",
};
const store = new MemoryThorStore();
let now = Date.parse("2026-11-17T12:00:00.000Z");
const worker = createThorWorker({
  storeFactory: () => store,
  schemaCheck: async () => true,
  clock: () => now,
});

function request(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`https://thor.example${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const health = await worker.fetch(request("/health"), env);
assert.equal(health.status, 200);
assert.equal((await health.json()).status, "ok");

const ready = await worker.fetch(request("/ready"), env);
assert.equal(ready.status, 200);
assert.equal((await ready.json()).status, "ready");

const envelope = {
  taskId: "task-01",
  projectId: "kora",
  repository: "bevanshelton-netizen/izakhono-builder",
  baseRef: "main",
  workRef: "thor/task-01",
  allowedPaths: ["products/thor-control-plane/src"],
  commands: ["node --test", "npm test"],
  limits: { timeoutMs: 120000, maxOutputBytes: 200000, maxChangedFiles: 12 },
};
const createBody = {
  id: envelope.taskId,
  projectId: envelope.projectId,
  title: "Implement bounded THOR worker",
  instruction: "Make the scoped code change and provide evidence.",
  workerEnvelope: envelope,
};

const unauthorized = await worker.fetch(request("/v1/tasks", { method: "POST", body: createBody, token: "wrong" }), env);
assert.equal(unauthorized.status, 401);

const created = await worker.fetch(request("/v1/tasks", { method: "POST", body: createBody, token: apiToken }), env);
assert.equal(created.status, 201);
const createdPayload = await created.json();
assert.equal(createdPayload.task.workerEnvelope.workRef, "thor/task-01");

const policyViolation = await worker.fetch(request("/v1/tasks", {
  method: "POST", token: apiToken,
  body: {
    ...createBody,
    id: "task-scope-violation",
    workerEnvelope: { ...envelope, taskId: "task-scope-violation", allowedPaths: ["products/other"] },
  },
}), env);
assert.equal(policyViolation.status, 403);

const badEnvelope = await worker.fetch(request("/v1/tasks", {
  method: "POST",
  token: apiToken,
  body: { ...createBody, id: "task-02", workerEnvelope: { ...envelope, taskId: "task-02", allowedPaths: ["../"] } },
}), env);
assert.equal(badEnvelope.status, 400);

const wrongWorker = await worker.fetch(request("/v1/workers/claim", {
  method: "POST", token: "wrong", body: { workerId: "worker-01", leaseMs: 5000 },
}), env);
assert.equal(wrongWorker.status, 401);

const claimed = await worker.fetch(request("/v1/workers/claim", {
  method: "POST", token: workerToken, body: { workerId: "worker-01", leaseMs: 5000 },
}), env);
assert.equal(claimed.status, 200);
const claimedPayload = await claimed.json();
assert.equal(claimedPayload.claimed, true);
assert.equal(claimedPayload.task.id, "task-01");
assert.equal(claimedPayload.task.workerId, "worker-01");

const heartbeat = await worker.fetch(request("/v1/tasks/task-01/heartbeat", {
  method: "POST", token: workerToken, body: { workerId: "worker-01" },
}), env);
assert.equal(heartbeat.status, 200);

const invalidCompletion = await worker.fetch(request("/v1/tasks/task-01/complete", {
  method: "POST",
  token: workerToken,
  body: { workerId: "worker-01", result: {
    commitSha: "a".repeat(40), workRef: "thor/task-01", artifactDigest: "b".repeat(64),
    pullRequestUrl: "https://github.com/bevanshelton-netizen/izakhono-builder/pull/123",
    changedFiles: ["../../.env"],
    tests: envelope.commands.map(command => ({ command, exitCode: 0, durationMs: 1, output: "passed" })),
  } },
}), env);
assert.equal(invalidCompletion.status, 400);

const completed = await worker.fetch(request("/v1/tasks/task-01/complete", {
  method: "POST",
  token: workerToken,
  body: { workerId: "worker-01", result: {
    commitSha: "a".repeat(40), workRef: "thor/task-01", artifactDigest: "b".repeat(64),
    pullRequestUrl: "https://github.com/bevanshelton-netizen/izakhono-builder/pull/123",
    changedFiles: ["products/thor-control-plane/src/worker.mjs"],
    tests: envelope.commands.map(command => ({ command, exitCode: 0, durationMs: 12, output: "passed" })),
  } },
}), env);
assert.equal(completed.status, 200);
assert.equal((await completed.json()).task.state, "succeeded");

const portfolio = await worker.fetch(request("/v1/portfolio", { token: apiToken }), env);
assert.equal(portfolio.status, 200);
assert.equal((await portfolio.json()).counts.succeeded, 1);

const noAuthPortfolio = await worker.fetch(request("/v1/portfolio"), env);
assert.equal(noAuthPortfolio.status, 401);

const cancelledTaskEnvelope = { ...envelope, taskId: "task-03", workRef: "thor/task-03" };
await worker.fetch(request("/v1/tasks", {
  method: "POST", token: apiToken,
  body: { ...createBody, id: "task-03", workerEnvelope: cancelledTaskEnvelope },
}), env);
const cancelled = await worker.fetch(request("/v1/tasks/task-03/cancel", {
  method: "POST", token: apiToken,
}), env);
assert.equal(cancelled.status, 200);
assert.equal((await cancelled.json()).task.state, "cancelled");

const notReady = await worker.fetch(request("/ready"), {
  THOR_DB: env.THOR_DB,
  THOR_API_TOKEN_SHA256: "",
  THOR_WORKER_TOKEN_HASHES: "{}",
});
assert.equal(notReady.status, 503);

console.log("THOR HTTP control plane: all tests passed.");
