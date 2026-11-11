import assert from "node:assert/strict";
import test from "node:test";
import { OutboundCallService } from "./outbound-call-service.js";

const uuid = "11111111-1111-4111-8111-111111111111";

test("registers tenant call before submitting it to the carrier", async () => {
  const order: string[] = [];
  const registry = {
    async createOutboundCall(input: { callId: string; tenantId: string }) {
      assert.deepEqual(input, { callId: uuid, tenantId: "tenant-1" });
      order.push("registered");
    },
    async failUnboundOutboundCall() { order.push("failed"); },
  };
  const telephony = {
    async dial(destination: string, callId: string) {
      assert.equal(destination, "+27821234567");
      assert.equal(callId, uuid);
      order.push("dialled");
    },
  };
  const service = new OutboundCallService(registry, telephony, () => uuid);
  const result = await service.placeCall({ tenantId: "tenant-1", destination: "+27821234567" });
  assert.deepEqual(order, ["registered", "dialled"]);
  assert.deepEqual(result, { callId: uuid, status: "submitted" });
});

test("does not contact the carrier if tenant registration fails", async () => {
  let dialled = false;
  const service = new OutboundCallService({
    async createOutboundCall() { throw new Error("tenant disabled"); },
    async failUnboundOutboundCall() {},
  }, {
    async dial() { dialled = true; },
  }, () => uuid);
  await assert.rejects(() => service.placeCall({ tenantId: "tenant-1", destination: "+27821234567" }), /tenant disabled/);
  assert.equal(dialled, false);
});

test("marks the unbound call failed when carrier submission fails", async () => {
  let failed = false;
  const service = new OutboundCallService({
    async createOutboundCall() {},
    async failUnboundOutboundCall(input: { callId: string; tenantId: string }) {
      assert.deepEqual(input, { callId: uuid, tenantId: "tenant-1" });
      failed = true;
    },
  }, {
    async dial() { throw new Error("carrier unavailable"); },
  }, () => uuid);
  await assert.rejects(() => service.placeCall({ tenantId: "tenant-1", destination: "+27821234567" }), /carrier unavailable/);
  assert.equal(failed, true);
});

test("rejects malformed destinations before creating a call", async () => {
  let registered = false;
  const service = new OutboundCallService({
    async createOutboundCall() { registered = true; },
    async failUnboundOutboundCall() {},
  }, { async dial() {} }, () => uuid);
  await assert.rejects(() => service.placeCall({ tenantId: "tenant-1", destination: "0821234567" }), /E.164/);
  assert.equal(registered, false);
});
