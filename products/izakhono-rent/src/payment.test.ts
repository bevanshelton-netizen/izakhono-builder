import { IKhokhaPaymentAdapter } from "./payment";

const adapter = new IKhokhaPaymentAdapter({
  apiBaseUrl: "https://example.invalid",
  websiteKey: "test-key",
  callbackSecret: "test-secret",
});

const accepted = adapter.verifyCallback({
  providerReference: "provider-ref",
  eventId: "event-1",
  status: "paid",
  amount: 100,
  currency: "ZAR",
  rawBody: '{"status":"paid"}',
  signature: "not-a-real-signature",
});

if (accepted) {
  throw new Error("Unsigned/unverified payment callbacks must be rejected");
}

console.log("IZAKHONO RENT payment boundary tests passed");
