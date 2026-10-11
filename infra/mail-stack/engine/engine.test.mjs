import assert from "node:assert/strict";
import { MailQueue } from "./mail-queue.mjs";
import { MailboxEngine } from "./mailbox-engine.mjs";
import { TransportEngine } from "./transport-engine.mjs",;

const queue = new MailQueue();
const job = queue.enqueue({ id: "m1", routes: [{ mailbox: "kora@izakhonoafrica.co.za" }] }, "2026-10-11T20:00:00.000Z");
assert.equal(queue.claim("2026-10-11T20:00:01.000Z").id, job.id);
assert.equal(queue.ack(job.id), true);
assert.equal(queue.snapshot().counts.delivered, 1);

const boxes = new MailboxEngine();
boxes.deliver("kora@izakhonoafrica.co.za", { id: "m1" });
assert.equal(boxes.list("kora@izakhonoafrica.co.za").length, 1);

const transport = new TransportEngine();
transport.register({ name: "test-local", mode: "owned", priority: 1, async send() { return { accepted: true }; } });
const result = await transport.send({ from: "kora@izakhonoafrica.co.za", to: ["test@example.com"] });
assert.equal(result.adapter, "test-local");

console.log("IZAKHONO MAIL engine tests PASSED");
