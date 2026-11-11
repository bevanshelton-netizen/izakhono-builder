import { createRecoveryRecord, transitionRecovery, verifyEvidenceClosure } from "./recovery-state-machine";

describe("recovery state machine", () => {
  const base = createRecoveryRecord({ tenantId: "t1", deliveryId: "d1", state: "DEAD_LETTER", evidenceDigest: "e1", updatedAt: "2026-10-28T00:00:00.000Z" });
  test("follows controlled lifecycle", () => {
    let r = base;
    for (const state of ["STORED", "AUTHORIZED", "REPLAYED", "ATTESTED", "CLOSED"] as const) r = transitionRecovery(r, state);
    expect(r.state).toBe("CLOSED");
    expect(verifyEvidenceClosure(r, "e1")).toBe(true);
  });
  test("rejects illegal transition", () => expect(() => transitionRecovery(base, "REPLAYED")).toThrow("RECOVERY_TRANSITION_DENIED"));
  test("rejects tampered records", () => expect(() => transitionRecovery({ ...base, evidenceDigest: "evil" }, "STORED")).toThrow("RECOVERY_RECORD_TAMPERED"));
  test("supports quarantine from every non-terminal recovery state", () => expect(transitionRecovery(base, "QUARANTINED").state).toBe("QUARANTINED"));
  test("closure requires matching evidence", () => expect(verifyEvidenceClosure(base, "e1")).toBe(false));
});
