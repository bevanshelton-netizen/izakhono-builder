import assert from "node:assert/strict";
import { getJarvisAgent, listJarvisAgents } from "./agents";

const agents = listJarvisAgents();
assert.equal(agents.length, 5);
assert.deepEqual(agents.map((agent) => agent.id), [
  "coordinator",
  "business-analyst",
  "research-briefing",
  "project-planner",
  "reporting",
]);
for (const agent of agents) {
  assert.ok(agent.purpose.length > 20);
  assert.ok(agent.responsibilities.length > 0);
  assert.ok(agent.boundaries.length > 0);
  assert.equal(agent.requiresOwnerApproval, true);
}
assert.equal(getJarvisAgent("business-analyst")?.name, "Business Analyst");
assert.equal(getJarvisAgent("unknown-agent"), undefined);
assert.equal(getJarvisAgent("coordinator")?.boundaries.some((item) => /external actions/i.test(item)), true);
console.log("J.A.R.V.I.S. agent registry tests passed");
