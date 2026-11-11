import { createHash } from "node:crypto";
import { DeadLetterRecord } from "./dead-letter-store";
import { ReplayAuthorization } from "./replay-authorization";

export interface RecoveryAttestation {
  id: string;
  tenantId: string;
  deliveryId: string;
  deadLetterDigest: string;
  authorizationDigest: string;
  result: "REPLAYED" | "QUARANTINED";
  createdAt: string;
  integrityHash: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createRecoveryAttestation(record: DeadLetterRecord, authorization: ReplayAuthorization, result: RecoveryAttestation["result"], createdAt: string): RecoveryAttestation {
  if (record.tenantId !== authorization.tenantId || record.deliveryId !== authorization.deliveryId) throw new Error("ATTESTATION_BINDING_MISMATCH");
  const deadLetterDigest = digest(record);
  const authorizationDigest = digest(authorization);
  const base = { tenantId: record.tenantId, deliveryId: record.deliveryId, deadLetterDigest, authorizationDigest, result, createdAt };
  return { ...base, id: digest(base), integrityHash: digest(base) };
}

export function verifyRecoveryAttestation(attestation: RecoveryAttestation, record: DeadLetterRecord, authorization: ReplayAuthorization): boolean {
  const deadLetterDigest = digest(record);
  const authorizationDigest = digest(authorization);
  const base = { tenantId: attestation.tenantId, deliveryId: attestation.deliveryId, deadLetterDigest, authorizationDigest, result: attestation.result, createdAt: attestation.createdAt };
  return attestation.id === digest(base) && attestation.integrityHash === digest(base) && attestation.deadLetterDigest === deadLetterDigest && attestation.authorizationDigest === authorizationDigest && attestation.tenantId === record.tenantId && attestation.deliveryId === record.deliveryId;
}
