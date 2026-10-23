import assert from "node:assert/strict";
import { MailApi } from "./mail-api.mjs";
import { MailStore, MemoryMailStoreAdapter } from "./mail-store.mjs";

const queue = { jobs: [], enqueue(message) { this.jobs.push(message); } };
const runtime = { queue, health() { return { queue: { queued: this.jobs.length }, transports: [] }; } };
const auth = async () => ({ allowed: true, tenantId: "tenant-1", appId: "app-1", scopes: ["mail:transactional"] });
const api = new MailApi({ runtime, authorize: auth, idFactory: (() => { let n = 0; return () => `id-${++n}`; })(), clock: () => "2026-10-23T00:00:00.000Z" });

const request = (body, key = "test-1") => ({
  method: "POST",
  url: "https://mail.local/api/mail/send",
  headers: { "content-type": "application/json", "idempotency-key": key },
  body,
});

const body = { kind: "transactional", from: "noreply@izakhono.africa", to: "customer@example.com", subject: "Welcome", text: "Hello" };

const first = await api.handle(request(body));
assert.equal(first.status, 202);
assert.equal(first.body.message_id, "id-1");
assert.equal(queue.jobs.length, 1);

const replay = await api.handle(request(body));
assert.equal(replay.status, 202);
assert.equal(replay.body.message_id, "id-1");
assert.equal(replay.body.idempotent_replay, true);
assert.equal(queue.jobs.length, 1);

const mismatch = await api.handle(request({ ...body, subject: "Changed" }));
assert.equal(mismatch.status, 409);
assert.equal(mismatch.body.error, "idempotency_mismatch");

const unauthorized = await new MailApi({ runtime }).handle(request(body, "auth-test"));
assert.equal(unauthorized.status, 401);

const badKey = await api.handle(request(body, "\n"));
assert.equal(badKey.status, 400);

const badEnvelope = await api.handle(request({ from: body.from, to: body.to, subject: body.subject }, "validation-test"));
assert.equal(badEnvelope.status, 422);

const marketing = await api.handle(request({ ...body, kind: "marketing" }, "marketing-test"));
assert.equal(marketing.status, 403);

const health = await api.handle({ method: "GET", url: "https://mail.local/api/mail/health" });
assert.equal(health.status, 200);
assert.equal(health.body.service, "izakhono-mail");

const durableQueue = { jobs: [], enqueue(message) { this.jobs.push(message); } };
const durableRuntime = { queue: durableQueue, health() { return { queue: { queued: this.jobs.length }, transports: [] }; } };
const durableStore = new MailStore({ adapter: new MemoryMailStoreAdapter(), clock: () => "2026-10-23T00:00:00.000Z" });
const durableApi = new MailApi({
  runtime: durableRuntime,
  authorize: auth,
  store: durableStore,
  idFactory: (() => { let n = 100; return () => `id-${++n}`; })(),
  clock: () => "2026-10-23T00:00:00.000Z",
});

const durableResponse = await durableApi.handle(request(body, "durable-1"));
assert.equal(durableResponse.status, 202);
assert.equal((await durableStore.get("tenant-1:app-1", "durable-1")).response.message_id, "id-101");
assert.equal((await durableStore.getMessage("id-101", { tenantId: "tenant-1" })).status, "queued");
assert.equal((await durableStore.listEvents("id-101", { tenantId: "tenant-1" })).length, 1);

console.log("mail-api tests passed");
