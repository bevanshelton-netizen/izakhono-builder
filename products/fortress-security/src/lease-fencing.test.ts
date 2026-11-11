import { createLeaseToken, fenceLease, moveToDeadLetter, scheduleRetry, verifyLeaseToken, verifyRetryRecord } from "./lease-fencing";

describe("lease fencing and retry scheduler", () => {
  const now = "2026-10-28T00:00:00.000Z";
  test("validates ownership and generation", () => {
    const token = createLeaseToken({ tenantId: "t1", deliveryId: "d1", workerId: "w1", generation: 2, acquiredAt: now, expiresAt: "2026-10-28T00:10:00.000Z" });
    expect(verifyLeaseToken(token, now)).toBe(true);
    expect(() => fenceLease(token, "w1", 2, now)).not.toThrow();
    expect(() => fenceLease(token, "w2", 2, now)).toThrow("LEASE_OWNER_MISMATCH");
    expect(() => fenceLease(token, "w1", 1, now)).toThrow("LEASE_FENCING_TOKEN_STALE");
  });
  test("rejects expired leases", () => {
    const token = createLeaseToken({ tenantId: "t1", deliveryId: "d1", workerId: "w1", generation: 1, acquiredAt: now, expiresAt: "2026-10-27T23:59:00.000Z" });
    expect(verifyLeaseToken(token, now)).toBe(false);
  });
  test("schedules bounded exponential retry", () => {
    const record = scheduleRetry("t1", "d1", 3, "temporary failure", now, 1000);
    expect(record.state).toBe("RETRY_SCHEDULED");
    expect(record.nextAttemptAt).toBe("2026-10-28T00:00:04.000Z");
    expect(verifyRetryRecord(record)).toBe(true);
  });
  test("moves only exhausted retries to dead letter", () => {
    const record = scheduleRetry("t1", "d1", 3, "temporary failure", now);
    expect(() => moveToDeadLetter(record, 4)).toThrow("RETRY_LIMIT_NOT_REACHED");
    const dead = moveToDeadLetter(record, 3);
    expect(dead.state).toBe("DEAD_LETTER");
    expect(verifyRetryRecord(dead)).toBe(true);
  });
});
