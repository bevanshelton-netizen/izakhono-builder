import assert from "node:assert/strict";
import { loadBrainRegistry } from "./brain-registry.js";
import { BrainKernel, healthPolicy } from "./brain-kernel.js";

const registry = loadBrainRegistry();
assert.equal(registry.brains.length, 23);
assert.ok(registry.brains.some(brain => brain.id === "mail"));

const kernel = new BrainKernel({
  registry: registry.brains,
  policies: Object.fromEntries(registry.brains.map(brain => [brain.id, healthPolicy])),
});

assert.equal(kernel.status().brains, 23);
assert.equal(
  kernel.decide({ brain: "mail", intent: "go-live", facts: { live: true, health: "degraded" } }).reason,
  "LIVE_WITHOUT_HEALTH"
);
assert.equal(
  kernel.decide({ brain: "mail", intent: "send", requestedAction: "send-message", reversible: false }).reason,
  "AUTHORIZATION_REQUIRED"
);
assert.equal(
  kernel.decide({ brain: "mail", intent: "go-live", facts: { live: true, health: "healthy" }, evidence: [] }).state,
  "completed"
);

console.log("IZAKHONO Brain Fabric integration tests PASSED");
