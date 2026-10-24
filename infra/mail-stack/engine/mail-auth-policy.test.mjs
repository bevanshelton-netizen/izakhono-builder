import { strict as assert } from "node:assert";
import { evaluateAuthentication, parseDmarcRecord, shouldRejectAuthentication } from "./mail-auth-policy.mjs";

const reject = parseDmarcRecord("v=DMARC1; p=reject; rua=mailto:dmarc@example.test");
assert.equal(reject.policy, "reject");

const pass = evaluateAuthentication({ spf: "pass", dkim: "fail", dmarc: { pass: false, record: reject }, fromDomain: "example.test" });
assert.equal(pass.authenticated, true);
assert.equal(pass.disposition, "accept");

const blocked = evaluateAuthentication({ spf: "fail", dkim: "fail", dmarc: { pass: false, record: reject }, fromDomain: "example.test" });
assert.equal(blocked.authenticated, false);
assert.equal(blocked.disposition, "reject");
assert.equal(shouldRejectAuthentication(blocked), true);

const quarantined = evaluateAuthentication({ spf: "fail", dkim: "fail", dmarc: { pass: false, record: { policy: "quarantine" } } });
assert.equal(quarantined.disposition, "quarantine");

console.log("IZAKHONO MAIL authentication policy tests PASSED");
