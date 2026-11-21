import { describe, expect, it } from "vitest";
import { appendRecoveryAuditEvent, createRecoveryAuditEvent, verifyRecoveryAuditChain } from "./recovery-audit-ledger";
import { createOperatorApproval, verifyOperatorApproval } from "./operator-approval-chain";
import { createClosureEvidence, verifyClosureEvidence } from "./closure-evidence";
import { createRecoveryRecord, transitionRecovery } from "./recovery-state-machine";

describe("FORTRESS v3.8 recovery audit controls", () => {
  const base = { tenantId: "t1", deliveryId: "d1", subjectId: "d1", createdAt: "2026-10-28T00:00:00.000Z" };

  it("builds and verifies an immutable tenant-scoped chain", () => {
    const first = createRecoveryAuditEvent({ ...base, sequence: 1, type: "STATE_TRANSITION", previousHash: "GENESIS" });
    const chain = appendRecoveryAuditEvent([first], { ...base, type: "ATTESTATION" });
    expect(verifyRecoveryAuditChain(chain, "t1", "d1")).toBe(true);
    expect(verifyRecoveryAuditChain(chain, "t2", "d1")).toBe(false);
  });

  it("rejects tampered audit events", () => {
    const event = createRecoveryAuditEvent({ ...base, sequence: 1, type: "CLOSURE", previousHash: "GENESIS" });
    expect(verifyRecoveryAuditChain([{ ...event, subjectId: "tampered" }], "t1", "d1")).toBe(false);
  });

  it("requires independent operator approval and expiry", () => {
    const approval = createOperatorApproval({ tenantId: "t1", deliveryId: "d1", proposalId: "p1", proposerId: "alice", approverId: "bob", role: "SECURITY_ADMIN", reason: "validated recovery", evidenceDigest: "e1", createdAt: "2026-10-28T00:00:00.000Z", expiresAt: "2026-10-29T00:00:00.000Z" });
    expect(verifyOperatorApproval(approval, new Date("2026-10-28T12:00:00.000Z"))).toBe(true);
    expect(verifyOperatorApproval(approval, new Date("2026-10-30T00:00:00.000Z"))).toBe(false);
    expect(() => createOperatorApproval({ ...approval, integrityHash: undefined as never, approverId: "alice" })).toThrow("APPROVER_MUST_DIFFER_FROM_PROPOSER");
  });

  it("binds closure evidence to recovery, approval, audit and attestation", () => {
    let record = createRecoveryRecord({ tenantId: "t1", deliveryId: "d1", state: "ATTESTED", evidenceDigest: "e1", updatedAt: "2026-10-28T00:00:00.000Z" });
    const approval = createOperatorApproval({ tenantId: "t1", deliveryId: "d1", proposalId: "p1", proposerId: "alice", approverId: "bob", role: "OWNER", reason: "close verified recovery", evidenceDigest: "e1", createdAt: "2026-10-28T00:00:00.000Z", expiresAt: "2026-10-29T00:00:00.000Z" });
    const event = createRecoveryAuditEvent({ ...base, sequence: 1, type: "ATTESTATION", previousHash: "GENESIS" });
    const pkg = createClosureEvidence(record, [event], approval, "att-1");
    expect(verifyClosureEvidence(pkg, record, [event], approval, "att-1")).toBe(true);
    record = transitionRecovery(record, "CLOSED", "2026-10-28T01:00:00.000Z");
    expect(verifyClosureEvidence(pkg, record, [event], approval, "att-1")).toBe(false);
  });
});
