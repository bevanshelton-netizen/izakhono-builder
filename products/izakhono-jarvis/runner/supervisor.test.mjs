import assert from "node:assert/strict";
import { runJarvisSupervisor } from "./supervisor.mjs";

const env = { JARVIS_WORKER_AGENTS: "coordinator,business-analyst,research-briefing,project-planner,reporting", JARVIS_WORKER_CONCURRENCY: "2" };
let active = 0;
let peak = 0;
const seen = [];
const result = await runJarvisSupervisor(env, async (workerEnv) => {
  active++;
  peak = Math.max(peak, active);
  seen.push(workerEnv.JARVIS_AGENT_ID);
  await new Promise((resolve) => setTimeout(resolve, 5));
  active--;
  if (workerEnv.JARVIS_AGENT_ID === "reporting") throw new Error("simulated isolated worker failure");
  return { status: workerEnv.JARVIS_AGENT_ID === "coordinator" ? "idle" : "completed", claimed: workerEnv.JARVIS_AGENT_ID !== "coordinator" };
});
assert.equal(result.mode, "bounded-one-pass");
assert.equal(result.configured_agents, 5);
assert.equal(result.concurrency, 2);
assert.ok(peak <= 2);
assert.equal(new Set(seen).size, 5);
assert.equal(result.status, "completed_with_failures");
assert.equal(result.summary.failed, 1);
assert.equal(result.summary.idle, 1);
assert.equal(result.summary.completed, 3);
assert.equal(result.results[4].agent_id, "reporting");
assert.equal(result.results[4].error, "simulated isolated worker failure");

await assert.rejects(() => runJarvisSupervisor({ ...env, JARVIS_WORKER_AGENTS: "coordinator,coordinator" }), /duplicate/);
await assert.rejects(() => runJarvisSupervisor({ ...env, JARVIS_WORKER_AGENTS: "root" }), /Unapproved/);
await assert.rejects(() => runJarvisSupervisor({ ...env, JARVIS_WORKER_CONCURRENCY: "0" }), /between 1 and 5/);
await assert.rejects(() => runJarvisSupervisor({}), /JARVIS_WORKER_AGENTS/);

console.log("[PASS] J.A.R.V.I.S. supervisor bounded concurrency, agent allowlist, isolation, and one-pass contracts.");
