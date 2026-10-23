import assert from "node:assert/strict";
import {
  readNode01MailReadiness,
  readNode01MailEvidence,
  assertNode01MailProductionReady,
} from "./node01-mail-bridge.js";

const orchestrator = {
  async readiness() {
    return {
      productionReady: true,
      live: false,
      failed: [],
      verifiedAt: "2026-10-23T20:00:00.000Z",
      checks: Object.fromEntries([
        "runtime", "smtp", "submission", "dnsMx", "spf", "dkim", "dmarc",
        "tls", "inbound", "outbound", "reply", "persistence", "identities",
      ].map(gate => [gate, { ok: true }])),
    };
  },
};

const readiness = await readNode01MailReadiness(orchestrator);
assert.equal(readiness.productionReady, true);

const evidence = await readNode01MailEvidence(orchestrator);
assert.equal(evidence.type, "node01-mail-readiness");
assert.equal(evidence.source, "node01-mail-orchestrator");
assert.equal(evidence.live, false);
assert.equal(Object.keys(evidence.checks).length, 13);
assert.equal(assertNode01MailProductionReady(evidence), true);

await assert.rejects(
  () => readNode01MailReadiness(null),
  /NODE01_MAIL_ORCHESTRATOR_REQUIRED/
);

assert.throws(
  () => assertNode01MailProductionReady({
    type: "node01-mail-readiness",
    productionReady: false,
    failed: ["tls"],
  }),
  /NODE01_MAIL_NOT_PRODUCTION_READY:tls/
);

console.log("NODE01 MAIL bridge tests PASSED");
