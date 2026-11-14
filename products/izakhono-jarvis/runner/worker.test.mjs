import assert from "node:assert/strict";
import { runJarvisWorkerOnce } from "./worker.mjs";

const env = {
  JARVIS_API_BASE_URL: "https://jarvis.example",
  JARVIS_OWNER_SECRET: "test-owner-secret",
  JARVIS_EXECUTOR_URL: "https://executor.example/api/jarvis/execute",
  JARVIS_EXECUTOR_TOKEN: "test-executor-token",
  JARVIS_AGENT_ID: "coordinator",
};
const validStep = { id: "step-1", assigned_agent: "coordinator", title: "Test", description: "Bounded test task" };
const completedEvidence = "Executor validation passed in isolated test";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

{
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    let body;
    if (String(url).endsWith("/claim")) body = { ok: true, claimed: true, step: validStep };
    else if (String(url).includes("executor.example")) body = { status: "completed", evidence: completedEvidence };
    else body = { ok: true, status: "completed" };
    return json(body);
  };
  const result = await runJarvisWorkerOnce(env, fetcher);
  assert.equal(result.status, "completed");
  assert.equal(result.owner_verification, "pending");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers["x-admin-secret"], "test-owner-secret");
  assert.equal(calls[1].options.headers.authorization, "Bearer test-executor-token");
  assert.equal(calls[1].options.redirect, "error");
  assert.equal(JSON.parse(calls[2].options.body).evidence, completedEvidence);
}

{
  const idle = await runJarvisWorkerOnce(env, async () => json({ ok: true, claimed: false }));
  assert.equal(idle.status, "idle");
}

{
  const calls = [];
  const result = await runJarvisWorkerOnce(env, async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/claim")) return json({ ok: true, claimed: true, step: validStep });
    if (String(url).includes("executor.example")) return json({ status: "failed", evidence: "" });
    return json({ ok: true });
  });
  assert.equal(result.status, "failed");
  assert.equal(calls.length, 3);
  assert.ok(calls[2].endsWith("/steps/step-1/fail"));
}

{
  const calls = [];
  const result = await runJarvisWorkerOnce(env, async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/claim")) return json({ ok: true, claimed: true, step: { ...validStep, assigned_agent: "other-agent" } });
    return json({ ok: true });
  });
  assert.equal(result.status, "failed");
  assert.ok(calls[1].endsWith("/steps/step-1/fail"));
}

{
  const result = await runJarvisWorkerOnce({ ...env, JARVIS_EXECUTOR_ALLOWED_HOSTS: "trusted.example" }, async () => {
    throw new Error("fetch should not be called");
  }).catch(error => error);
  assert.match(result.message, /not in JARVIS_EXECUTOR_ALLOWED_HOSTS/);
}

await assert.rejects(
  () => runJarvisWorkerOnce({ ...env, JARVIS_EXECUTOR_URL: "http://executor.example" }),
  /HTTPS/
);
await assert.rejects(
  () => runJarvisWorkerOnce({ ...env, JARVIS_EXECUTOR_URL: "https://executor.example?token=unsafe" }),
  /query strings or fragments/
);
await assert.rejects(
  () => runJarvisWorkerOnce({ ...env, JARVIS_API_BASE_URL: "https://localhost" }),
  /Local worker endpoints/
);

console.log("[PASS] J.A.R.V.I.S. worker bridge security, claim, completion, idle, failure, and host allowlist contracts.");
