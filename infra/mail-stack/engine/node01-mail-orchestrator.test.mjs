import assert from "node:assert/strict";
import {
  Node01MailOrchestrator,
  REQUIRED_GATES,
  PRODUCTION_ACCEPTANCE_GATES,
} from "./node01-mail-orchestrator.mjs";

const runtime = { health: () => ({ queue: { size: 0 }, transports: [] }) };
const server = { start: async () => {}, stop: async () => {} };
const now = () => new Date().toISOString();
const probes = Object.fromEntries(REQUIRED_GATES.map(gate => [gate, async () => ({
  ok: true,
  source: `test:${gate}`,
  verifiedAt: now(),
})]));
const productionProbes = Object.fromEntries(PRODUCTION_ACCEPTANCE_GATES.map(gate => [gate, async () => ({
  ok: true,
  source: `test:production:${gate}`,
  verifiedAt: now(),
})]));

// Technical readiness alone is not enough to declare NODE01 production-ready.
const technicalOnly = new Node01MailOrchestrator({ runtime, server, probes });
const technicalOnlyResult = await technicalOnly.boot();
assert.equal(technicalOnlyResult.technicalReady, true);
assert.equal(technicalOnlyResult.productionReady, false);
assert.equal(technicalOnlyResult.live, false);
assert.ok(technicalOnlyResult.failed.every(gate => gate.startsWith("production:")));
assert.equal(technicalOnlyResult.productionAcceptance.failed.length, PRODUCTION_ACCEPTANCE_GATES.length);

// With independent evidence for every production gate, the orchestrator can
// make the final production decision. This is synthetic unit-test evidence;
// real deployment still requires real public end-to-end probes.
const orchestrator = new Node01MailOrchestrator({ runtime, server, probes, productionProbes });
const result = await orchestrator.boot();
assert.equal(result.technicalReady, true);
assert.equal(result.productionReady, true);
assert.equal(result.live, true);
assert.deepEqual(result.failed, []);
assert.equal(Object.keys(result.checks).length, REQUIRED_GATES.length);
assert.equal(Object.keys(result.productionAcceptance.checks).length, PRODUCTION_ACCEPTANCE_GATES.length);
assert.equal(result.checks.smtp.source, "test:smtp");
assert.equal(result.productionAcceptance.checks.replyReceived.source, "test:production:replyReceived");

// Evidence-free/fabricated technical probes remain blocked.
const unverified = { ...probes, smtp: async () => ({ ok: true }) };
const unverifiedOrchestrator = new Node01MailOrchestrator({
  runtime,
  server,
  probes: unverified,
  productionProbes,
});
const unverifiedResult = await unverifiedOrchestrator.boot();
assert.equal(unverifiedResult.productionReady, false);
assert.equal(unverifiedResult.live, false);
assert.equal(unverifiedResult.checks.smtp.reason, "INVALID_PROBE_EVIDENCE");
assert.ok(unverifiedResult.failed.includes("smtp"));

// One missing production gate blocks the final decision even when every
// technical gate remains healthy.
const missingReply = { ...productionProbes };
delete missingReply.replyReceived;
const blockedProduction = new Node01MailOrchestrator({
  runtime,
  server,
  probes,
  productionProbes: missingReply,
});
const blockedProductionResult = await blockedProduction.boot();
assert.equal(blockedProductionResult.technicalReady, true);
assert.equal(blockedProductionResult.productionReady, false);
assert.equal(blockedProductionResult.live, false);
assert.ok(blockedProductionResult.failed.includes("production:replyReceived"));

// No technical or production probes means no readiness and no LIVE claim.
const blocked = new Node01MailOrchestrator({ runtime, server, probes: {} });
const blockedResult = await blocked.boot();
assert.equal(blockedResult.productionReady, false);
assert.equal(blockedResult.live, false);
assert.equal(blockedResult.failed.length, REQUIRED_GATES.length + PRODUCTION_ACCEPTANCE_GATES.length);

await orchestrator.shutdown();
console.log("NODE01 production orchestrator acceptance authority test PASSED");
