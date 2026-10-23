import assert from "node:assert/strict";
import { MailApi } from "./mail-api.mjs";
import { MailStore, SupabaseMailStoreAdapter } from "./mail-store.mjs";

const body = { kind: "transactional", from: "noreply@izakhono.africa", to: "customer@example.com", subject: "Atomic acceptance", text: "Hello" };
const auth = async () => ({ allowed: true, tenantId: "tenant-atomic", appId: "app-mail", scopes: ["mail:transactional"] });
const request = (key, payload = body) => ({ method: "POST", url: "https://mail.local/api/mail/send", headers: { "content-type": "application/json", "idempotency-key": key }, body: payload });

const calls = [];
const rpcResponses = [
  { inserted: true, message_id: "atomic-1", event_id: "event-1", fingerprint: "fingerprint-1", response: { message_id: "atomic-1", event_id: "event-1", status: "queued", accepted_at: "2026-10-23T00:00:00.000Z" }, queue_msg_id: 101 },
];
let persistedIdempotency = null;

const fetchImpl = async (url, options) => {
  calls.push({ url, options });
  assert.equal(options.headers.apikey, "service-role-test-key");
  assert.equal(options.headers.Authorization, "Bearer service-role-test-key");
  if (options.method === "GET") {
    assert.match(url, /iz_mail_idempotency\?select=\*&scope=eq\.tenant-atomic%3Aapp-mail&key=eq\.atomic-key$/);
    return new Response(persistedIdempotency ? JSON.stringify([persistedIdempotency]) : "[]", { status: 200, headers: { "content-type": "application/json" } });
  }
  assert.equal(options.method, "POST");
  assert.match(url, /\/rest\/v1\/rpc\/accept_and_enqueue$/);
  const response = rpcResponses.shift();
  persistedIdempotency = { fingerprint: response.fingerprint, response: response.response, created_at: response.response.accepted_at };
  return new Response(JSON.stringify([response]), { status: 200, headers: { "content-type": "application/json" } });
};

const adapter = new SupabaseMailStoreAdapter({ projectUrl: "https://example.supabase.co", serviceKey: "service-role-test-key", fetchImpl });
const atomicApi = new MailApi({
  runtime: { queue: { enqueue() { throw new Error("runtime_queue_must_not_be_used"); } }, health() { return { queue: {}, transports: [] }; } },
  authorize: auth,
  store: new MailStore({ adapter }),
  idFactory: (() => { let n = 0; return () => `generated-${++n}`; })(),
  clock: () => "2026-10-23T00:00:00.000Z",
});

const first = await atomicApi.handle(request("atomic-key"));
assert.equal(first.status, 202);
assert.equal(first.body.message_id, "atomic-1");
assert.equal(calls.length, 1, "API must use one atomic RPC instead of separate persistence writes");

const replay = await atomicApi.handle(request("atomic-key"));
assert.equal(replay.status, 202);
assert.equal(replay.body.message_id, "atomic-1");
assert.equal(replay.body.idempotent_replay, true);
assert.equal(calls.length, 2, "replay should use the persisted idempotency record");

const mismatch = await atomicApi.handle(request("atomic-key", { ...body, subject: "Different" }));
assert.equal(mismatch.status, 409);
assert.equal(mismatch.body.error, "idempotency_mismatch");
assert.equal(calls.length, 3, "mismatch should be rejected by the persisted idempotency record");

let deleteCalls = 0;
const failingAtomicStore = {
  async acceptAndEnqueue() { throw new Error("rpc_response_lost"); },
  async get() { return null; },
  async delete() { deleteCalls += 1; },
};
const failureApi = new MailApi({
  runtime: { queue: { enqueue() { throw new Error("runtime_queue_must_not_be_used"); } }, health() { return { queue: {}, transports: [] }; } },
  authorize: auth,
  store: failingAtomicStore,
  idFactory: (() => { let n = 0; return () => `failure-${++n}`; })(),
  clock: () => "2026-10-23T00:00:00.000Z",
});
const failed = await failureApi.handle(request("lost-response-key"));
assert.equal(failed.status, 503);
assert.equal(deleteCalls, 0, "atomic acceptance failures must preserve the idempotency claim");

console.log("mail atomic acceptance tests passed");
