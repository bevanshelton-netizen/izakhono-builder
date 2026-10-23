/**
 * IZAKHONO MAIL WORKER — durable outbox consumer and recovery engine.
 *
 * Claims PGMQ jobs, sends through the provider-neutral runtime, records
 * monotonic delivery events, and only removes a queue job after successful
 * transport acceptance. Transient failures remain visible for retry; terminal
 * failures are archived after max attempts.
 */

const RETRYABLE_DEFAULT = /timeout|temporar|rate|throttl|unavailable|connection|network|429|502|503|504/i;

export class MailWorker {
  constructor({
    outbox,
    runtime,
    store,
    events,
    clock = () => new Date().toISOString(),
    visibilitySeconds = 120,
    retryDelaySeconds = 30,
    maxAttempts = 8,
    isRetryable = (error) => RETRYABLE_DEFAULT.test(String(error?.message || error)),
  } = {}) {
    if (!outbox) throw new Error("outbox is required");
    if (!runtime || typeof runtime.send !== "function") throw new Error("runtime.send is required");
    if (!store) throw new Error("store is required");
    if (!events) throw new Error("events is required");
    this.outbox = outbox;
    this.runtime = runtime;
    this.store = store;
    this.events = events;
    this.clock = clock;
    this.visibilitySeconds = visibilitySeconds;
    this.retryDelaySeconds = retryDelaySeconds;
    this.maxAttempts = maxAttempts;
    this.isRetryable = isRetryable;
    this.stats = { claimed: 0, accepted: 0, retried: 0, failed: 0 };
  }

  async processOne() {
    const rows = await this.outbox.claim({ visibilitySeconds: this.visibilitySeconds, quantity: 1 });
    if (!rows?.length) return null;

    const row = rows[0];
    const job = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const attempt = Number(row.read_ct || 1);
    this.stats.claimed += 1;

    await this.record(job, "mail.sending", { attempt });

    try {
      const result = await this.runtime.send(job.envelope, {
        messageId: job.message_id,
        idempotencyKey: job.message_id,
        eventId: job.event_id,
        tenantId: job.tenant_id,
        appId: job.app_id,
        kind: job.kind,
        attempt,
      });

      await this.record(job, "mail.accepted", { attempt, transport: result || null });
      await this.outbox.ack(row.msg_id);
      this.stats.accepted += 1;
      return { id: row.msg_id, message_id: job.message_id, state: "accepted", attempt };
    } catch (error) {
      const retryable = this.isRetryable(error);
      const terminal = !retryable || attempt >= this.maxAttempts;
      const data = { attempt, retryable, error: String(error?.message || error) };

      if (terminal) {
        await this.record(job, "mail.failed", data);
        await this.outbox.archive(row.msg_id);
        this.stats.failed += 1;
        return { id: row.msg_id, message_id: job.message_id, state: "failed", attempt, error: data.error };
      }

      await this.record(job, "mail.deferred", data);
      await this.outbox.retry(row.msg_id, { delaySeconds: this.retryDelaySeconds });
      this.stats.retried += 1;
      return { id: row.msg_id, message_id: job.message_id, state: "deferred", attempt, error: data.error };
    }
  }

  async drain({ limit = 100 } = {}) {
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      const result = await this.processOne();
      if (!result) break;
      results.push(result);
    }
    return results;
  }

  health() {
    return { worker: "izakhono-mail-worker", stats: { ...this.stats }, config: { visibilitySeconds: this.visibilitySeconds, retryDelaySeconds: this.retryDelaySeconds, maxAttempts: this.maxAttempts } };
  }

  async record(job, type, data) {
    const event = {
      eventId: `${job.event_id}:${type}:${data.attempt}`,
      messageId: job.message_id,
      type,
      occurredAt: this.clock(),
      data,
    };
    this.events.append(event);
    await this.store.appendEvent({
      id: event.eventId,
      message_id: event.messageId,
      tenant_id: job.tenant_id,
      recipient_id: null,
      type: event.type,
      occurred_at: event.occurredAt,
      data: event.data,
    });
  }
}
