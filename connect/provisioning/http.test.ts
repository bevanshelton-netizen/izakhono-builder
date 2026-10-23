import { strict as assert } from "node:assert";
import { handleConnectPaymentRequest } from "./http";

async function run() {
  const env = {
    CONNECT_PAYMENT_WEBHOOK_SECRET: "test-secret",
  };

  const get = await handleConnectPaymentRequest(
    new Request("https://connect.test/payment", { method: "GET" }),
    env,
  );
  assert.equal(get.status, 405);

  const unauthorized = await handleConnectPaymentRequest(
    new Request("https://connect.test/payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: "order_1", externalEventId: "evt_1", status: "paid" }),
    }),
    env,
  );
  assert.equal(unauthorized.status, 401);

  const invalidType = await handleConnectPaymentRequest(
    new Request("https://connect.test/payment", {
      method: "POST",
      headers: { "x-izakhono-connect-secret": "test-secret" },
      body: "{}",
    }),
    env,
  );
  assert.equal(invalidType.status, 415);

  const invalidJson = await handleConnectPaymentRequest(
    new Request("https://connect.test/payment", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-izakhono-connect-secret": "test-secret",
      },
      body: "not-json",
    }),
    env,
  );
  assert.equal(invalidJson.status, 400);

  const missingSupabase = await handleConnectPaymentRequest(
    new Request("https://connect.test/payment", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-izakhono-connect-secret": "test-secret",
      },
      body: JSON.stringify({ orderId: "order_1", externalEventId: "evt_1", status: "paid" }),
    }),
    env,
  );
  assert.equal(missingSupabase.status, 503);

  console.log("connect payment HTTP boundary tests passed");
}

void run();
