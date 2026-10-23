/**
 * IZAKHONO MAIL OUTBOX — durable queue boundary.
 *
 * The application writes the durable Mail Store first, then publishes the
 * delivery job to this boundary. Production uses Postgres/pgmq; tests use the
 * in-memory adapter. The queue payload contains only delivery data required by
 * the worker and can be replayed after a process restart.
 */

export const MAIL_OUTBOX_QUEUE = "izakhono_mail_outbox";

export class MailOutbox {
  constructor({ adapter = new MemoryMailOutboxAdapter() } = {}) {
    this.adapter = adapter;
  }

  async enqueue(job, { delaySeconds = 0 } = {}) {
    if (!job?.message_id) throw new Error("message_id is required");
    if (!job?.event_id) throw new Error("event_id is required");
    return this.adapter.enqueue({
      message_id: job.message_id,
      event_id: job.event_id,
      tenant_id: job.tenant_id,
      app_id: job.app_id,
      kind: job.kind || "transactional",
      envelope: job.envelope,
      accepted_at: job.accepted_at,
    }, { delaySeconds });
  }

  async claim({ visibilitySeconds = 60, quantity = 1 } = {}) {
    return this.adapter.claim({ visibilitySeconds, quantity });
  }

  async ack(messageId) {
    return this.adapter.ack(messageId);
  }

  async retry(messageId, { delaySeconds = 30 } = {}) {
    return this.adapter.retry(messageId, { delaySeconds });
  }

  async archive(messageId) {
    return this.adapter.archive(messageId);
  }
}

/**
 * Adapter for pgmq through an injected SQL executor. The executor is deliberately
 * injected so credentials and database connections stay outside application code.
 */
export class PgmqMailOutboxAdapter {
  constructor({ execute, queueName = MAIL_OUTBOX_QUEUE } = {}) {
    if (typeof execute !== "function") throw new Error("execute is required");
    this.execute = execute;
    this.queueName = queueName;
  }

  async enqueue(message, { delaySeconds = 0 } = {}) {
    const rows = await this.execute(
      "select pgmq.send($1, $2::jsonb, $3) as msg_id",
      [this.queueName, JSON.stringify(message), delaySeconds],
    );
    return rows?.[0]?.msg_id ?? null;
  }

  async claim({ visibilitySeconds = 60, quantity = 1 } = {}) {
    return this.execute(
      "select msg_id, read_ct, enqueued_at, vt, message from pgmq.read($1, $2, $3)",
      [this.queueName, visibilitySeconds, quantity],
    );
  }

  async ack(messageId) {
    const rows = await this.execute(
      "select pgmq.delete($1, $2) as deleted",
      [this.queueName, messageId],
    );
    return Boolean(rows?.[0]?.deleted);
  }

  async retry(messageId, { delaySeconds = 30 } = {}) {
    const rows = await this.execute(
      "select pgmq.set_vt($1, $2, $3) as message",
      [this.queueName, messageId, delaySeconds],
    );
    return rows?.[0]?.message ?? null;
  }

  async archive(messageId) {
    const rows = await this.execute(
      "select pgmq.archive($1, $2) as archived",
      [this.queueName, messageId],
    );
    return Boolean(rows?.[0]?.archived);
  }
}

export class MemoryMailOutboxAdapter {
  constructor() {
    this.messages = new Map();
    this.nextId = 1;
  }

  async enqueue(message, { delaySeconds = 0 } = {}) {
    const msgId = this.nextId++;
    this.messages.set(msgId, { msg_id: msgId, message, availableAt: Date.now() + delaySeconds * 1000, reads: 0 });
    return msgId;
  }

  async claim({ visibilitySeconds = 60, quantity = 1 } = {}) {
    const now = Date.now();
    const rows = [];
    for (const row of this.messages.values()) {
      if (rows.length >= quantity) break;
      if (row.availableAt > now) continue;
      row.reads += 1;
      row.availableAt = now + visibilitySeconds * 1000;
      rows.push({ msg_id: row.msg_id, read_ct: row.reads, message: structuredClone(row.message) });
    }
    return rows;
  }

  async ack(messageId) {
    return this.messages.delete(Number(messageId));
  }

  async retry(messageId, { delaySeconds = 30 } = {}) {
    const row = this.messages.get(Number(messageId));
    if (!row) return null;
    row.availableAt = Date.now() + delaySeconds * 1000;
    return structuredClone(row.message);
  }

  async archive(messageId) {
    return this.ack(messageId);
  }
}
