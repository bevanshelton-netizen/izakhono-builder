import type { ExecutionObservation, ExecutionReconciliationEntry } from "./execution-reconciliation";
import { reconcileExecution } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { ReconciliationJournal, type ReconciliationJournalEntry, type ReconciliationJournalStore } from "./execution-reconciliation-journal";
import type { ExecutionPersistenceStore } from "./execution-persistence";
import type { ExecutionReceipt } from "./execution-reliability";
import { createFinalizationId, MemoryFinalizationStore, type FinalizationStore } from "./execution-finalization";

export interface ReconciliationRuntimeResult {
  reconciliation: ExecutionReconciliationEntry;
  journal: ReconciliationJournalEntry;
  persisted: RecoveryRecord;
}

function receiptFromObservation(record: RecoveryRecord, observation: ExecutionObservation): ExecutionReceipt {
  const nextAction = observation.providerResult === "success" ? "complete" : observation.providerResult === "permanent_failure" ? "dead_letter" : "retry";
  const result = observation.providerResult === "success" ? "success" : observation.providerResult === "permanent_failure" ? "permanent_failure" : "retryable_failure";
  return { ...record.receipt, result, nextAction, recordedAt: observation.observedAt };
}

export class ReconciliationRuntime {
  private readonly journal: ReconciliationJournal;
  private readonly finalizations: FinalizationStore;

  constructor(
    store: ReconciliationJournalStore,
    private readonly persistence?: ExecutionPersistenceStore,
    finalizations: FinalizationStore = new MemoryFinalizationStore(),
  ) {
    this.journal = new ReconciliationJournal(store);
    this.finalizations = finalizations;
  }

  async replayPendingFinalizations(): Promise<number> {
    if (!this.persistence) return 0;
    let repaired = 0;
    for (const finalization of await this.finalizations.load()) {
      if (finalization.status === "committed") continue;
      const records = await this.persistence.load();
      const targetExists = records.some((record) => record.sequence === finalization.target.sequence && record.receipt.idempotencyKey === finalization.target.receipt.idempotencyKey);
      if (!targetExists) await this.persistence.append(finalization.target);
      const latest = await this.journal.latest(finalization.target.receipt.idempotencyKey);
      if (!latest || latest.executionId !== finalization.journal.executionId || latest.decision !== finalization.journal.decision) {
        await this.journal.record(finalization.journal);
      }
      await this.finalizations.commit(finalization.finalizationId, new Date().toISOString());
      repaired += 1;
    }
    return repaired;
  }

  async reconcile(record: RecoveryRecord, observation: ExecutionObservation): Promise<ReconciliationRuntimeResult> {
    const reconciliation = reconcileExecution(record, observation);
    const persisted: RecoveryRecord = {
      schema: "izakhono.marketing.recovery-record.v1",
      sequence: record.sequence + 1,
      receipt: receiptFromObservation(record, observation),
    };
    const journalIntent: Omit<ReconciliationJournalEntry, "sequence"> = {
      executionId: reconciliation.executionId,
      idempotencyKey: reconciliation.idempotencyKey,
      adapter: reconciliation.adapter,
      observed: observation.providerResult === "success" ? "provider_success" : observation.providerResult === "retryable_failure" ? "provider_retryable_failure" : observation.providerResult === "permanent_failure" ? "provider_permanent_failure" : "provider_unknown",
      decision: reconciliation.state === "completed" ? "completed" : reconciliation.state === "retryable" ? "retryable" : reconciliation.state === "dead_letter" ? "dead_letter" : "unknown_external_state",
      observedAt: observation.observedAt,
      reconciledAt: new Date().toISOString(),
      ownerId: process.env.IZAKHONO_EXECUTION_OWNER_ID?.trim() || "reconciliation-runtime",
    };
    const finalization = {
      schema: "izakhono.marketing.recovery-finalization.v1" as const,
      finalizationId: createFinalizationId(record, persisted),
      status: "prepared" as const,
      source: record,
      target: persisted,
      journal: journalIntent,
      preparedAt: new Date().toISOString(),
    };
    await this.finalizations.prepare(finalization);
    if (this.persistence) await this.persistence.append(persisted);
    const journal = await this.journal.record(journalIntent);
    await this.finalizations.commit(finalization.finalizationId, new Date().toISOString());
    return { reconciliation, journal, persisted };
  }
}
