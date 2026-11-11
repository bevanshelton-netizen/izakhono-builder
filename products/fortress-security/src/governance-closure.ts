import { createHash } from "node:crypto";
import { verifyGovernanceDecision, type GovernanceDecision } from "./governance-decision-journal";
import { verifyGovernanceReceipt, type GovernanceReceipt } from "./governance-receipts";

export interface GovernanceClosure {
  tenantId: string;
  decision: GovernanceDecision;
  receipt: GovernanceReceipt;
  evidenceDigest: string;
  closureDigest: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createGovernanceClosure(decision: GovernanceDecision, receipt: GovernanceReceipt): GovernanceClosure {
  if (decision.tenantId !== receipt.tenantId || decision.decisionId !== receipt.decisionId || decision.evidenceDigest !== receipt.evidenceDigest) {
    throw new Error("CLOSURE_BINDING_INVALID");
  }
  if (!verifyGovernanceDecision(decision) || !verifyGovernanceReceipt(receipt)) throw new Error("CLOSURE_INTEGRITY_INVALID");
  const base = { tenantId: decision.tenantId, decisionId: decision.decisionId, receiptId: receipt.receiptId, evidenceDigest: decision.evidenceDigest };
  return { tenantId: decision.tenantId, decision, receipt, evidenceDigest: decision.evidenceDigest, closureDigest: digest(base) };
}

export function verifyGovernanceClosure(closure: GovernanceClosure): boolean {
  if (closure.tenantId !== closure.decision.tenantId || closure.tenantId !== closure.receipt.tenantId) return false;
  if (closure.decision.decisionId !== closure.receipt.decisionId || closure.evidenceDigest !== closure.decision.evidenceDigest) return false;
  if (!verifyGovernanceDecision(closure.decision) || !verifyGovernanceReceipt(closure.receipt)) return false;
  return closure.closureDigest === digest({ tenantId: closure.tenantId, decisionId: closure.decision.decisionId, receiptId: closure.receipt.receiptId, evidenceDigest: closure.evidenceDigest });
}
