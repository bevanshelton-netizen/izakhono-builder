import { strict as assert } from "node:assert";
import { initialProvisioningState, transition } from "./state-machine";

let state = initialProvisioningState();
state = transition(state, "PAYMENT_CONFIRMED");
assert.equal(state.status, "payment_confirmed");
state = transition(state, "COVERAGE_REQUESTED");
assert.equal(state.status, "coverage_pending");
state = transition(state, "COVERAGE_CONFIRMED");
assert.equal(state.status, "coverage_confirmed");
state = transition(state, "ORDER_SUBMITTED");
assert.equal(state.status, "order_pending");
state = transition(state, "ORDER_ACCEPTED", { providerReference: "OW-123" });
assert.equal(state.status, "service_pending");
assert.equal(state.providerReference, "OW-123");
state = transition(state, "SERVICE_ACTIVE");
assert.equal(state.status, "active");
assert.equal(state.progress, 100);

assert.throws(
  () => transition(state, "PAYMENT_CONFIRMED"),
  /Invalid provisioning transition/,
);

console.log("CONNECT provisioning state-machine tests passed");
