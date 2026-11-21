import { createNoOpAdapter, createIdempotencyKey, createReceiptIntegrityHash, dispatchOutboxEntry, DeliveryAdapter, DeliveryReceipt, verifyDeliveryReceipt } from "./outbox-dispatcher";
import { createOutboxEntry } from "./transactional-outbox";

describe("outbox dispatcher", () => {
  const entry = createOutboxEntry({ tenantId: "t1", sequence: 1, eventType: "SECURITY_EVENT", payload: { ok: true }, state: "PENDING", createdAt: "2026-10-28T00:00:00.000Z" });

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
    const adapter: DeliveryAdapter = {
      id: "bad-adapter",
      supportedEventTypes: ["SECURITY_EVENT"],
      deliver: () => {
        const unsigned: Omit<DeliveryReceipt, "receiptIntegrityHash"> = { tenantId: "other", outboxEntryId: entry.id, adapterId: "bad-adapter", idempotencyKey: createIdempotencyKey("other", entry.id, "bad-adapter"), status: "DELIVERED", deliveredAt: new Date().toISOString(), responseDigest: "x" };
        return { ...unsigned, receiptIntegrityHash: createReceiptIntegrityHash(unsigned) };
      },
    };
    expect(() => dispatchOutboxEntry(entry, adapter, { attempts: [], receipts: [] }, { maxAttempts: 1 })).toThrow("DELIVERY_RECEIPT_INTEGRITY_INVALID");
  });

  test("bounds retries and quarantines after the limit", () => {
    const adapter: DeliveryAdapter = {
      id: "retry-adapter",
      supportedEventTypes: ["SECURITY_EVENT"],
      deliver: () => {
        const unsigned: Omit<DeliveryReceipt, "receiptIntegrityHash"> = { tenantId: entry.tenantId, outboxEntryId: entry.id, adapterId: "retry-adapter", idempotencyKey: createIdempotencyKey(entry.tenantId, entry.id, "retry-adapter"), status: "RETRYABLE", deliveredAt: new Date().toISOString(), responseDigest: "retry" };
        return { ...unsigned, receiptIntegrityHash: createReceiptIntegrityHash(unsigned) };
      },
    };
    const first = dispatchOutboxEntry(entry, adapter, { attempts: [], receipts: [] }, { maxAttempts: 1 });
    expect(first.attempt.status).toBe("RETRYABLE");
    const second = dispatchOutboxEntry(entry, adapter, first.state, { maxAttempts: 1 });
    expect(second.attempt.status).toBe("QUARANTINED");
  });

  test("rejects unsupported event adapters", () => {
    const adapter = createNoOpAdapter("limited");
    const limited: DeliveryAdapter = { ...adapter, supportedEventTypes: ["OTHER"] };
    expect(() => dispatchOutboxEntry(entry, limited, { attempts: [], receipts: [] }, { maxAttempts: 1 })).toThrow("ADAPTER_UNSUPPORTED_EVENT");
  });
});
