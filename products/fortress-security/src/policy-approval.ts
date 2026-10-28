import { createHash } from "node:crypto";

export type PolicyRole = "OWNER" | "SECURITY_ADMIN" | "ANALYST" | "VIEWER";
export type PolicyAction =
  | "NOTIFY_SECURITY_ADMIN"
  | "ESCALATE_CRITICAL"
  | "REQUEST_RESCAN"
  | "OPEN_REMEDIATION"
  | "MARK_REGRESSION"
  | "REQUIRE_REVIEW";
export type PolicyPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ApprovalState = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";

const rank: Record<PolicyPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export interface PolicyRule {
  id: string;
  tenantId: string;
  action: PolicyAction;
  minimumPriority: PolicyPriority;
  proposerRoles: PolicyRole[];
  approverRoles: PolicyRole[];
  approvalRequired: boolean;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
}

export interface PolicyRequest {
  tenantId: string;
  actorId: string;
  actorRole: PolicyRole;
  action: PolicyAction;
  priority: PolicyPriority;
  targetId: string;
  requestedAt: string;
}

export interface PolicyDecision {
  id: string;
  tenantId: string;
  request: PolicyRequest;
  allowed: boolean;
  approvalRequired: boolean;
  matchedRuleId?: string;
  reason: string;
  integrityHash: string;
}

export interface Approval {
  id: string;
  tenantId: string;
  decisionId: string;
  approverId: string;
  approverRole: PolicyRole;
  state: ApprovalState;
  createdAt: string;
  expiresAt?: string;
  integrityHash: string;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function decisionId(request: PolicyRequest): string {
  return `pol_${hash(request).slice(0, 24)}`;
}

function approvalId(tenantId: string, decisionIdValue: string, approverId: string): string {
  return `apr_${hash({ tenantId, decisionId: decisionIdValue, approverId }).slice(0, 24)}`;
}

export function evaluatePolicy(request: PolicyRequest, rules: PolicyRule[]): PolicyDecision {
  const matched = rules
    .filter((r) => r.tenantId === request.tenantId && r.action === request.action)
    .find((r) => rank[request.priority] >= rank[r.minimumPriority]);

  const allowedByRole = matched?.proposerRoles.includes(request.actorRole) ?? false;
  const allowed = Boolean(matched && allowedByRole);
  const approvalRequired = Boolean(matched?.approvalRequired);
  const reason = !matched
    ? "DENY: no matching tenant-scoped policy rule"
    : !allowedByRole
      ? "DENY: actor role is not permitted to propose this action"
      : approvalRequired
        ? "ALLOW: policy matched; approval gate required before execution"
        : "ALLOW: policy matched; no approval gate required";

  const base = {
    id: decisionId(request),
    tenantId: request.tenantId,
    request,
    allowed,
    approvalRequired,
    ...(matched ? { matchedRuleId: matched.id } : {}),
    reason,
  };
  return { ...base, integrityHash: hash(base) };
}

export function createApproval(
  decision: PolicyDecision,
  approverId: string,
  approverRole: PolicyRole,
  rules: PolicyRule[],
  now: string,
): Approval {
  if (!decision.allowed || !decision.approvalRequired) throw new Error("approval gate is not required");
  if (decision.tenantId !== decision.request.tenantId) throw new Error("tenant isolation violation");
  const rule = rules.find((r) => r.id === decision.matchedRuleId && r.tenantId === decision.tenantId);
  if (!rule?.approverRoles.includes(approverRole)) throw new Error("approver role is not authorized");
  const expiresAt = rule.expiresInSeconds === undefined
    ? undefined
    : new Date(Date.parse(now) + rule.expiresInSeconds * 1000).toISOString();
  const base = {
    id: approvalId(decision.tenantId, decision.id, approverId),
    tenantId: decision.tenantId,
    decisionId: decision.id,
    approverId,
    approverRole,
    state: "PENDING" as ApprovalState,
    createdAt: now,
    ...(expiresAt ? { expiresAt } : {}),
  };
  return { ...base, integrityHash: hash(base) };
}

export function transitionApproval(
  approval: Approval,
  next: Exclude<ApprovalState, "PENDING">,
  actorRole: PolicyRole,
  now: string,
): Approval {
  if (approval.state !== "PENDING") throw new Error("approval is no longer pending");
  if (approval.expiresAt && Date.parse(now) >= Date.parse(approval.expiresAt)) {
    throw new Error("approval has expired");
  }
  if (next === "APPROVED" && !["OWNER", "SECURITY_ADMIN"].includes(actorRole)) {
    throw new Error("only OWNER or SECURITY_ADMIN may approve");
  }
  const base = { ...approval, state: next };
  return { ...base, integrityHash: hash({ ...base, integrityHash: undefined }) };
}

export function verifyPolicyDecisionIntegrity(decision: PolicyDecision): boolean {
  const { integrityHash, ...base } = decision;
  return hash(base) === integrityHash;
}

export function verifyApprovalIntegrity(approval: Approval): boolean {
  const { integrityHash, ...base } = approval;
  return hash(base) === integrityHash;
}

export function isolatePolicyRules(tenantId: string, rules: PolicyRule[]): PolicyRule[] {
  return rules.filter((rule) => rule.tenantId === tenantId);
}
