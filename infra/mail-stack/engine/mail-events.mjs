/**
 * IZAKHONO MAIL EVENTS — provider-neutral event ledger and delivery state.
 *
 * The store is injected so production can use D1/Postgres/etc. without
 * changing the event contract. Events are at-least-once safe: duplicate
 * event IDs are ignored, while message state transitions are monotonic.
 */

const TERMINAL = new Set(["delivered", "bounced", "rejected", "failed"]);
const RANK = {
  queued: 10,
  sending: 20,
  accepted: 30,
  deferred: 35,
  delivered: 100,
  bounced: 100,
  rejected: 100,
  failed: 100,
};

export const MAIL_EVENT_TYPES = Object.freeze([
  "mail.queued",
  "mail.sending",
  "mail.accepted",
  "mail.deferred",
  "mail.delivered",
  "mail.bounced",
  "mail.rejected",
  "mail.failed",
]);

export class MailEventLedger {
  constructor({ events = new Map(), messages = new Map(), clock = () => new Date().toISOString() } = {}) {
    this.events = events;
    this.messages = messages;
    this.clock = clock;
  }

  append({ eventId, messageId, recipientId = null, type, data = {}, occurredAt = this.clock() }) {
    if (!eventId) throw new Error("eventId is required");
    if (!messageId) throw new Error("messageId is required");
    if (!MAIL_EVENT_TYPES.includes(type)) throw new Error(`unsupported event type: ${type}`);
    if (this.events.has(eventId)) return { ...this.events.get(eventId), duplicate: true };

    const event = { id: eventId, type, message_id: messageId, recipient_id: recipientId, occurred_at: occurredAt, data };
    this.events.set(eventId, event);
    this.applyState(messageId, stateFromEvent(type), event);
    return event;
  }

  applyState(messageId, state, event = null) {
    if (!RANK[state]) throw new Error(`unsupported state: ${state}`);
    const current = this.messages.get(messageId);
    if (current && RANK[state] < RANK[current.status]) return current;
    if (current && TERMINAL.has(current.status) && current.status !== state) return current;
    const next = { message_id: messageId, status: state, updated_at: event?.occurred_at || this.clock(), last_event_id: event?.id || current?.last_event_id || null };
    this.messages.set(messageId, next);
    return next;
  }

  getMessage(messageId) { return this.messages.get(messageId) || null; }
  listEvents(messageId) { return [...this.events.values()].filter((event) => event.message_id === messageId).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)); }
  snapshot() { return { event_count: this.events.size, message_count: this.messages.size }; }
}

function stateFromEvent(type) {
  return type.slice("mail.".length);
}

export function normalizeDeliveryEvent(input) {
  return {
    eventId: input.eventId || input.id,
    messageId: input.messageId || input.message_id,
    recipientId: input.recipientId || input.recipient_id || null,
    type: input.type || input.event_type,
    occurredAt: input.occurredAt || input.occurred_at || new Date().toISOString(),
    data: input.data || {},
  };
}
