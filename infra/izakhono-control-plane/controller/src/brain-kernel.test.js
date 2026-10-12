import assert from "node:assert/strict";
import { BrainKernel, evidenceGate, healthPolicy } from "./brain-kernel.js";

const kernel = new BrainKernel({
  registry: [{ id: "core" }, { id: "mail" }],
  policies: {
    core: () => ({ ok: true, recommendation: "proceed" }),
    mail: ({ facts, evidence }) => healthPolicy({ facts, evidence }),
  },
  clock: () => "2026-10-12T00:00:00.000Z",
});

assert.equal(kernel.decide({ brain: "core", intent: "boot" }).state, "completed");
assert.equal(kernel.decide({ brain: "missing", intent: "boot" }).reason, "UNKNOWN_BRAIN");
assert.equal(kernel.decide({ brain: "mail", intent: "go-live", facts: { requiredEvidence: ["smtp", "mx"] }, evidence: [{ type: "smtp" }] }).reason, "MISSING_EVIDENCE");
assert.equal(kernel.decide({ brain: "mail", intent: "go-live", facts: { requiredEvidence: ["smtp"] }, evidence: [{ type: "smtp" }] }).state, "completed");
assert.equal(kernel.decide({ brain: "core", intent: "delete", requestedAction: "delete", reversible: false }).reason, "AUTHORIZATION_REQUIRED");
assert.equal(evidenceGate([{ type: "a" }], ["a"]).ok, true);
assert.equal(kernel.status().brains, 2);

console.log("IZAKHONO Brain Kernel tests PASSED");
