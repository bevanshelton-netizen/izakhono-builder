import assert from "node:assert/strict";
import { MailOutbox, MemoryMailOutboxAdapter, PgmqMailOutboxAdapter } from "./mail-outbox.mjs";

const memory = new MailOutbox({ adapter: new MemoryMailOutboxAdapter() });
const queuedId = await memory.enqueue({
  message_id: "msg-1",
  event_id: "evt-1",
  tenant_id: "tenant-1",
  app_id: "app-1",
  envelope: { to: "customer@example.com", subject: "Hello", text: "Hi" },
});
assert.equal(queuedId, 1);

const claimed = await memory.claim({ visibilitySeconds: 60, quantity: 1 });
assert.equal(claimed.length, 1);
assert.equal(claimed[0].message.message_id, "msg-1");
assert.equal(claimed[0].read_ct, 1);
assert.equal(await memory.ack(claimed[0].msg_id), true);
assert.deepEqual(await memory.claim(), []);

const calls = [];
const sql = async (statement, params) => {
  calls.push({ statement, params });
  if (statement.includes("pgmq.send")) return [{ msg_id: 42 }];
  if (statement.includes("pgmq.read")) return [{ msg_id: 42, message: { message_id: "msg-2" } }];
  if (statement.includes("pgmq.delete")) return [{ deleted: true }];
  if (statement.includes("pgmq.set_vt")) return [{ message: { message_id: "msg-2" } }];
  return [{ archived: true }];
};
const pgmq = new MailOutbox({ adapter: new PgmqMailOutboxAdapter({ execute: sql }) });
assert.equal(await pgmq.enqueue({ message_id: "msg-2", event_id: "evt-2", envelope: {} }), 42);
assert.equal((await pgmq.claim())[0].message.message_id, "msg-2");
assert.equal(await pgmq.ack(42), true);
await pgmq.retry(42, { delaySeconds: 10 });
await pgmq.archive(42);
assert.equal(calls.length, 5);
assert.match(calls[0].statement, /pgmq\.send/);
assert.match(calls[1].statement, /pgmq\.read/);

console.log("mail-outbox tests passed");
