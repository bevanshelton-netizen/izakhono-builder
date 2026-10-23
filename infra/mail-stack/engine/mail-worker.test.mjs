import assert from "node:assert/strict";
import test from "node:test";
import { MailWorker } from "./mail-worker.mjs";
import { MemoryMailOutboxAdapter, MailOutbox } from "./mail-outbox.mjs";
import { MailStore, MemoryMailStoreAdapter } from "./mail-store.mjs";
import { MailEventLedger } from "./mail-events.mjs";

test("worker accepts, records, and acknowledges successful delivery", async () => {
  const outbox = new MailOutbox({ adapter: new MemoryMailOutboxAdapter() });
  const store = new MailStore({ adapter: new MemoryMailStoreAdapter() });
  const events = new MailEventLedger();
  const sent = [];
  const runtime = { send: async (envelope, context) => { sent.push({ envelope, context }); return { provider: "local" }; } };
  const job = { message_id: "m-1", event_id: "e-1", tenant_id: "t-1", app_id: "app", kind: "transactional", envelope: { to: "a@example.com" } };
  await store.putMessage({ ...job, status: "queued" });
  await store.appendEvent({ id: "e-1:queued", message_id: "m-1", tenant_id: "t-1", type: "mail.queued", occurred_at: "2026-01-01T00:00:00.000Z", data: {} });
  await outbox.enqueue(job);

  const worker = new MailWorker({ outbox, runtime, store, events });
  const result = await worker.processOne();
  assert.equal(result.state, "accepted");
  assert.equal(sent.length, 1);
  assert.equal((await outbox.claim()).length, 0);
  const timeline = await store.listEvents("m-1", { tenantId: "t-1" });
  assert.deepEqual(timeline.map((event) => event.type), ["mail.queued", "mail.sending", "mail.accepted"]);
});

test("worker defers retryable failures and keeps the job", async () => {
  const outbox = new MailOutbox({ adapter: new MemoryMailOutboxAdapter() });
  const store = new MailStore({ adapter: new MemoryMailStoreAdapter() });
  const events = new MailEventLedger();
  const runtime = { send: async () => { throw new Error("temporary provider timeout"); } };
  const job = { message_id: "m-2", event_id: "e-2", tenant_id: "t-1", envelope: { to: "a@example.com" } };
  await store.putMessage({ ...job, status: "queued" });
  await outbox.enqueue(job);
  const worker = new MailWorker({ outbox, runtime, store, events, retryDelaySeconds: 60, maxAttempts: 3 });
  const result = await worker.processOne();
  assert.equal(result.state, "deferred");
  const timeline = await store.listEvents("m-2", { tenantId: "t-1" });
  assert.deepEqual(timeline.map((event) => event.type), ["mail.sending", "mail.deferred"]);
});

test("worker archives non-retryable failures", async () => {
  const outbox = new MailOutbox({ adapter: new MemoryMailOutboxAdapter() });
  const store = new MailStore({ adapter: new MemoryMailStoreAdapter() });
  const events = new MailEventLedger();
  const runtime = { send: async () => { throw new Error("sender rejected"); } };
  const job = { message_id: "m-3", event_id: "e-3", tenant_id: "t-1", envelope: { to: "a@example.com" } };
  await store.putMessage({ ...job, status: "queued" });
  await outbox.enqueue(job);
  const worker = new MailWorker({ outbox, runtime, store, events });
  const result = await worker.processOne();
  assert.equal(result.state, "failed");
  assert.equal((await outbox.claim()).length, 0);
  const timeline = await store.listEvents("m-3", { tenantId: "t-1" });
  assert.deepEqual(timeline.map((event) => event.type), ["mail.sending", "mail.failed"]);
});
