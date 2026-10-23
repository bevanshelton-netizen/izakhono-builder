import assert from "node:assert/strict";
import test from "node:test";
import { confirmPaymentIdempotently } from "./idempotent-payment";
import type { ConnectProvisioningRepository, PaymentEvent, ProvisioningRecord } from "./orchestrator";
import type { ProvisioningState } from "./state-machine";

const event: PaymentEvent = {
  orderId: "order-1",
  externalEventId: "evt-1",
  status: "paid",
  amount: 599,
  currency: "ZAR",
};

function provisioning(): ProvisioningRecord {
  const state: ProvisioningState = {
    status: "payment_confirmed",
    currentStep: "payment",
    progress: 20,
  };
  return { id: "prov-1", orderId: event.orderId, state };
}

test("returns canonical provisioning record after a unique-constraint race", async () => {
  let recorded = false;
  const repository: ConnectProvisioningRepository = {
    async findPaymentEvent() {
      return recorded ? event : null;
    },
    async recordPaymentEvent() {
      recorded = true;
      const error = new Error("duplicate key") as Error & { code: string };
      error.code = "23505";
      throw error;
    },
    async getProvisioning() {
      return recorded ? provisioning() : null;
    },
    async createProvisioning() {
      throw new Error("must not create after race");
    },
    async updateProvisioning() {},
  };

  const result = await confirmPaymentIdempotently(repository, event);
  assert.equal(result.duplicate, true);
  assert.equal(result.provisioning.id, "prov-1");
});

test("does not swallow unrelated provider/database errors", async () => {
  const repository: ConnectProvisioningRepository = {
    async findPaymentEvent() { return null; },
    async recordPaymentEvent() { throw new Error("database unavailable"); },
    async getProvisioning() { return null; },
    async createProvisioning() { throw new Error("unreachable"); },
    async updateProvisioning() {},
  };

  await assert.rejects(
    () => confirmPaymentIdempotently(repository, event),
    /database unavailable/,
  );
});
