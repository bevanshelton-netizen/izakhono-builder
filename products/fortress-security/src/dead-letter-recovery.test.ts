import { createDeadLetterRecord, InMemoryDeadLetterStore } from "./dead-letter-store";
import { authorizeReplay, verifyReplayAuthorization } from "./replay-authorization";
import { createRecoveryAttestation, verifyRecoveryAttestation } from "./recovery-attestation";

describe("FORTRESS dead-letter recovery", () => {
  const record = createDeadLetterRecord({ tenantId: "tenant-a", deliveryId: "delivery-1", originalAttempt: 5, reason: "retry limit", createdAt: "2026-10-28T07:00:00.000Z", payloadDigest: "payload-hash" });

  it("stores records with tenant isolation and duplicate suppression", () => {
    const store = new InMemoryDeadLetterStore();
    store.put(record);
    store.put(record);
    expect(store.list("tenant-a")).toHaveLength(1);
    expect(store.list("tenant-b")).toHaveLength(0);
  });

  it("rejects tampered records", () => {
    const store = new InMemoryDeadLetterStore();
    expect(() => store.put({ ...record, reason: "tampered" })).toThrow("DEAD_LETTER_INVALID");
  });

  it("requires explicit replay authorization", () => {
    expect(() => authorizeReplay({ ...record, replayStatus: "REPLAYED" }, "actor", "approval", "retry", record.createdAt)).toThrow("REPLAY_NOT_AUTHORIZED");
    const auth = authorizeReplay(record, "actor", "approval", "approved retry", record.createdAt);
    expect(verifyReplayAuthorization(auth, record)).toBe(true);
  });

  it("binds recovery attestation to the record and authorization", () => {
    const auth = authorizeReplay(record, "actor", "approval", "approved retry", record.createdAt);
    const attestation = createRecoveryAttestation(record, auth, "REPLAYED", "2026-10-28T07:01:00.000Z");
    expect(verifyRecoveryAttestation(attestation, record, auth)).toBe(true);
    expect(verifyRecoveryAttestation({ ...attestation, deliveryId: "other" }, record, auth)).toBe(false);
  });
});
