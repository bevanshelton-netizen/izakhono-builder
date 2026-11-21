import { createRecoveryCheckpoint, planRecovery, verifyRecoveryCheckpoint, verifyRecoveryPlan, type RecoveryEvent } from "./recovery-orchestrator";

function event(sequence: number, previousHash: string | null = null, payload = `event-${sequence}`): RecoveryEvent {
  const base = { id: `event-${sequence}`, tenantId: "tenant-a", sequence, previousHash, payload };
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const integrityHash = createHash("sha256").update(JSON.stringify(base, Object.keys(base).sort())).digest("hex");
  return { ...base, integrityHash };
}

describe("recovery orchestrator", () => {
  test("creates and verifies a deterministic checkpoint", () => {
    const first = event(1);
    const second = event(2, first.integrityHash);
    const events = [first, second];
    const checkpoint = createRecoveryCheckpoint(events, "tenant-a");
    expect(verifyRecoveryCheckpoint(events, checkpoint)).toBe(true);
  });

  test("fails closed on tenant mismatch", () => {
    const first = event(1);
    expect(() => createRecoveryCheckpoint([first], "tenant-b")).toThrow("RECOVERY_TENANT_MISMATCH");
  });

  test("detects tampered state", () => {
    const first = event(1);
    const checkpoint = createRecoveryCheckpoint([first], "tenant-a");
    const tampered = { ...first, payload: "tampered" };
    expect(verifyRecoveryCheckpoint([tampered], checkpoint)).toBe(false);
  });

  test("plans replay and skip without mutating state", () => {
    const first = event(1);
    const second = event(2, first.integrityHash);
    const current = [first];
    const checkpoint = createRecoveryCheckpoint(current, "tenant-a");
    const plan = planRecovery(current, checkpoint, [first, second]);
    expect(plan.items.map((item) => item.action)).toEqual(["SKIP", "REPLAY"]);
    expect(verifyRecoveryPlan(plan)).toBe(true);
  });

  test("rejects a stale checkpoint", () => {
    const first = event(1);
    const checkpoint = createRecoveryCheckpoint([first], "tenant-a");
    const second = event(2, first.integrityHash);
    expect(() => planRecovery([first, second], checkpoint, [first, second])).toThrow("RECOVERY_CHECKPOINT_STALE_OR_TAMPERED");
  });
});
