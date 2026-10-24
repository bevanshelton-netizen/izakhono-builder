/**
 * IZAKHONO MAIL WORKER — durable outbox consumer and recovery engine.
 */
import { DELIVERY_EVENTS, createDeliveryEvent, normalizeDeliveryResponse } from "./mail-delivery-events.mjs";

const RETRYABLE_DEFAULT = /timeout|temporar|rate|throttl|unavailable|connection|network|429|502|503|504/i;

export class MailWorker {
  constructor({ outbox, runtime, store, events, clock = () => new Date().toISOString(), visibilitySeconds = 120, retryDelaySeconds = 30, maxAttempts = 8, isRetryable = error => RETRYABLE_DEFAULT.test(String(error?.message || error)) } = {}) {
    if (!outbox) throw new Error("outbox is required");
    if (!runtime || typeof runtime.send !== "function") throw new Error("runtime.send is required");
    if (!store) throw new Error("store is required");
    if (!events) throw new Error("events is required");
    this.outbox = outbox; this.runtime = runtime; this.store = store; this.events = events;
    this.clock = clock; this.visibilitySeconds = visibilitySeconds; this.retryDelaySeconds = retryDelaySeconds;
    this.maxAttempts = maxAttempts; this.isRetryable = isRetryable;
    this.stats = { claimed: 0, accepted: 0, retried: 0, failed: 0, bounced: 0 };
  }

  async processOne() {
    const rows = await this.outbox.claim({ visibilitySeconds: this.visibilitySeconds, quantity: 1 });
    if (!rows?.length) return null;
    const row = rows[0];
    const job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const attempt = Number(row.read_ct || 1);
    this.stats.claimed += 1;
    await this.record(job, DELIVERY_EVENTS.sending, { attempt });

    try {
      const transport = await this.runtime.send(job.envelope, { messageId: job.message_id, idempotencyKey: job.message_id, eventId: job.event_id, tenantId: job.tenant_id, appId: job.app_id, kind: job.kind, attempt });
      const response = normalizeDeliveryResponse(transport?.result || transport || {});
      if (response.bounced) {
        await this.record(job, DELIVERY_EVENTS.bounced, { attempt, response });
        await this.outbox.archive(row.msg_id);
        this.stats.bounced += 1;
        return { id: row.msg_id, message_id: job.message_id, state: "bounced", attempt, response };
      }
      if (response.deferred) throw Object.assign(new Error(response.message || `SMTP ${response.status}`), { retryable: true, response });
      if (!response.accepted) throw Object.assign(new Error(response.message || `MAIL DELIVERY ${response.status}`), { retryable: false, response });
      await this.record(job, DELIVERY_EVENTS.accepted, { attempt, transport, response });
      await this.record(job, DELIVERY_EVENTS.delivered, { attempt, response });
      await this.outbox.ack(row.msg_id); this.stats.accepted += 1;
      return { id: row.msg_id, message_id: job.message_id, state: "accepted", attempt, response };
    } catch (error) {
      const retryable = error?.retryable === true || this.isRetryable(error);
      const terminal = !retryable || attempt >= this.maxAttempts;
      const data = { attempt, retryable, error: String(error?.message || error), response: error?.response || null };
      if (terminal) {
        await this.record(job, DELIVERY_EVENTS.failed, data); await this.outbox.archive(row.msg_id); this.stats.failed += 1;
        return { id: row.msg_id, message_id: job.message_id, state: "failed", attempt, error: data.error };
      }
      await this.record(job, DELIVERY_EVENTS.deferred, data); await this.outbox.retry(row.msg_id, { delaySeconds: this.retryDelaySeconds }); this.stats.retried += 1;
      return { id: row.msg_id, message_id: job.message_id, state: "deferred", attempt, error: data.error };
    }
  }

  async drain({ limit = 100 } = {}) { const results = []; for (let i = 0; i < limit; i += 1) { const result = await this.processOne(); if (!result) break; results.push(result); } return results; }
  health() { return { worker: "izakhono-mail-worker", stats: { ...this.stats }, config: { visibilitySeconds: this.visibilitySeconds, retryDelaySeconds: this.retryDelaySeconds, maxAttempts: this.maxAttempts } }; }
  async record(job, type, data) {
    const event = createDeliveryEvent({ messageId: job.message_id, type, attempt: data.attempt, clock: this.clock, data });
    this.events.append(event);
    await this.store.appendEvent({ id: event.eventId, message_id: event.messageId, tenant_id: job.tenant_id, recipient_id: null, type: event.type, occurred_at: event.occurredAt, data: event.data });
  }
}
