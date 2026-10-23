import assert from "node:assert/strict";
import { MailStore, MemoryMailStoreAdapter, SupabaseMailStoreAdapter } from "./mail-store.mjs";
import { MailTimelineApi } from "./mail-timeline-api.mjs";

const adapter = new MemoryMailStoreAdapter();
const store = new MailStore({ adapter, clock: () => "2026-10-23T00:00:00.000Z" });

await store.putMessage({
  message_id: "msg-1",
  tenant_id: "tenant-a",
  app_id: "app-a",
  kind: "transactional",
  status: "delivered",
  accepted_at: "2026-10-23T00:00:00.000Z",
});
await store.appendEvent({ id: "evt-1", message_id: "msg-1", type: "mail.queued", occurred_at: "2026-10-23T00:00:01.000Z" });
await store.appendEvent({ id: "evt-2", message_id: "msg-1", type: "mail.delivered", occurred_at: "2026-10-23T00:00:02.000Z" });

assert.equal((await store.getMessage("msg-1", { tenantId: "tenant-a" })).message_id, "msg-1");
assert.equal(await store.getMessage("msg-1", { tenantId: "tenant-b" }), null);
assert.equal((await store.listEvents("msg-1", { tenantId: "tenant-a" })).length, 2);
assert.equal(await store.listEvents("msg-1", { tenantId: "tenant-b" }), null);

const api = new MailTimelineApi({
  store,
  authorize: async () => ({ allowed: true, tenantId: "tenant-a" }),
});

const messageResponse = await api.handle({ method: "GET", url: "http://izakhono.local/api/mail/messages/msg-1" });
assert.equal(messageResponse.status, 200);
assert.equal(messageResponse.body.message.status, "delivered");
assert.equal("envelope" in messageResponse.body.message, false);

const timelineResponse = await api.handle({ method: "GET", url: "http://izakhono.local/api/mail/messages/msg-1/events" });
assert.equal(timelineResponse.status, 200);
assert.deepEqual(timelineResponse.body.events.map((event) => event.id), ["evt-1", "evt-2"]);

const missingResponse = await api.handle({ method: "GET", url: "http://izakhono.local/api/mail/messages/nope" });
assert.equal(missingResponse.status, 404);

const rows = new Map();
const fakeFetch = async (url, options = {}) => {
  const path = new URL(url).pathname.split("/").pop();
  const method = options.method || "GET";
  const body = options.body ? JSON.parse(options.body) : null;
  if (method === "POST") {
    for (const row of body) rows.set(`${path}:${row.message_id || row.id || `${row.scope}:${row.key}`}`, row);
    return new Response("", { status: 201 });
  }
  if (method === "GET") return new Response(JSON.stringify([]), { status: 200 });
  if (method === "DELETE") return new Response("", { status: 204 });
  throw new Error(`unexpected ${method}`);
};

const supabaseAdapter = new SupabaseMailStoreAdapter({
  projectUrl: "https://example.supabase.co",
  serviceKey: "server-only",
  fetchImpl: fakeFetch,
});
await supabaseAdapter.putMessage({ message_id: "msg-2", tenant_id: "tenant-b", app_id: "app-b", envelope: {} });
await supabaseAdapter.appendEvent({ id: "evt-3", message_id: "msg-2", tenant_id: "tenant-b", type: "mail.queued" });
await supabaseAdapter.saveIdempotency("tenant-b:app-b", "key-2", { fingerprint: "fp", response: { message_id: "msg-2" } });
assert.equal(rows.size, 3);

console.log("mail-store tests passed");
