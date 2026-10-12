import assert from "node:assert/strict";
import { Node01MailOrchestrator, REQUIRED_GATES } from "./node01-mail-orchestrator.mjs";

const runtime = { health: () => ({ queue: { size: 0 }, transports: [] }) };
const server = { start: async () => {}, stop: async () => {} };
const probes = Object.fromEntries(REQUIRED_GATES.map(gate => [gate, async () => ({ ok: true })]));

const orchestrator = new Node01MailOrchestrator({ runtime, server, probes });
const result = await orchestrator.boot();

assert.equal(result.productionReady, true);
assert.equal(result.live, false);
assert.deepEqual(result.failed, []);

const blocked = new Node01MailOrchestrator({ runtime, server, probes: {} });
const blockedResult = await blocked.boot();
assert.equal(blockedResult.productionReady, false);
assert.equal(blockedResult.live, false);
assert.equal(blockedResult.failed.length, REQUIRED_GATES.length);

await orchestrator.shutdown();
console.log("NODE01 production orchestrator gate test PASSED");
