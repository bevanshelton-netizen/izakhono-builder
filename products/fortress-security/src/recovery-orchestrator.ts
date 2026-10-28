import { createHash } from "node:crypto";

export type RecoveryAction = "REPLAY" | "SKIP" | "QUARANTINE";

export interface RecoveryEvent {
  tenantId: string;
  sequence: number;
  id: string;
  integrityHash: string;
  previousHash: string | null;
  payload: unknown;
}

export interface RecoveryCheckpoint {
  tenantId: string;
  lastSequence: number;
  lastHash: string | null;
  eventCount: number;
  stateDigest: string;
}

export interface RecoveryPlanItem {
  sequence: number;
  eventId: string;
  action: RecoveryAction;
}

export interface RecoveryPlan {
  tenantId: string;
  checkpoint: RecoveryCheckpoint;
  items: RecoveryPlanItem[];
  planDigest: string;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function validateRecoveryEvents(events: RecoveryEvent[], tenantId: string): void {
  let previous: RecoveryEvent | undefined;
  for (const event of events) {
    if (event.tenantId !== tenantId) throw new Error("RECOVERY_TENANT_MISMATCH");
    if (!Number.isInteger(event.sequence) || event.sequence < 1) throw new Error("RECOVERY_INVALID_SEQUENCE");
    if (previous) {
      if (event.sequence !== previous.sequence + 1) throw new Error("RECOVERY_SEQUENCE_GAP");
      if (event.previousHash !== previous.integrityHash) throw new Error("RECOVERY_CHAIN_MISMATCH");
    } else if (event.previousHash !== null) {
      throw new Error("RECOVERY_INVALID_ROOT");
    }
    if (digest({ id: event.id, tenantId: event.tenantId, sequence: event.sequence, previousHash: event.previousHash, payload: event.payload }) !== event.integrityHash) {
      throw new Error("RECOVERY_INTEGRITY_MISMATCH");
    }
    previous = event;
  }
}

export function createRecoveryCheckpoint(events: RecoveryEvent[], tenantId: string): RecoveryCheckpoint {
  validateRecoveryEvents(events, tenantId);
  const last = events.at(-1);
  return {
    tenantId,
    lastSequence: last?.sequence ?? 0,
    lastHash: last?.integrityHash ?? null,
    eventCount: events.length,
    stateDigest: digest(events),
  };
}

export function verifyRecoveryCheckpoint(events: RecoveryEvent[], checkpoint: RecoveryCheckpoint): boolean {
  try {
    const actual = createRecoveryCheckpoint(events, checkpoint.tenantId);
    return canonical(actual) === canonical(checkpoint);
  } catch {
    return false;
  }
}

export function planRecovery(current: RecoveryEvent[], checkpoint: RecoveryCheckpoint, target: RecoveryEvent[]): RecoveryPlan {
  validateRecoveryEvents(current, checkpoint.tenantId);
  validateRecoveryEvents(target, checkpoint.tenantId);
  if (!verifyRecoveryCheckpoint(current, checkpoint)) throw new Error("RECOVERY_CHECKPOINT_STALE_OR_TAMPERED");

  const currentIds = new Set(current.map((event) => event.id));
  const items = target.map((event) => ({
    sequence: event.sequence,
    eventId: event.id,
    action: currentIds.has(event.id) ? "SKIP" as const : "REPLAY" as const,
  }));

  return {
    tenantId: checkpoint.tenantId,
    checkpoint,
    items,
    planDigest: digest(items),
  };
}

export function verifyRecoveryPlan(plan: RecoveryPlan): boolean {
  return plan.planDigest === digest(plan.items);
}
