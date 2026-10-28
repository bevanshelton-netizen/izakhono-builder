import { createNoOpAdapter, createIdempotencyKey, dispatchOutboxEntry, verifyDeliveryReceipt } from "./outbox-dispatcher";
import { createOutboxEntry } from "./transactional-outbox";

describe("outbox dispatcher", () => {
  const entry = createOutboxEntry({ tenantId: "t1", sequence: 1, eventType: "SECURITY_EVENT", payload: { ok: true }, createdAt: "2026-10-28T00:00:00.000Z" });

  test("uses deterministic idempotency and delivers once", () => {
    const adapter = createNoOpAdapter();
    const key = createIdempotencyKey("t1", entry.id, adapter.id);
    const first = dispatchOutboxEntry(entry, adapter, { attempts: [], receipts: [] }, { maxAttempts: 3 });
    expect(first.attempt.idempotencyKey).toBe(key);
    expect(first.attempt.status).toBe("DELIVERED");
    expect(first.receipt && verifyDeliveryReceipt(first.receipt)).toBe(true);
    expect(() => dispatchOutboxEntry(entry, adapter, first.state, { maxAttempts: 3 })).toThrow("DUPLICATE_DELIVERY_SUPPRESSED");
  });

  test("rejects a cross-tenant receipt", () => {
    const adapter = createNoOpAdapter("bad-adapter");
    adapter.deliver = () => ({ tenantId: "other", outboxEntryId: entry.id, adapterId: adapter.id, idempotencyKey: createIdempotencyKey("other", entry.id, adapter.id), status: "DELIVERED", deliveredAt: new Date().toISOString(), responseDigest: "x", receiptIntegrityHash: "bad" });
    expect(() => dispatchOutboxEntry(entry, adapter, { attempts: [], receipts: [] }, { maxAttempts: 1 })).toThrow("DELIVERY_RECEIPT_INTEGRITY_INVALID");
  });

  test("bounds retries and quarantines after the limit", () => {
    const adapter = createNoOpAdapter("retry-adapter");
    adapter.deliver = () => {
      const unsigned = { tenantId: entry.tenantId, outboxEntryId: entry.id, adapterId: adapter.id, idempotencyKey: createIdempotencyKey(entry.tenantId, entry.id, adapter.id), status: "RETRYABLE" as const, deliveredAt: new Date().toISOString(), responseDigest: "retry" };
      return { ...unsigned, receiptIntegrityHash: require("node:crypto").createHash("sha256").update(JSON.stringify(unsigned), "utf8").digest("hex") };
    };
    const first = dispatchOutboxEntry(entry, adapter, { attempts: [], receipts: [] }, { maxAttempts: 1 });
    expect(first.attempt.status).toBe("RETRYABLE");
    const second = dispatchOutboxEntry(entry, adapter, first.state, { maxAttempts: 1 });
    expect(second.attempt.status).toBe("QUARANTINED");
  });

  test("rejects unsupported event adapters", () => {
    const adapter = createNoOpAdapter("limited");
    adapter.supportedEventTypes = ["OTHER"];
    expect(() => dispatchOutboxEntry(entry, adapter, { attempts: [], receipts: [] }, { maxAttempts: 1 })).toThrow("ADAPTER_UNSUPPORTED_EVENT");
  });
});
