import { createHash } from "node:crypto";

export type ApprovalRole = "OWNER" | "SECURITY_ADMIN";

export interface OperatorApproval {
  tenantId: string;
  deliveryId: string;
  proposalId: string;
  proposerId: string;
  approverId: string;
  role: ApprovalRole;
  reason: string;
  evidenceDigest: string;
  expiresAt: string;
  createdAt: string;
  integrityHash: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createOperatorApproval(input: Omit<OperatorApproval, "integrityHash">): OperatorApproval {
  if (!input.tenantId || !input.deliveryId || !input.proposalId || !input.proposerId || !input.approverId || !input.reason || !input.evidenceDigest) throw new Error("APPROVAL_INVALID");
  if (input.proposerId === input.approverId) throw new Error("APPROVER_MUST_DIFFER_FROM_PROPOSER");
  if (!["OWNER", "SECURITY_ADMIN"].includes(input.role)) throw new Error("APPROVAL_ROLE_DENIED");
  if (new Date(input.expiresAt).getTime() <= new Date(input.createdAt).getTime()) throw new Error("APPROVAL_EXPIRY_INVALID");
  return { ...input, integrityHash: digest(input) };
}

export function verifyOperatorApproval(approval: OperatorApproval, now = new Date()): boolean {
  const { integrityHash, ...unsigned } = approval;
  return approval.proposerId !== approval.approverId && ["OWNER", "SECURITY_ADMIN"].includes(approval.role) && new Date(approval.expiresAt).getTime() > now.getTime() && integrityHash === digest(unsigned);
}
