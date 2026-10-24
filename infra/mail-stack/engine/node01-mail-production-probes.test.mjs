import assert from "node:assert/strict";
import { createRealNode01MailProductionProbes } from "./node01-mail-production-probes.mjs";

const probes = createRealNode01MailProductionProbes({
  domain: "example.com",
  mailHost: "example.com",
  externalAcceptance: {
    authenticatedSubmission: async () => ({ ok: true, testId: "auth-1" }),
    inboundPersistence: async () => ({ ok: true, testId: "inbound-1" }),
    outboundAccepted: async () => ({ ok: true, testId: "outbound-1" }),
    replyReceived: async () => ({ ok: true, testId: "reply-1" }),
    identityRouting: async () => ({ ok: true, testId: "identity-1" }),
    securityAuthentication: async () => ({ ok: true, testId: "security-1" }),
  },
});

// Exercise a real public DNS lookup. The network probes themselves are
// deployment-facing and must target the configured NODE01 host, not a test
// fixture pretending to be production.
const mx = await probes.publicMx();
assert.equal(mx.ok, true);
assert.match(mx.source, /^node01-production-probe:publicMx$/);
assert.equal(Number.isNaN(Date.parse(mx.verifiedAt)), false);
assert.ok(Array.isArray(mx.records) && mx.records.length > 0);

for (const gate of ["publicSmtp", "publicSubmission", "publicTls"]) {
  assert.equal(typeof probes[gate], "function");
}

for (const gate of [
  "authenticatedSubmission",
  "inboundPersistence",
  "outboundAccepted",
  "replyReceived",
  "identityRouting",
  "securityAuthentication",
]) {
  const result = await probes[gate]();
  assert.equal(result.ok, true);
  assert.match(result.source, /^node01-production-probe:/);
}

const missingAdapter = createRealNode01MailProductionProbes({ domain: "example.com" });
const blocked = await missingAdapter.authenticatedSubmission();
assert.equal(blocked.ok, false);
assert.equal(blocked.reason, "EXTERNAL_ACCEPTANCE_ADAPTER_REQUIRED");
assert.equal(typeof blocked.source, "string");
assert.equal(Number.isNaN(Date.parse(blocked.verifiedAt)), false);

console.log("NODE01 real production probe tests PASSED");
