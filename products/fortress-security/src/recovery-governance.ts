import { createHash } from "node:crypto";

export type GovernanceRole = "OWNER" | "SECURITY_ADMIN";

export interface GovernanceApproval {
  tenantId: string;
  recoveryId: string;
  approverId: string;
  role: GovernanceRole;
  approvedAt: string;
  expiresAt: string;
  evidenceDigest: string;
  integrityHash: string;
}

export interface GovernancePolicy {
  tenantId: string;
  recoveryId: string;
  requiredRoles: GovernanceRole[];
  quorum: number;
  expiresAt: string;
}

export interface GovernanceDecision {
  tenantId: string;
  recoveryId: string;
  proposerId: string;
  approvalIds: string[];
  evidenceDigest: string;
  authorized: boolean;
  integrityHash: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createGovernanceApproval(input: Omit<GovernanceApproval, "integrityHash">): GovernanceApproval {
  if (!input.tenantId || !input.recoveryId || !input.approverId || !input.evidenceDigest) throw new Error("GOVERNANCE_APPROVAL_INVALID");
  if (new Date(input.expiresAt).getTime() <= new Date(input.approvedAt).getTime()) throw new Error("GOVERNANCE_APPROVAL_EXPIRY_INVALID");
  return { ...input, integrityHash: digest(input) };
}

export function verifyGovernanceApproval(approval: GovernanceApproval): boolean {
  const { integrityHash, ...unsigned } = approval;
  return Boolean(approval.tenantId && approval.recoveryId && approval.approverId && approval.evidenceDigest) && integrityHash === digest(unsigned);
}

export function evaluateGovernance(policy: GovernancePolicy, proposerId: string, approvals: GovernanceApproval[], evidenceDigest: string, now = new Date()): GovernanceDecision {
  if (!policy.tenantId || !policy.recoveryId || !proposerId || !evidenceDigest || policy.quorum < 1) throw new Error("GOVERNANCE_POLICY_INVALID");
  const eligible = approvals.filter((a) => a.tenantId === policy.tenantId && a.recoveryId === policy.recoveryId && a.approverId !== proposerId && policy.requiredRoles.includes(a.role) && a.evidenceDigest === evidenceDigest && verifyGovernanceApproval(a) && new Date(a.expiresAt).getTime() > now.getTime());
  const unique = new Map(eligible.map((a) => [a.approverId, a]));
  const roleSatisfied = policy.requiredRoles.every((role) => [...unique.values()].some((a) => a.role === role));
  const authorized = unique.size >= policy.quorum && roleSatisfied && new Date(policy.expiresAt).getTime() > now.getTime();
  const approvalIds = [...unique.values()].map((a) => a.integrityHash).sort();
  const unsigned = { tenantId: policy.tenantId, recoveryId: policy.recoveryId, proposerId, approvalIds, evidenceDigest, authorized };
  return { ...unsigned, integrityHash: digest(unsigned) };
}

export function verifyGovernanceDecision(decision: GovernanceDecision): boolean {
  const { integrityHash, ...unsigned } = decision;
  return Boolean(decision.tenantId && decision.recoveryId && decision.proposerId && decision.evidenceDigest) && integrityHash === digest(unsigned);
}
