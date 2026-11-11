import { appendGovernanceDecision } from "./governance-decision-journal";
import { createGovernanceReceipt } from "./governance-receipts";
import { createGovernanceClosure, verifyGovernanceClosure } from "./governance-closure";

describe("governance closure", () => {
  it("rejects tenant and receipt mismatches", () => {
    const [decision] = appendGovernanceDecision([], { tenantId: "t1", outcome: "APPROVED", subjectId: "d1", evidenceDigest: "e1", createdAt: "2026-10-28T12:00:00Z" });
    const receipt = createGovernanceReceipt({ tenantId: "t1", decisionId: decision.decisionId, approvalIds: ["a1"], evidenceDigest: "e1", issuedAt: "2026-10-28T12:01:00Z" });
    const closure = createGovernanceClosure(decision, receipt);
    expect(verifyGovernanceClosure(closure)).toBe(true);
    expect(verifyGovernanceClosure({ ...closure, tenantId: "t2" })).toBe(false);
  });
});
