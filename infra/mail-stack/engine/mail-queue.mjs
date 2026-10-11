/** IZAKHONO MAIL QUEUE ENGINE — transport-independent delivery queue. */
import crypto from "node:crypto";

export class MailQueue {
  constructor({ store = new Map(), maxAttempts = 8 } = {}) { this.store = store; this.maxAttempts = maxAttempts; }
  enqueue(message, now = new Date().toISOString()) {
    const id = message.id || `q-${crypto.randomUUID()}`;
    if (this.store.has(id)) return this.store.get(id);
    const job = { id, state: "queued", attempts: 0, availableAt: now, createdAt: now, updatedAt: now, message };
    this.store.set(id, job); return job;
  }
  claim(now = new Date().toISOString()) {
    for (const job of this.store.values()) if (job.state === "queued" && job.availableAt <= now) { job.state = "processing"; job.attempts++; job.updatedAt = now; return job; }
    return null;
  }
  ack(id, now = new Date().toISOString()) { const job = this.store.get(id); if (!job) return false; job.state = "delivered"; job.updatedAt = now; return true; }
  retry(id, error, delayMs = 30000, now = new Date().toISOString()) {
    const job = this.store.get(id); if (!job) return false; job.lastError = String(error?.message || error || "unknown error"); job.updatedAt = now;
    if (job.attempts >= this.maxAttempts) job.state = "dead-letter"; else { job.state = "queued"; job.availableAt = new Date(Date.now() + delayMs).toISOString(); }
    return true;
  }
  fail(id, reason, now = new Date().toISOString()) { const job = this.store.get(id); if (!job) return false; job.state = "dead-letter"; job.lastError = String(reason); job.updatedAt = now; return true; }
  snapshot() { const counts = { queued: 0, processing: 0, delivered: 0, "dead-letter": 0 }; for (const job of this.store.values()) counts[job.state] = (counts[job.state] || 0) + 1; return { counts, size: this.store.size }; }
}
