import type { ExecutionObservation, ExecutionReconciliationEntry } from "./execution-reconciliation";
import { reconcileExecution } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { ReconciliationJournal, type ReconciliationJournalEntry, type ReconciliationJournalStore } from "./execution-reconciliation-journal";
import type { ExecutionPersistenceStore } from "./execution-persistence";
import type { ExecutionReceipt } from "./execution-reliability";
import { createFinalizationId, MemoryFinalizationStore, type FinalizationStore, validateFinalization } from "./execution-finalization";

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

function sameReceipt(left: ExecutionReceipt, right: ExecutionReceipt): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameJournal(left: ReconciliationJournalEntry, right: Omit<ReconciliationJournalEntry, "sequence">): boolean {
  return left.executionId === right.executionId
    && left.idempotencyKey === right.idempotencyKey
    && left.adapter === right.adapter
    && left.observed === right.observed
    && left.decision === right.decision
    && left.observedAt === right.observedAt
    && left.reconciledAt === right.reconciledAt
    && left.ownerId === right.ownerId
    && left.note === right.note;
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
      validateFinalization(finalization);

      const records = await this.persistence.load();
      const target = records.find((record) => record.sequence === finalization.target.sequence);
      if (target) {
        if (
          target.receipt.executionId !== finalization.target.receipt.executionId
          || target.receipt.idempotencyKey !== finalization.target.receipt.idempotencyKey
          || !sameReceipt(target.receipt, finalization.target.receipt)
        ) {
          throw new Error(`Finalization target conflicts with durable execution ledger at sequence ${finalization.target.sequence}`);
        }
      } else {
        const latestSequence = records.length > 0 ? records[records.length - 1].sequence : 0;
        if (finalization.target.sequence !== latestSequence + 1) {
          throw new Error(`Finalization target sequence ${finalization.target.sequence} cannot be safely replayed after durable ledger sequence ${latestSequence}`);
        }
        await this.persistence.append(finalization.target);
      }

      const latest = await this.journal.latest(finalization.target.receipt.idempotencyKey);
      if (latest) {
        if (!sameJournal(latest, finalization.journal)) {
          await this.journal.record(finalization.journal);
        }
      } else {
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
