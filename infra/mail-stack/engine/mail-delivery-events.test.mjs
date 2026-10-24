import assert from "node:assert/strict";
import { createDeliveryEvent, normalizeDeliveryResponse } from "./mail-delivery-events.mjs";

assert.deepEqual(normalizeDeliveryResponse({ status: 250, message: "accepted" }), {
  status: 250, enhancedStatus: null, message: "accepted", accepted: true, deferred: false, bounced: false, retryable: false, terminal: false,
});
assert.equal(normalizeDeliveryResponse({ status: 451, enhancedStatus: "4.3.0", message: "temporary failure" }).retryable, true);
assert.equal(normalizeDeliveryResponse({ status: 550, enhancedStatus: "5.1.1", message: "user unknown" }).bounced, true);
const event = createDeliveryEvent({ messageId: "m-1", type: "mail.bounced", attempt: 2, clock: () => "2026-01-01T00:00:00.000Z", data: { status: 550 } });
assert.equal(event.eventId, "m-1:mail.bounced:2");
assert.equal(event.occurredAt, "2026-01-01T00:00:00.000Z");
console.log("IZAKHONO delivery event tests PASSED");
