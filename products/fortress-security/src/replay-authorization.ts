import { createHash } from "node:crypto";
import { DeadLetterRecord } from "./dead-letter-store";

export type ReplayDecision = "APPROVED" | "DENIED";

export interface ReplayAuthorization {
  id: string;
  tenantId: string;
  actorId: string;
  deliveryId: string;
  approvalId: string;
  reason: string;
  decision: ReplayDecision;
  createdAt: string;
  integrityHash: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unsigned(value: ReplayAuthorization): Omit<ReplayAuthorization, "integrityHash"> {
  const { integrityHash: _integrityHash, ...rest } = value;
  return rest;
}

export function authorizeReplay(record: DeadLetterRecord, actorId: string, approvalId: string, reason: string, createdAt: string): ReplayAuthorization {
  if (!actorId || !approvalId || !reason || record.replayStatus === "QUARANTINED" || record.replayStatus === "REPLAYED") {
    throw new Error("REPLAY_NOT_AUTHORIZED");
  }
  const base = { tenantId: record.tenantId, actorId, deliveryId: record.deliveryId, approvalId, reason, decision: "APPROVED" as const, createdAt };
  return { ...base, id: digest(base), integrityHash: digest(base) };
}

export function verifyReplayAuthorization(auth: ReplayAuthorization, record: DeadLetterRecord): boolean {
  return auth.tenantId === record.tenantId && auth.deliveryId === record.deliveryId && auth.decision === "APPROVED" && auth.id === digest(unsigned(auth)) && auth.integrityHash === digest(unsigned(auth));
}

export function replayIdempotencyKey(auth: ReplayAuthorization): string {
  return digest({ tenantId: auth.tenantId, deliveryId: auth.deliveryId, approvalId: auth.approvalId });
}
