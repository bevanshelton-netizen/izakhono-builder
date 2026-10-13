import assert from "node:assert/strict";
import { BrainKernel } from "./brain-kernel.js";
import { loadBrainRegistry } from "./brain-registry.js";
import { mailBrainPolicy, mailReadinessEvidence, NODE01_MAIL_GATES } from "./mail-brain.js";

const registry = loadBrainRegistry();
const kernel = new BrainKernel({ registry: registry.brains, policies: { mail: mailBrainPolicy } });
const allChecks = Object.fromEntries(NODE01_MAIL_GATES.map(gate => [gate, { ok: true }]));
const ready = { productionReady: true, live: false, checks: allChecks, verifiedAt: "2026-10-13T00:00:00.000Z" };
const readyEvidence = mailReadinessEvidence(ready);

assert.equal(readyEvidence.gates.passed.length, 13);
assert.equal(kernel.decide({ brain: "mail", intent: "go-live", evidence: [readyEvidence] }).state, "completed");
for (const gate of NODE01_MAIL_GATES) {
  const checks = { ...allChecks, [gate]: { ok: false, reason: "TEST_FAILURE" } };
  const result = kernel.decide({ brain: "mail", intent: "go-live", evidence: [mailReadinessEvidence({ productionReady: false, checks })] });
  assert.equal(result.state, "blocked");
  assert.equal(result.reason, "NODE01_MAIL_GATE_FAILED");
}
assert.equal(kernel.decide({ brain: "mail", intent: "go-live", evidence: [] }).reason, "NODE01_MAIL_READINESS_REQUIRED");
assert.equal(kernel.decide({ brain: "mail", intent: "go-live", evidence: [readyEvidence], requestedAction: "enable-public-mail", reversible: false }).reason, "AUTHORIZATION_REQUIRED");
assert.equal(kernel.decide({ brain: "mail", intent: "go-live", facts: { requireLive: true }, evidence: [readyEvidence] }).reason, "NODE01_MAIL_NOT_LIVE");

console.log("IZAKHONO MAIL BRAIN integration tests PASSED");
