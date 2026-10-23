import assert from "node:assert/strict";
import { Node01MailOrchestrator, REQUIRED_GATES } from "./node01-mail-orchestrator.mjs";

const runtime = { health: () => ({ queue: { size: 0 }, transports: [] }) };
const server = { start: async () => {}, stop: async () => {} };
const now = () => new Date().toISOString();
const probes = Object.fromEntries(REQUIRED_GATES.map(gate => [gate, async () => ({
  ok: true,
  source: `test:${gate}`,
  verifiedAt: now(),
})]));

const orchestrator = new Node01MailOrchestrator({ runtime, server, probes });
const result = await orchestrator.boot();

assert.equal(result.productionReady, true);
assert.equal(result.live, false);
assert.deepEqual(result.failed, []);
assert.equal(Object.keys(result.checks).length, REQUIRED_GATES.length);
assert.equal(result.checks.smtp.source, "test:smtp");

const unverified = { ...probes, smtp: async () => ({ ok: true }) };
const unverifiedOrchestrator = new Node01MailOrchestrator({ runtime, server, probes: unverified });
const unverifiedResult = await unverifiedOrchestrator.boot();
assert.equal(unverifiedResult.productionReady, false);
assert.equal(unverifiedResult.checks.smtp.reason, "INVALID_PROBE_EVIDENCE");
assert.ok(unverifiedResult.failed.includes("smtp"));

const blocked = new Node01MailOrchestrator({ runtime, server, probes: {} });
const blockedResult = await blocked.boot();
assert.equal(blockedResult.productionReady, false);
assert.equal(blockedResult.live, false);
assert.equal(blockedResult.failed.length, REQUIRED_GATES.length);

await orchestrator.shutdown();
console.log("NODE01 production orchestrator evidence gate test PASSED");
