import type { ExecutionObservation, ExecutionReconciliationEntry } from "./execution-reconciliation";
import { reconcileExecution } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { ReconciliationJournal, type ReconciliationJournalEntry, type ReconciliationJournalStore } from "./execution-reconciliation-journal";
import type { ExecutionPersistenceStore } from "./execution-persistence";
import type { ExecutionReceipt } from "./execution-reliability";

export interface ReconciliationRuntimeResult {
  reconciliation: ExecutionReconciliationEntry;
  journal: ReconciliationJournalEntry;
  persisted: RecoveryRecord;
}

function receiptFromObservation(record: RecoveryRecord, observation: ExecutionObservation): ExecutionReceipt {
  const nextAction = observation.providerResult === "success"
    ? "complete"
    : observation.providerResult === "permanent_failure"
      ? "dead_letter"
      : "retry";
  const result = observation.providerResult === "success"
    ? "success"
    : observation.providerResult === "permanent_failure"
      ? "permanent_failure"
      : "retryable_failure";

  return {
    ...record.receipt,
    result,
    nextAction,
    recordedAt: observation.observedAt,
  };
}

export class ReconciliationRuntime {
  private readonly journal: ReconciliationJournal;

  constructor(
    store: ReconciliationJournalStore,
    private readonly persistence?: ExecutionPersistenceStore,
  ) {
    this.journal = new ReconciliationJournal(store);
  }

  async reconcile(record: RecoveryRecord, observation: ExecutionObservation): Promise<ReconciliationRuntimeResult> {
    const reconciliation = reconcileExecution(record, observation);
    const persisted: RecoveryRecord = {
      schema: "izakhono.marketing.recovery-record.v1",
      sequence: record.sequence + 1,
      receipt: receiptFromObservation(record, observation),
    };
    if (this.persistence) await this.persistence.append(persisted);

    const journal = await this.journal.record({
      executionId: reconciliation.executionId,
      idempotencyKey: reconciliation.idempotencyKey,
      adapter: reconciliation.adapter,
      observed: observation.providerResult === "success"
        ? "provider_success"
        : observation.providerResult === "retryable_failure"
          ? "provider_retryable_failure"
          : observation.providerResult === "permanent_failure"
            ? "provider_permanent_failure"
            : "provider_unknown",
      decision: reconciliation.state === "completed"
        ? "completed"
        : reconciliation.state === "retryable"
          ? "retryable"
          : reconciliation.state === "dead_letter"
            ? "dead_letter"
            : "unknown_external_state",
      observedAt: observation.observedAt,
      reconciledAt: new Date().toISOString(),
      ownerId: process.env.IZAKHONO_EXECUTION_OWNER_ID?.trim() || "reconciliation-runtime",
    });
    return { reconciliation, journal, persisted };
  }
}
