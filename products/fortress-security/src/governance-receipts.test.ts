import { createGovernanceReceipt, verifyGovernanceReceipt } from "./governance-receipts";

describe("governance receipts", () => {
  it("verifies deterministic receipt integrity", () => {
    const receipt = createGovernanceReceipt({ tenantId: "t1", decisionId: "d1", approvalIds: ["a1"], evidenceDigest: "e1", issuedAt: "2026-10-28T12:00:00Z" });
    expect(verifyGovernanceReceipt(receipt)).toBe(true);
    expect(verifyGovernanceReceipt({ ...receipt, evidenceDigest: "tampered" })).toBe(false);
  });
});
