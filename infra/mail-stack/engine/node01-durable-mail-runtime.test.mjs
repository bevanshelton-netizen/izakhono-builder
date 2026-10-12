import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Node01DurableMailRuntime } from "./node01-durable-mail-runtime.mjs";
import { Node01MailboxStore, Node01QueueStore } from "./node01-storage.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "izakhono-mail-"));
const mailboxStore = new Node01MailboxStore({ root: path.join(root, "mailboxes") });
const queueStore = new Node01QueueStore({ root: path.join(root, "queue") });

const first = new Node01DurableMailRuntime({ registry: {} , mailboxStore, queueStore });
first.queue.enqueue({ id: "persist-1", routes: [{ mailbox: "hello@izakhonoafrica.co.za" }] });
first.mailboxes.deliver("hello@izakhonoafrica.co.za", { id: "persist-1" });
first.persist();

const second = new Node01DurableMailRuntime({
  registry: {},
  mailboxStore: new Node01MailboxStore({ root: path.join(root, "mailboxes") }),
  queueStore: new Node01QueueStore({ root: path.join(root, "queue") }),
});

assert.equal(second.queue.snapshot().size, 1);
assert.equal(second.mailboxes.list("hello@izakhonoafrica.co.za").length, 1);
assert.equal(second.mailboxes.list("hello@izakhonoafrica.co.za")[0].id, "persist-1");
assert.equal(second.health().persistence.queue, true);

fs.rmSync(root, { recursive: true, force: true });
console.log("NODE01 durable mail runtime restart persistence test PASSED");
