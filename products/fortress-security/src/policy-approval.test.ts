import { describe, expect, it } from "vitest";
import {
  createApproval,
  evaluatePolicy,
  isolatePolicyRules,
  transitionApproval,
  verifyApprovalIntegrity,
  verifyPolicyDecisionIntegrity,
  type PolicyRule,
} from "./policy-approval";

const rules: PolicyRule[] = [
  {
    id: "critical-review",
    tenantId: "tenant-a",
    action: "ESCALATE_CRITICAL",
    minimumPriority: "HIGH",
    proposerRoles: ["ANALYST", "SECURITY_ADMIN", "OWNER"],
    approverRoles: ["SECURITY_ADMIN", "OWNER"],
    approvalRequired: true,
    expiresInSeconds: 3600,
  },
];

describe("FORTRESS policy and approval gates", () => {
  it("denies by default", () => {
    const decision = evaluatePolicy({
      tenantId: "tenant-a", actorId: "a", actorRole: "ANALYST", action: "OPEN_REMEDIATION",
      priority: "HIGH", targetId: "f1", requestedAt: "2026-10-28T10:00:00.000Z",
    }, rules);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("no matching");
  });

  it("requires approval for a matched critical action", () => {
    const decision = evaluatePolicy({
      tenantId: "tenant-a", actorId: "a", actorRole: "ANALYST", action: "ESCALATE_CRITICAL",
      priority: "CRITICAL", targetId: "f1", requestedAt: "2026-10-28T10:00:00.000Z",
    }, rules);
    expect(decision.allowed).toBe(true);
    expect(decision.approvalRequired).toBe(true);
    expect(verifyPolicyDecisionIntegrity(decision)).toBe(true);
  });

  it("enforces tenant isolation", () => {
    expect(isolatePolicyRules("tenant-b", rules)).toHaveLength(0);
  });

  it("enforces approver role and approval expiry", () => {
    const decision = evaluatePolicy({
      tenantId: "tenant-a", actorId: "a", actorRole: "ANALYST", action: "ESCALATE_CRITICAL",
      priority: "CRITICAL", targetId: "f1", requestedAt: "2026-10-28T10:00:00.000Z",
    }, rules);
    expect(() => createApproval(decision, "viewer", "VIEWER", rules, "2026-10-28T10:00:00.000Z")).toThrow();
    const approval = createApproval(decision, "admin", "SECURITY_ADMIN", rules, "2026-10-28T10:00:00.000Z");
    expect(verifyApprovalIntegrity(approval)).toBe(true);
    expect(() => transitionApproval(approval, "APPROVED", "VIEWER", "2026-10-28T10:01:00.000Z")).toThrow();
    const approved = transitionApproval(approval, "APPROVED", "SECURITY_ADMIN", "2026-10-28T10:01:00.000Z");
    expect(approved.state).toBe("APPROVED");
  });

  it("detects tampering", () => {
    const decision = evaluatePolicy({
      tenantId: "tenant-a", actorId: "a", actorRole: "ANALYST", action: "ESCALATE_CRITICAL",
      priority: "CRITICAL", targetId: "f1", requestedAt: "2026-10-28T10:00:00.000Z",
    }, rules);
    expect(verifyPolicyDecisionIntegrity({ ...decision, reason: "tampered" })).toBe(false);
  });
});
