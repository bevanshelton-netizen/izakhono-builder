/**
 * IZAKHONO MAIL STORE — persistence boundary for messages, events and idempotency.
 *
 * The reference adapter is in-memory for deterministic tests. Production can
 * replace it with Supabase/Postgres/D1 without changing the Mail API contract.
 */

export class MailStore {
  constructor({ adapter = new MemoryMailStoreAdapter(), clock = () => new Date().toISOString() } = {}) {
    this.adapter = adapter;
    this.clock = clock;
  }

  async putMessage(message) {
    if (!message?.message_id) throw new Error("message_id is required");
    return this.adapter.putMessage({ ...message, updated_at: message.updated_at || this.clock() });
  }

  async getMessage(messageId, { tenantId } = {}) {
    return this.adapter.getMessage(messageId, tenantId);
  }

  async appendEvent(event) {
    if (!event?.id) throw new Error("event id is required");
    if (!event?.message_id) throw new Error("message_id is required");
    return this.adapter.appendEvent({ ...event, occurred_at: event.occurred_at || this.clock() });
  }

  async listEvents(messageId, { tenantId } = {}) {
    return this.adapter.listEvents(messageId, tenantId);
  }

  async saveIdempotency(scope, key, value) {
    return this.adapter.saveIdempotency(scope, key, value);
  }

  async getIdempotency(scope, key) {
    return this.adapter.getIdempotency(scope, key);
  }

  async deleteIdempotency(scope, key) {
    return this.adapter.deleteIdempotency(scope, key);
  }

  async snapshot() {
    return this.adapter.snapshot();
  }
}

export class MemoryMailStoreAdapter {
  constructor({ messages = new Map(), events = new Map(), idempotency = new Map() } = {}) {
    this.messages = messages;
    this.events = events;
    this.idempotency = idempotency;
  }

  async putMessage(message) {
    this.messages.set(message.message_id, structuredClone(message));
    return structuredClone(message);
  }

  async getMessage(messageId, tenantId) {
    const message = this.messages.get(messageId);
    if (!message || (tenantId && message.tenant_id !== tenantId)) return null;
    return structuredClone(message);
  }

  async appendEvent(event) {
    if (this.events.has(event.id)) return { ...structuredClone(this.events.get(event.id)), duplicate: true };
    this.events.set(event.id, structuredClone(event));
    return structuredClone(event);
  }

  async listEvents(messageId, tenantId) {
    const message = await this.getMessage(messageId, tenantId);
    if (!message) return null;
    return [...this.events.values()]
      .filter((event) => event.message_id === messageId)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
      .map((event) => structuredClone(event));
  }

  async saveIdempotency(scope, key, value) {
    this.idempotency.set(`${scope}:${key}`, structuredClone(value));
  }

  async getIdempotency(scope, key) {
    const value = this.idempotency.get(`${scope}:${key}`);
    return value ? structuredClone(value) : null;
  }

  async deleteIdempotency(scope, key) {
    this.idempotency.delete(`${scope}:${key}`);
  }

  async snapshot() {
    return {
      message_count: this.messages.size,
      event_count: this.events.size,
      idempotency_count: this.idempotency.size,
    };
  }
}
