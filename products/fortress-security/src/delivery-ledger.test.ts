import { acquireLease, createLedgerRecord, markLedgerDelivery, releaseExpiredLease, releaseLease, verifyLedgerRecord } from "./delivery-ledger";

describe("delivery ledger", () => {
  const base = createLedgerRecord({ tenantId: "t1", outboxEntryId: "e1", adapterId: "a1", status: "READY", attemptCount: 0, updatedAt: "2026-10-28T00:00:00.000Z" });

  test("creates and verifies deterministic integrity", () => expect(verifyLedgerRecord(base)).toBe(true));
  test("leases and enforces ownership", () => {
    const leased = acquireLease(base, "worker-1", "2026-10-28T00:00:00.000Z", 10000);
    expect(leased.status).toBe("LEASED");
    expect(() => acquireLease(leased, "worker-2", "2026-10-28T00:00:01.000Z", 10000)).toThrow("DELIVERY_LEASE_HELD");
    expect(() => releaseLease(leased, "worker-2", "2026-10-28T00:00:01.000Z")).toThrow("DELIVERY_LEASE_OWNER_MISMATCH");
  });
  test("recovers expired lease", () => {
    const leased = acquireLease(base, "worker-1", "2026-10-28T00:00:00.000Z", 1000);
    const recovered = releaseExpiredLease(leased, "2026-10-28T00:00:02.000Z");
    expect(recovered.status).toBe("READY");
    expect(recovered.leaseOwner).toBeUndefined();
  });
  test("requires lease ownership for delivery completion", () => {
    const leased = acquireLease(base, "worker-1", "2026-10-28T00:00:00.000Z", 10000);
    const delivered = markLedgerDelivery(leased, "worker-1", "DELIVERED", "2026-10-28T00:00:01.000Z");
    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.attemptCount).toBe(1);
    expect(() => markLedgerDelivery(delivered, "worker-1", "DELIVERED", "2026-10-28T00:00:02.000Z")).toThrow("DELIVERY_LEASE_OWNER_MISMATCH");
  });
  test("rejects tampered records", () => {
    const tampered = { ...base, attemptCount: 99 };
    expect(() => acquireLease(tampered, "worker-1", "2026-10-28T00:00:00.000Z", 1000)).toThrow("DELIVERY_LEDGER_INTEGRITY_INVALID");
  });
});
