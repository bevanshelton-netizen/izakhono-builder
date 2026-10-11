/** IZAKHONO MAIL RUNTIME — joins processing, queue, mailbox and transport engines. */
import { processMessage } from "../mail-processor.mjs";
import { MailQueue } from "./mail-queue.mjs";
import { MailboxEngine } from "./mailbox-engine.mjs";
import { TransportEngine } from "./transport-engine.mjs";

export class MailRuntime {
  constructor({ registry, queue = new MailQueue(), mailboxes = new MailboxEngine(), transport = new TransportEngine() }) { this.registry = registry; this.queue = queue; this.mailboxes = mailboxes; this.transport = transport; }
  ingest(input) { const processed = processMessage(input, this.registry); if (processed.disposition === "deliver") this.queue.enqueue(processed); else if (processed.disposition === "quarantine") for (const route of processed.routes) this.mailboxes.deliver(route.mailbox, processed, "quarantine"); return processed; }
  async drainOne() {
    const job = this.queue.claim(); if (!job) return null;
    try { const processed = job.message; for (const route of processed.routes || []) this.mailboxes.deliver(route.mailbox, processed, "inbox"); this.queue.ack(job.id); return { id: job.id, state: "delivered" }; }
    catch (error) { this.queue.retry(job.id, error); return { id: job.id, state: "retry", error: String(error?.message || error) }; }
  }
  async send(envelope, context = {}) { return this.transport.send(envelope, context); }
  health() { return { queue: this.queue.snapshot(), transports: this.transport.health() }; }
}
