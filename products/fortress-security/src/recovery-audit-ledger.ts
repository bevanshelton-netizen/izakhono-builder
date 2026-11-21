import { createHash } from "node:crypto";

export type RecoveryAuditEventType = "STATE_TRANSITION" | "OPERATOR_APPROVAL" | "QUARANTINE" | "ATTESTATION" | "CLOSURE";

export interface RecoveryAuditEvent {
  tenantId: string;
  deliveryId: string;
  sequence: number;
  type: RecoveryAuditEventType;
  subjectId: string;
  createdAt: string;
  previousHash: string;
  integrityHash: string;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createRecoveryAuditEvent(input: Omit<RecoveryAuditEvent, "integrityHash">): RecoveryAuditEvent {
  if (!input.tenantId || !input.deliveryId || !input.subjectId || input.sequence < 1) throw new Error("AUDIT_EVENT_INVALID");
  return { ...input, integrityHash: digest(input) };
}

export function verifyRecoveryAuditEvent(event: RecoveryAuditEvent): boolean {
  const { integrityHash, ...unsigned } = event;
  return Boolean(event.tenantId && event.deliveryId && event.subjectId) && event.sequence >= 1 && integrityHash === digest(unsigned);
}

export function verifyRecoveryAuditChain(events: RecoveryAuditEvent[], tenantId: string, deliveryId: string): boolean {
  let previousHash = "GENESIS";
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.tenantId !== tenantId || event.deliveryId !== deliveryId) return false;
    if (event.sequence !== i + 1 || event.previousHash !== previousHash || !verifyRecoveryAuditEvent(event)) return false;
    previousHash = event.integrityHash;
  }
  return true;
}

export function appendRecoveryAuditEvent(events: RecoveryAuditEvent[], input: Omit<RecoveryAuditEvent, "sequence" | "previousHash" | "integrityHash">): RecoveryAuditEvent[] {
  if (!verifyRecoveryAuditChain(events, input.tenantId, input.deliveryId)) throw new Error("AUDIT_CHAIN_INVALID");
  const event = createRecoveryAuditEvent({ ...input, sequence: events.length + 1, previousHash: events.at(-1)?.integrityHash ?? "GENESIS" });
  return [...events, event];
}
