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

for (const gate of ["publicMx", "publicSmtp", "publicSubmission", "publicTls"]) {
  const result = await probes[gate]();
  assert.equal(typeof result.ok, "boolean");
  assert.equal(typeof result.source, "string");
  assert.equal(Number.isNaN(Date.parse(result.verifiedAt)), false);
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
