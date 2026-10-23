import { strict as assert } from "node:assert";
import { processConnectPaymentEvent } from "./runtime";

async function run() {
  await assert.rejects(
    () => processConnectPaymentEvent({}, {
      orderId: "",
      externalEventId: "evt_1",
      status: "paid",
    }),
    /Invalid CONNECT payment event: orderId/,
  );

  await assert.rejects(
    () => processConnectPaymentEvent({}, {
      orderId: "order_1",
      externalEventId: "evt_1",
      status: "paid",
      amount: -1,
    }),
    /Invalid CONNECT payment event: amount/,
  );

  await assert.rejects(
    () => processConnectPaymentEvent({}, {
      orderId: "order_1",
      externalEventId: "evt_1",
      status: "paid",
    }),
    /Missing server-side Supabase environment configuration/,
  );

  console.log("connect runtime validation tests passed");
}

void run();
