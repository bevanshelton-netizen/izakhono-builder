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
  const snapshot = store.load();
  return new Map(Object.entries(snapshot || {}));
}

function restoreMailboxes(store) {
  const mailboxes = new Map();
  return {
    mailboxes,
    load(address) {
      const existing = mailboxes.get(String(address).trim().toLowerCase());
      if (existing) return existing;
      const stored = store.load(address);
      if (stored) mailboxes.set(stored.address, stored);
      return stored;
    },
  };
}

export class Node01DurableMailRuntime extends MailRuntime {
  constructor({ registry, mailboxStore = new Node01MailboxStore(), queueStore = new Node01QueueStore(), transport, maxAttempts = 8 } = {}) {
    const queueMap = restoreQueue(queueStore);
    const mailboxState = restoreMailboxes(mailboxStore);
    const mailboxes = new MailboxEngine({ mailboxes: mailboxState.mailboxes });
    super({ registry, queue: new MailQueue({ store: queueMap, maxAttempts }), mailboxes, transport });
    this.mailboxStore = mailboxStore;
    this.queueStore = queueStore;
    this.#restoreMailboxesFromDisk(mailboxStore);
  }

  #restoreMailboxesFromDisk(store) {
    for (const address of this.registry?.addresses?.() || []) {
      const stored = store.load(address);
      if (stored) this.mailboxes.mailboxes.set(stored.address, stored);
    }
  }

  persist() {
    const queueSnapshot = Object.fromEntries(this.queue.store.entries());
    this.queueStore.save(queueSnapshot);
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
