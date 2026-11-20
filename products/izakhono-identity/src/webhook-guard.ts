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

/**
 * Verify the exact raw bytes before parsing the envelope. The parser must
 * derive every envelope field from the signed raw body, never from headers
 * or separately supplied client values.
 */
export async function acceptProviderWebhook<T>(
  rawBody: string,
  headers: Headers,
  verifier: WebhookSignatureVerifier,
  replayStore: WebhookReplayStore,
  parseSignedBody: (rawBody: string) => VerifiedWebhookEnvelope<T>,
  now = new Date(),
  maxAgeMs = 5 * 60 * 1000,
): Promise<VerifiedWebhookEnvelope<T> | null> {
  if (!rawBody) throw new WebhookRejectedError("Webhook body is empty");
  if (!(await verifier.verify(rawBody, headers))) {
    throw new WebhookRejectedError("Webhook signature is invalid");
  }
  const envelope = parseSignedBody(rawBody);
  if (!envelope.providerId || !envelope.eventId) {
    throw new WebhookRejectedError("Webhook envelope is incomplete");
  }
  const occurredAt = new Date(envelope.occurredAt);
  if (!Number.isFinite(occurredAt.getTime()) || Math.abs(now.getTime() - occurredAt.getTime()) > maxAgeMs) {
    throw new WebhookRejectedError("Webhook timestamp is outside the accepted window");
  }
  const claimed = await replayStore.claimOnce(envelope.providerId, envelope.eventId, now.toISOString());
  return claimed ? envelope : null;
}
