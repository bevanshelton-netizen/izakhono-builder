import { createHash } from "node:crypto";

export interface GovernanceReceipt {
  tenantId: string;
  decisionId: string;
  approvalIds: string[];
  evidenceDigest: string;
  issuedAt: string;
  receiptId: string;
  integrityHash: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createGovernanceReceipt(input: Omit<GovernanceReceipt, "receiptId" | "integrityHash">): GovernanceReceipt {
  if (!input.tenantId || !input.decisionId || !input.evidenceDigest || input.approvalIds.length === 0) throw new Error("RECEIPT_INVALID");
  const receiptId = digest(input);
  return { ...input, receiptId, integrityHash: digest({ ...input, receiptId }) };
}

export function verifyGovernanceReceipt(receipt: GovernanceReceipt): boolean {
  const { receiptId, integrityHash, ...unsigned } = receipt;
  return Boolean(receipt.tenantId && receipt.decisionId && receipt.evidenceDigest) &&
    receipt.approvalIds.length > 0 && receiptId === digest(unsigned) && integrityHash === digest({ ...unsigned, receiptId });
}
