import assert from "node:assert/strict";
import test from "node:test";
import { TransportEngine, localTransport, relayTransport } from "./transport-engine.mjs";

test("transport engine propagates a stable delivery idempotency key", async () => {
  let received;
  const engine = new TransportEngine({ adapters: [localTransport(async (_envelope, context) => { received = context; return { accepted: true }; })] });
  const result = await engine.send({ to: "a@example.com" }, { messageId: "msg-123" });
  assert.equal(result.adapter, "izakhono-local");
  assert.equal(received.messageId, "msg-123");
  assert.equal(received.idempotencyKey, "msg-123");
  assert.equal(engine.health()[0].idempotent, true);
});

test("transport fallback preserves the same idempotency key", async () => {
  const seen = [];
  const engine = new TransportEngine({ adapters: [
    { name: "primary", priority: 1, idempotent: true, send: async (_e, c) => { seen.push(["primary", c.idempotencyKey]); throw new Error("temporary provider timeout"); } },
    relayTransport(async (_e, c) => { seen.push(["fallback", c.idempotencyKey]); return { accepted: true }; }),
  ] });
  const result = await engine.send({ to: "a@example.com" }, { messageId: "msg-456" });
  assert.equal(result.adapter, "external-relay-bridge");
  assert.deepEqual(seen, [["primary", "msg-456"], ["fallback", "msg-456"]]);
});
