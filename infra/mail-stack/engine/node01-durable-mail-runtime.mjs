/**
 * IZAKHONO MAIL — NODE01 durable runtime facade.
 *
 * Keeps the existing transport-independent runtime while making mailbox and
 * queue state survive process restarts. Persistence is intentionally isolated
 * behind the NODE01 storage adapters so the mail engines remain replaceable.
 */
import { MailRuntime } from "./mail-runtime.mjs";
import { MailQueue } from "./mail-queue.mjs";
import { MailboxEngine } from "./mailbox-engine.mjs";
import { Node01MailboxStore, Node01QueueStore } from "./node01-storage.mjs";

function restoreQueue(store) {
  return new Map(Object.entries(store.load() || {}));
}

function restoreMailboxes(store) {
  return new Map((store.list() || []).map(mailbox => [mailbox.address, mailbox]));
}

export class Node01DurableMailRuntime extends MailRuntime {
  constructor({ registry, mailboxStore = new Node01MailboxStore(), queueStore = new Node01QueueStore(), transport, maxAttempts = 8 } = {}) {
    const queue = new MailQueue({ store: restoreQueue(queueStore), maxAttempts });
    const mailboxes = new MailboxEngine({ mailboxes: restoreMailboxes(mailboxStore) });
    super({ registry, queue, mailboxes, transport });
    this.mailboxStore = mailboxStore;
    this.queueStore = queueStore;
  }

  persist() {
    this.queueStore.save(Object.fromEntries(this.queue.store.entries()));
    for (const [address, mailbox] of this.mailboxes.mailboxes.entries()) this.mailboxStore.save(address, mailbox);
    return { queue: this.queue.snapshot(), mailboxes: this.mailboxes.mailboxes.size };
  }

  ingest(input) {
    const result = super.ingest(input);
    this.persist();
    return result;
  }

  async drainOne() {
    const result = await super.drainOne();
    this.persist();
    return result;
  }

  health() {
    return {
      ...super.health(),
      persistence: { queue: true, mailboxes: this.mailboxes.mailboxes.size },
    };
  }
}
