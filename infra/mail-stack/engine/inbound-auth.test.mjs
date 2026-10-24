import { strict as assert } from "node:assert";
import { evaluateAuthentication } from "./mail-auth-policy.mjs";

const cases = [
  [{ spf: "pass", dkim: "fail", dmarc: { pass: false, record: { policy: "reject" } } }, "accept"],
  [{ spf: "fail", dkim: "pass", dmarc: { pass: false, record: { policy: "reject" } } }, "accept"],
  [{ spf: "fail", dkim: "fail", dmarc: { pass: false, record: { policy: "quarantine" } } }, "quarantine"],
  [{ spf: "fail", dkim: "fail", dmarc: { pass: false, record: { policy: "reject" } } }, "reject"],
  [{ spf: "none", dkim: "none", dmarc: null }, "accept"],
];
for (const [input, expected] of cases) assert.equal(evaluateAuthentication(input).disposition, expected);
console.log("IZAKHONO MAIL inbound anti-spoofing tests PASSED");
