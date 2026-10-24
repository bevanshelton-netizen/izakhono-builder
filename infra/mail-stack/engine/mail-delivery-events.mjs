/** IZAKHONO MAIL — delivery lifecycle and DSN normalization. */

export const DELIVERY_EVENTS = Object.freeze({
  queued: "mail.queued",
  sending: "mail.sending",
  accepted: "mail.accepted",
  delivered: "mail.delivered",
  deferred: "mail.deferred",
  bounced: "mail.bounced",
  failed: "mail.failed",
});

export function normalizeDeliveryResponse(response = {}) {
  const status = Number(response.status ?? response.code ?? 250);
  const enhanced = String(response.enhancedStatus || response.enhanced || "").trim();
  const message = String(response.message || response.response || "").trim();
  const transient = status >= 400 && status < 500;
  const permanent = status >= 500;
  return {
    status,
    enhancedStatus: enhanced || null,
    message,
    accepted: status >= 200 && status < 300,
    deferred: transient,
    bounced: permanent,
    retryable: transient,
    terminal: permanent,
  };
}

export function createDeliveryEvent({ messageId, type, attempt = 1, clock = () => new Date().toISOString(), data = {} } = {}) {
  if (!messageId || !type) throw new Error("DELIVERY_EVENT_IDENTITY_REQUIRED");
  return {
    eventId: `${messageId}:${type}:${attempt}`,
    messageId,
    type,
    attempt,
    occurredAt: clock(),
    data,
  };
}
