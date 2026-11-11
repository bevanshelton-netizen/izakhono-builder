import { appendGovernanceDecision, verifyGovernanceDecisionJournal } from "./governance-decision-journal";
import { createGovernanceReceipt } from "./governance-receipts";
import { createGovernanceClosure, verifyGovernanceClosure } from "./governance-closure";

describe("FORTRESS governance controls", () => {
  it("verifies chained tenant decisions", () => {
    const first = appendGovernanceDecision([], { tenantId: "t1", outcome: "APPROVED", subjectId: "d1", evidenceDigest: "e1", createdAt: "2026-10-28T12:00:00Z" });
    const second = appendGovernanceDecision(first, { tenantId: "t1", outcome: "DENIED", subjectId: "d2", evidenceDigest: "e2", createdAt: "2026-10-28T12:01:00Z" });
    expect(verifyGovernanceDecisionJournal(second, "t1")).toBe(true);
    expect(verifyGovernanceDecisionJournal(second, "t2")).toBe(false);
    expect(verifyGovernanceDecisionJournal([{ ...second[0], outcome: "DENIED" }, second[1]], "t1")).toBe(false);
  });
  it("binds receipt, evidence and closure", () => {
    const [decision] = appendGovernanceDecision([], { tenantId: "t1", outcome: "APPROVED", subjectId: "d1", evidenceDigest: "e1", createdAt: "2026-10-28T12:00:00Z" });
    const receipt = createGovernanceReceipt({ tenantId: "t1", decisionId: decision.decisionId, approvalIds: ["a1", "a2"], evidenceDigest: "e1", issuedAt: "2026-10-28T12:02:00Z" });
    const closure = createGovernanceClosure(decision, receipt);
    expect(verifyGovernanceClosure(closure)).toBe(true);
    expect(verifyGovernanceClosure({ ...closure, evidenceDigest: "tampered" })).toBe(false);
  });
});
