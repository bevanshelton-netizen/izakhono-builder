import assert from "node:assert/strict";
import { createMailJob, validateSendRequest, transition, DELIVERY_STATES_LIST } from "./mail-contract.mjs";

const request = validateSendRequest({
  app: "izakhono-pay",
  template: "payment-success",
  to: [{ email: "Customer@Example.com", name: "Customer" }],
  data: { amount: "R1,250.00", reference: "PAY-123" },
  metadata: { tenantId: "tenant_123" },
  idempotencyKey: "PAY-123",
});

assert.equal(request.to[0].email, "customer@example.com");
assert.equal(request.app, "izakhono-pay");
assert.equal(request.template, "payment-success");
assert.match(request.eventId, /^izm-[a-f0-9]{32}$/);

const job = createMailJob(request);
assert.equal(job.state, "queued");
assert.equal(job.type, "email.send");
assert.equal(transition(job, "rendering").state, "rendering");
assert.ok(DELIVERY_STATES_LIST.includes("delivered"));

assert.throws(() => validateSendRequest({ app: "izakhono-pay", template: "welcome", to: [] }), /NO_RECIPIENTS/);
assert.throws(() => validateSendRequest({ app: "izakhono-pay", template: "welcome", to: ["bad"] }), /INVALID_EMAIL/);
assert.throws(() => validateSendRequest({ app: "izakhono-pay", template: "welcome", to: ["a@example.com"], channel: "sms" }), /UNSUPPORTED_CHANNEL/);

console.log("mail-contract: ok");
