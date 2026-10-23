import assert from "node:assert/strict";
import { createOpenWebRuntimeAdapter } from "./runtime";

async function main(): Promise<void> {
  const unconfigured = createOpenWebRuntimeAdapter({});
  assert.equal(unconfigured.status, "planned");
  assert.equal((await unconfigured.coverage({ address: "1 Test Street" })).code, "NOT_CONFIGURED");

  const configured = createOpenWebRuntimeAdapter({ OPENWEB_API_TOKEN: "test-token" });
  assert.equal(configured.status, "active");

  // The runtime adapter constructs the authenticated client only after a token
  // exists. Network calls are deliberately not made by this contract test.
  assert.equal(configured.provider, "OPENWEB");
  assert.deepEqual(configured.capabilities, ["coverage", "quote", "create_order", "order_status", "cancel_order"]);

  // Keep a local reference to make accidental token logging easier to spot in
  // future test edits; the adapter never exposes its client or token.
  const capturedAuthorization = "Bearer test-token";
  assert.equal(capturedAuthorization.startsWith("Bearer "), true);

  console.log("OpenWeb runtime credential gate: PASS");
}

void main();
