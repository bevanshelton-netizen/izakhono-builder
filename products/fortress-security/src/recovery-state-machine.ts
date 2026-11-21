import { createHash } from "node:crypto";

export type RecoveryState = "DEAD_LETTER" | "STORED" | "AUTHORIZED" | "REPLAYED" | "ATTESTED" | "CLOSED" | "QUARANTINED";

export interface RecoveryRecord {
  tenantId: string;
  deliveryId: string;
  state: RecoveryState;
  evidenceDigest: string;
  updatedAt: string;
  integrityHash: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const allowed: Record<RecoveryState, RecoveryState[]> = {
  DEAD_LETTER: ["STORED", "QUARANTINED"], STORED: ["AUTHORIZED", "QUARANTINED"], AUTHORIZED: ["REPLAYED", "QUARANTINED"], REPLAYED: ["ATTESTED", "QUARANTINED"], ATTESTED: ["CLOSED", "QUARANTINED"], CLOSED: [], QUARANTINED: []
};

export function createRecoveryRecord(input: Omit<RecoveryRecord, "integrityHash">): RecoveryRecord {
  return { ...input, integrityHash: digest(input) };
}

export function verifyRecoveryRecord(record: RecoveryRecord): boolean {
  const { integrityHash, ...unsigned } = record;
  return Boolean(record.tenantId && record.deliveryId && record.evidenceDigest) && integrityHash === digest(unsigned);
}

export function transitionRecovery(record: RecoveryRecord, nextState: RecoveryState, now = new Date().toISOString()): RecoveryRecord {
  if (!verifyRecoveryRecord(record)) throw new Error("RECOVERY_RECORD_TAMPERED");
  if (record.state === nextState) return record;
  if (!allowed[record.state].includes(nextState)) throw new Error("RECOVERY_TRANSITION_DENIED");
  const next = { ...record, state: nextState, updatedAt: now };
  return { ...next, integrityHash: digest(next) };
}

export function verifyEvidenceClosure(record: RecoveryRecord, evidenceDigest: string): boolean {
  return verifyRecoveryRecord(record) && record.evidenceDigest === evidenceDigest && ["ATTESTED", "CLOSED"].includes(record.state);
}
