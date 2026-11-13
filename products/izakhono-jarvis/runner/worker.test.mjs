import assert from "node:assert/strict";
import { runJarvisWorkerOnce } from "./worker.mjs";
const env = {
  JARVIS_API_BASE_URL: "https://jarvis.example",
  JARVIS_OWNER_SECRET: "test-owner-secret",
  JARVIS_EXECUTOR_URL: "https://executor.example/api/jarvis/execute",
  JARVIS_EXECUTOR_TOKEN: "test-executor-token",
  JARVIS_AGENT_ID: "coordinator",
};
const calls = [];
const fetcher = async (url, options) => {
  calls.push({ url: String(url), options });
  let body;
  if (String(url).endsWith("/claim")) body = { ok: true, claimed: true, step: { id: "step-1", assigned_agent: "coordinator", title: "Test", description: "Bounded test task" } };
  else if (String(url).includes("executor.example")) body = { status: "completed", evidence: "Executor validation passed in isolated test" };
  else body = { ok: true, status: "completed" };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};
const result = await runJarvisWorkerOnce(env, fetcher);
assert.equal(result.status, "completed");
assert.equal(result.owner_verification, "pending");
assert.equal(calls.length, 3);
assert.equal(calls[0].options.headers["x-admin-secret"], "test-owner-secret");
assert.equal(calls[1].options.headers.authorization, "Bearer test-executor-token");
assert.equal(JSON.parse(calls[2].options.body).evidence, "Executor validation passed in isolated test");
const idle = await runJarvisWorkerOnce(env, async () => new Response(JSON.stringify({ ok: true, claimed: false }), { status: 200 }));
assert.equal(idle.status, "idle");
await assert.rejects(() => runJarvisWorkerOnce({ ...env, JARVIS_EXECUTOR_URL: "http://executor.example" }, fetcher), /HTTPS/);
console.log("[PASS] J.A.R.V.I.S. worker bridge contract, idle path, and HTTPS gate.");
