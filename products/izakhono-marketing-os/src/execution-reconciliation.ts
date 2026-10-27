import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";

export type ReconciliationState = "recorded" | "retryable" | "completed" | "dead_letter";

export interface ExecutionReconciliationEntry {
  idempotencyKey: string;
  executionId: string;
  attempt: number;
  state: ReconciliationState;
  adapter: "metricool" | "owned";
  recordedAt: string;
}

export interface ExecutionObservation {
  idempotencyKey: string;
  executionId: string;
  observedAt: string;
  providerResult: "success" | "retryable_failure" | "permanent_failure" | "unknown";
}

export function reconcileExecution(
  record: RecoveryRecord,
  observation: ExecutionObservation,
): ExecutionReconciliationEntry {
  if (record.receipt.idempotencyKey !== observation.idempotencyKey) {
    throw new Error("Reconciliation idempotency key mismatch");
  }
  if (record.receipt.executionId !== observation.executionId) {
    throw new Error("Reconciliation execution identity mismatch");
  }

  const state = stateFromReceipt(record.receipt, observation.providerResult);
  return {
    idempotencyKey: record.receipt.idempotencyKey,
    executionId: record.receipt.executionId,
    attempt: record.receipt.attempt,
    state,
    adapter: record.receipt.adapter,
    recordedAt: observation.observedAt,
  };
}

export function classifyOrphanedExecution(
  receipt: ExecutionReceipt,
  providerResult: ExecutionObservation["providerResult"],
): ReconciliationState {
  return stateFromReceipt(receipt, providerResult);
}

function stateFromReceipt(
  receipt: ExecutionReceipt,
  providerResult: ExecutionObservation["providerResult"],
): ReconciliationState {
  if (providerResult === "success" || receipt.result === "success") return "completed";
  if (providerResult === "permanent_failure" || receipt.result === "permanent_failure") return "dead_letter";
  if (providerResult === "retryable_failure" || receipt.result === "retryable_failure") return "retryable";
  return "recorded";
}
