import { strict as assert } from "node:assert";
import { executeProviderProvisioning } from "./provider-execution";
import { initialProvisioningState, transition } from "./state-machine";
import type { ProviderAdapter } from "../adapters/openweb/types";

const baseState = transition(initialProvisioningState(), "PAYMENT_CONFIRMED");

function adapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: "TEST",
    mode: "api",
    status: "active",
    capabilities: ["coverage", "quote", "create_order", "order_status", "cancel_order"],
    coverage: async () => ({ ok: true, provider: "TEST", capability: "coverage", data: { available: true } }),
    quote: async () => ({ ok: true, provider: "TEST", capability: "quote", data: {} }),
    createOrder: async () => ({ ok: true, provider: "TEST", capability: "create_order", data: { providerReference: "123" } }),
    orderStatus: async () => ({ ok: true, provider: "TEST", capability: "order_status", data: { status: "active" } }),
    cancelOrder: async () => ({ ok: true, provider: "TEST", capability: "cancel_order", data: {} }),
    ...overrides,
  };
}

const input = {
  state: baseState,
  coverage: { address: "1 Test Street" },
  order: { productCode: "CONNECT_TEST", customer: { name: "Test", email: "test@example.com" }, serviceAddress: "1 Test Street" },
};

async function run() {
  const active = await executeProviderProvisioning({ ...input, adapter: adapter() });
  assert.equal(active.state.status, "active");
  assert.equal(active.state.providerReference, "123");

  const unavailable = await executeProviderProvisioning({
    ...input,
    adapter: adapter({ coverage: async () => ({ ok: false, provider: "TEST", capability: "coverage", code: "PROVIDER_ERROR", message: "coverage unavailable" }) }),
  });
  assert.equal(unavailable.state.status, "blocked");

  const noReference = await executeProviderProvisioning({
    ...input,
    adapter: adapter({ createOrder: async () => ({ ok: true, provider: "TEST", capability: "create_order", data: { accepted: true } }) }),
  });
  assert.equal(noReference.state.status, "blocked");

  const notActive = await executeProviderProvisioning({
    ...input,
    adapter: adapter({ orderStatus: async () => ({ ok: true, provider: "TEST", capability: "order_status", data: { status: "pending" } }) }),
  });
  assert.equal(notActive.state.status, "blocked");

  console.log("connect provider execution tests passed");
}

void run();
