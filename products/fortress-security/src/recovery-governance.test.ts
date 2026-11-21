import { createGovernanceApproval, evaluateGovernance } from "./recovery-governance";

describe("recovery governance", () => {
  const policy = { tenantId: "t1", recoveryId: "r1", requiredRoles: ["OWNER", "SECURITY_ADMIN"] as const, quorum: 2, expiresAt: "2099-01-01T00:00:00.000Z" };
  const a1 = createGovernanceApproval({ tenantId: "t1", recoveryId: "r1", approverId: "owner", role: "OWNER", approvedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z", evidenceDigest: "e1" });
  const a2 = createGovernanceApproval({ tenantId: "t1", recoveryId: "r1", approverId: "admin", role: "SECURITY_ADMIN", approvedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z", evidenceDigest: "e1" });

  it("authorizes a valid multi-party quorum", () => expect(evaluateGovernance(policy, "proposer", [a1, a2], "e1").authorized).toBe(true));
  it("blocks proposer self-approval", () => expect(evaluateGovernance(policy, "owner", [a1, a2], "e1").authorized).toBe(false));
  it("blocks missing required role", () => expect(evaluateGovernance(policy, "proposer", [a1], "e1").authorized).toBe(false));
  it("blocks mismatched evidence", () => expect(evaluateGovernance(policy, "proposer", [a1, a2], "tampered").authorized).toBe(false));
  it("isolates tenants", () => expect(evaluateGovernance(policy, "proposer", [{ ...a2, tenantId: "other" }], "e1").authorized).toBe(false));
  it("deduplicates an approver", () => expect(evaluateGovernance(policy, "proposer", [a1, a1, a2], "e1").authorized).toBe(true));
});
