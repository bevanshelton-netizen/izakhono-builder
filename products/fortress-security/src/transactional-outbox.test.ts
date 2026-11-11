import { createOutboxEntry, prepareOutboxCommit, validateOutboxCommit, markDispatched, type OutboxEntry } from "./transactional-outbox";

const make = (sequence: number): OutboxEntry => createOutboxEntry({ tenantId: "tenant-a", sequence, eventType: "TEST", payload: { sequence }, state: "PENDING", createdAt: "2026-10-28T00:00:00.000Z" });

describe("transactional outbox", () => {
  test("prepares deterministic tenant-scoped commit", () => {
    const entries = [make(1), make(2)];
    const commit = prepareOutboxCommit("tenant-a", 0, entries);
    expect(() => validateOutboxCommit(commit)).not.toThrow();
    expect(commit.entries).toHaveLength(2);
  });

  test("rejects cross-tenant writes", () => {
    const entry = make(1);
    const commit = prepareOutboxCommit("tenant-a", 0, [entry]);
    expect(() => validateOutboxCommit({ ...commit, tenantId: "tenant-b" })).toThrow("OUTBOX_TENANT_MISMATCH");
  });

  test("rejects sequence conflicts", () => {
    const entry = make(2);
    expect(() => prepareOutboxCommit("tenant-a", 0, [entry])).toThrow("OUTBOX_SEQUENCE_CONFLICT");
  });

  test("rejects tampering", () => {
    const entry = make(1);
    const commit = prepareOutboxCommit("tenant-a", 0, [entry]);
    const tampered = { ...entry, payload: { sequence: 999 } };
    expect(() => validateOutboxCommit({ ...commit, entries: [tampered], commitDigest: commit.commitDigest })).toThrow("OUTBOX_INTEGRITY_MISMATCH");
  });

  test("enforces one-way dispatch state", () => {
    const dispatched = markDispatched(make(1));
    expect(dispatched.state).toBe("DISPATCHED");
    expect(() => markDispatched(dispatched)).toThrow("OUTBOX_NOT_PENDING");
  });
});
