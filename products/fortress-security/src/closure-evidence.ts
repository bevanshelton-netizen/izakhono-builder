import { createHash } from "node:crypto";
import type { RecoveryAuditEvent } from "./recovery-audit-ledger";
import type { OperatorApproval } from "./operator-approval-chain";
import type { RecoveryRecord } from "./recovery-state-machine";

export interface ClosureEvidence {
  tenantId: string;
  deliveryId: string;
  evidenceDigest: string;
  auditTailHash: string;
  approvalId: string;
  approvalIntegrityHash: string;
  recoveryIntegrityHash: string;
  attestationId: string;
  packageDigest: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createClosureEvidence(record: RecoveryRecord, audit: RecoveryAuditEvent[], approval: OperatorApproval, attestationId: string): ClosureEvidence {
  if (record.tenantId !== approval.tenantId || record.deliveryId !== approval.deliveryId) throw new Error("CLOSURE_TENANT_OR_DELIVERY_MISMATCH");
  if (audit.length === 0 || audit.at(-1)?.tenantId !== record.tenantId || audit.at(-1)?.deliveryId !== record.deliveryId) throw new Error("CLOSURE_AUDIT_MISMATCH");
  if (approval.evidenceDigest !== record.evidenceDigest) throw new Error("CLOSURE_EVIDENCE_MISMATCH");
  const unsigned = { tenantId: record.tenantId, deliveryId: record.deliveryId, evidenceDigest: record.evidenceDigest, auditTailHash: audit.at(-1)!.integrityHash, approvalId: digest(approval), approvalIntegrityHash: approval.integrityHash, recoveryIntegrityHash: record.integrityHash, attestationId };
  return { ...unsigned, packageDigest: digest(unsigned) };
}

export function verifyClosureEvidence(pkg: ClosureEvidence, record: RecoveryRecord, audit: RecoveryAuditEvent[], approval: OperatorApproval, attestationId: string): boolean {
  try {
    const expected = createClosureEvidence(record, audit, approval, attestationId);
    return pkg.packageDigest === expected.packageDigest && JSON.stringify(pkg) === JSON.stringify(expected);
  } catch {
    return false;
  }
}
