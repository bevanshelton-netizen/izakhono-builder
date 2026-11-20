export interface VerifiedWebhookEnvelope<T = unknown> {
  providerId: string;
  eventId: string;
  occurredAt: string;
  payload: T;
}

export interface WebhookSignatureVerifier {
  verify(rawBody: string, headers: Headers): Promise<boolean>;
}

export interface WebhookReplayStore {
  /** Atomically claim an event ID; false means it was already claimed. */
  claimOnce(providerId: string, eventId: string, processedAt: string): Promise<boolean>;
}

export class WebhookRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookRejectedError";
  }
}

/** Provider-neutral gate. Implement signature verification from the vendor's current specification. */
export async function acceptProviderWebhook<T>(
  rawBody: string,
  headers: Headers,
  envelope: VerifiedWebhookEnvelope<T>,
  verifier: WebhookSignatureVerifier,
  replayStore: WebhookReplayStore,
  now = new Date(),
  maxAgeMs = 5 * 60 * 1000,
): Promise<boolean> {
  if (!rawBody || !envelope.providerId || !envelope.eventId) {
    throw new WebhookRejectedError("Webhook envelope is incomplete");
  }
  const occurredAt = new Date(envelope.occurredAt);
  if (!Number.isFinite(occurredAt.getTime()) || Math.abs(now.getTime() - occurredAt.getTime()) > maxAgeMs) {
    throw new WebhookRejectedError("Webhook timestamp is outside the accepted window");
  }
  if (!(await verifier.verify(rawBody, headers))) {
    throw new WebhookRejectedError("Webhook signature is invalid");
  }
  return replayStore.claimOnce(envelope.providerId, envelope.eventId, now.toISOString());
}
