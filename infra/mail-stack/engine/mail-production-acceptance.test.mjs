import assert from "node:assert/strict";
import { PRODUCTION_ACCEPTANCE_GATES, evaluateProductionAcceptance, assertProductionAcceptance } from "./mail-production-acceptance.mjs";

const now = new Date().toISOString();
const evidence = Object.fromEntries(PRODUCTION_ACCEPTANCE_GATES.map(gate => [gate, { ok: true, source: `test:${gate}`, verifiedAt: now }]));

const accepted = evaluateProductionAcceptance(evidence);
assert.equal(accepted.productionReady, true);
assert.equal(accepted.live, true);
assert.deepEqual(accepted.failed, []);
assert.equal(Object.keys(accepted.checks).length, PRODUCTION_ACCEPTANCE_GATES.length);
assert.doesNotThrow(() => assertProductionAcceptance(accepted));

const blockedEvidence = { ...evidence };
delete blockedEvidence.replyReceived;
const blocked = evaluateProductionAcceptance(blockedEvidence);
assert.equal(blocked.productionReady, false);
assert.equal(blocked.live, false);
assert.ok(blocked.failed.includes("replyReceived"));
assert.throws(() => assertProductionAcceptance(blocked), /MAIL_PRODUCTION_ACCEPTANCE_REQUIRED/);

const forged = { ...evidence, publicMx: { ok: true } };
const forgedResult = evaluateProductionAcceptance(forged);
assert.equal(forgedResult.productionReady, false);
assert.equal(forgedResult.live, false);
assert.ok(forgedResult.failed.includes("publicMx"));

console.log("IZAKHONO MAIL production acceptance tests PASSED");
