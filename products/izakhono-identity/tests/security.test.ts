import {
  acceptProviderWebhook,
  assertVerificationTransition,
  InvalidVerificationTransitionError,
  RegulaAdapter,
  type WebhookReplayStore,
} from "../src/index.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  let invalidTransition = false;
  try {
    assertVerificationTransition("verified", "in_progress");
  } catch (error) {
    invalidTransition = error instanceof InvalidVerificationTransitionError;
  }
  assert(invalidTransition, "terminal state cannot return to in-progress");

  const adapter = new RegulaAdapter();
  assert(adapter.enabled === false, "Regula must remain disabled by default");
  assert(adapter.capabilities.checks.length === 0, "unverified vendor capabilities must not be advertised");

  const claimed = new Set<string>();
  const replayStore: WebhookReplayStore = {
    async claimOnce(providerId, eventId) {
      const key = providerId + ":" + eventId;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
  };
  const rawBody = JSON.stringify({
    providerId: "test-provider",
    eventId: "event-1",
    occurredAt: "2026-11-20T12:00:00.000Z",
    payload: { status: "verified" },
  });
  const verifier = { async verify() { return true; } };
  const parse = (raw: string) => JSON.parse(raw) as {
    providerId: string; eventId: string; occurredAt: string; payload: { status: string };
  };
  const first = await acceptProviderWebhook(
    rawBody, new Headers(), verifier, replayStore, parse,
    new Date("2026-11-20T12:00:30.000Z"),
  );
  const replay = await acceptProviderWebhook(
    rawBody, new Headers(), verifier, replayStore, parse,
    new Date("2026-11-20T12:00:30.000Z"),
  );
  assert(first?.eventId === "event-1", "valid signed event should be accepted");
  assert(replay === null, "duplicate webhook should be rejected as replay");

  let badSignatureRejected = false;
  try {
    await acceptProviderWebhook(
      rawBody, new Headers(), { async verify() { return false; } },
      replayStore, parse, new Date("2026-11-20T12:00:30.000Z"),
    );
  } catch {
    badSignatureRejected = true;
  }
  assert(badSignatureRejected, "invalid webhook signature must be rejected");

  console.log("IZAKHONO IDENTITY security tests passed");
}

run().catch((error) => {
  console.error(error);
  throw error;
});
