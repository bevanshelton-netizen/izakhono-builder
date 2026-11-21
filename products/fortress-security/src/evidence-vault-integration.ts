import { createHash } from "node:crypto";

export interface EvidenceVaultRecord {
  tenantId: string;
  evidenceId: string;
  digest: string;
  expiresAt: string;
  integrityHash: string;
}

export interface RecoveryEvidenceBinding {
  tenantId: string;
  recoveryId: string;
  evidenceId: string;
  evidenceDigest: string;
  integrityHash: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createEvidenceRecord(input: Omit<EvidenceVaultRecord, "integrityHash">): EvidenceVaultRecord {
  if (!input.tenantId || !input.evidenceId || !input.digest) throw new Error("EVIDENCE_RECORD_INVALID");
  return { ...input, integrityHash: digest(input) };
}

export function verifyEvidenceRecord(record: EvidenceVaultRecord, now = new Date()): boolean {
  const { integrityHash, ...unsigned } = record;
  return Boolean(record.tenantId && record.evidenceId && record.digest) && new Date(record.expiresAt).getTime() > now.getTime() && integrityHash === digest(unsigned);
}

export function bindRecoveryEvidence(recoveryId: string, tenantId: string, record: EvidenceVaultRecord): RecoveryEvidenceBinding {
  if (!recoveryId || !tenantId || record.tenantId !== tenantId || !verifyEvidenceRecord(record)) throw new Error("EVIDENCE_BINDING_DENIED");
  const unsigned = { tenantId, recoveryId, evidenceId: record.evidenceId, evidenceDigest: record.digest };
  return { ...unsigned, integrityHash: digest(unsigned) };
}

export function verifyRecoveryEvidenceBinding(binding: RecoveryEvidenceBinding, record: EvidenceVaultRecord): boolean {
  const { integrityHash, ...unsigned } = binding;
  return binding.tenantId === record.tenantId && binding.evidenceId === record.evidenceId && binding.evidenceDigest === record.digest && verifyEvidenceRecord(record) && integrityHash === digest(unsigned);
}
