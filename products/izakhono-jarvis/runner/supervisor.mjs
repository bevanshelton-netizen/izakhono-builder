// J.A.R.V.I.S. bounded multi-agent supervisor.
// One invocation processes at most one task per configured agent, then exits.
import { runJarvisWorkerOnce } from "./worker.mjs";

export const JARVIS_WORKER_AGENTS = Object.freeze([
  "coordinator",
  "business-analyst",
  "research-briefing",
  "project-planner",
  "reporting",
]);

function parseAgents(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("JARVIS_WORKER_AGENTS must list one or more approved agent IDs");
  }
  const agents = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (agents.length === 0) throw new Error("JARVIS_WORKER_AGENTS must not be empty");
  if (new Set(agents).size !== agents.length) throw new Error("JARVIS_WORKER_AGENTS contains duplicate agent IDs");
  for (const agent of agents) {
    if (!JARVIS_WORKER_AGENTS.includes(agent)) throw new Error("Unapproved J.A.R.V.I.S. worker agent: " + agent);
  }
  return agents;
}

function parseConcurrency(value, agentCount) {
  if (value === undefined || value === "") return Math.min(agentCount, 3);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > JARVIS_WORKER_AGENTS.length) {
    throw new Error("JARVIS_WORKER_CONCURRENCY must be an integer between 1 and 5");
  }
  return Math.min(parsed, agentCount);
}

export async function runJarvisSupervisor(env = process.env, worker = runJarvisWorkerOnce) {
  const agents = parseAgents(env.JARVIS_WORKER_AGENTS);
  const concurrency = parseConcurrency(env.JARVIS_WORKER_CONCURRENCY, agents.length);
  const results = new Array(agents.length);
  let cursor = 0;

  async function lane() {
    while (true) {
      const index = cursor++;
      if (index >= agents.length) return;
      const agentId = agents[index];
      try {
        results[index] = await worker({ ...env, JARVIS_AGENT_ID: agentId });
      } catch (error) {
        results[index] = {
          status: "failed",
          claimed: false,
          agent_id: agentId,
          error: String(error instanceof Error ? error.message : error).replace(/[\r\n\t]+/g, " ").slice(0, 1000),
        };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => lane()));
  const summary = results.reduce((acc, result) => {
    const status = result?.status || "failed";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  return {
    status: (summary.failed || 0) > 0 ? "completed_with_failures" : "completed",
    mode: "bounded-one-pass",
    configured_agents: agents.length,
    concurrency,
    summary,
    results: results.map((result, index) => ({ agent_id: agents[index], ...result })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runJarvisSupervisor().then((result) => {
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.status === "completed_with_failures") process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.message : error).replace(/[\r\n\t]+/g, " ") + "\n");
    process.exitCode = 1;
  });
}
