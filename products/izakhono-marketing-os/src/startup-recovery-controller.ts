import type { ExecutionObservation } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { ReconciliationJournal, type ReconciliationJournalEntry, type ReconciliationJournalStore } from "./execution-reconciliation-journal";
import { createProductionReconciliationJournalStoreFromEnv } from "./file-reconciliation-journal";
import type { ExecutionPersistenceStore } from "./execution-persistence";
import { createProductionExecutionStorageFromEnv, createProductionExecutionLeaseStoreFromEnv } from "./production-execution-storage";
import type { ExecutionLease, ExecutionLeaseStore } from "./execution-lease";
import { createExecutionLeaseOwnerId } from "./execution-lease";
import { ReconciliationRuntime } from "./reconciliation-runtime";
import type { ProviderObservationRegistry } from "./provider-observation";
import { createProductionProviderObservationRegistry } from "./production-provider-observation";

const STARTUP_RECOVERY_LEASE = "marketing-os-startup-recovery";
const DEFAULT_LEASE_TTL_MS = 30_000;

export interface StartupRecoveryObservationResolver { observe(record: RecoveryRecord): Promise<ExecutionObservation>; }
export interface StartupRecoverySummary { acquired: boolean; scanned: number; candidates: number; reconciled: number; skippedTerminal: number; skippedPreviouslyCompleted: number; unknown: number; failed: number; journalEntries: ReconciliationJournalEntry[]; failures: Array<{ idempotencyKey: string; error: string }>; }
export interface StartupRecoveryControllerOptions { persistence: ExecutionPersistenceStore; journal: ReconciliationJournalStore; leases: ExecutionLeaseStore; observer: StartupRecoveryObservationResolver; ownerId?: string; leaseTtlMs?: number; now?: () => string; }

function journalDecisionFromRecord(record: RecoveryRecord): ReconciliationJournalEntry["decision"] {
  if (record.receipt.nextAction === "complete") return "completed";
  if (record.receipt.nextAction === "dead_letter") return "dead_letter";
  if (record.receipt.nextAction === "retry") return "retryable";
  return "unknown_external_state";
}

function journalObservationFromRecord(record: RecoveryRecord): ReconciliationJournalEntry["observed"] {
  if (record.receipt.result === "success") return "provider_success";
  if (record.receipt.result === "permanent_failure") return "provider_permanent_failure";
  if (record.receipt.result === "retryable_failure") return "provider_retryable_failure";
  return "provider_unknown";
}

export class StartupRecoveryController {
  private readonly ownerId: string;
  private readonly leaseTtlMs: number;
  private readonly now: () => string;
  private readonly reconciliation: ReconciliationRuntime;
  private readonly journal: ReconciliationJournal;

  constructor(private readonly options: StartupRecoveryControllerOptions) {
    this.ownerId = options.ownerId?.trim() || createExecutionLeaseOwnerId();
    this.leaseTtlMs = options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
    this.now = options.now ?? (() => new Date().toISOString());
    if (!Number.isInteger(this.leaseTtlMs) || this.leaseTtlMs <= 0) throw new Error("Startup recovery lease TTL must be a positive integer");
    this.reconciliation = new ReconciliationRuntime(options.journal, options.persistence);
    this.journal = new ReconciliationJournal(options.journal);
  }

  private async repairTerminalJournal(record: RecoveryRecord): Promise<ReconciliationJournalEntry | undefined> {
    if (record.receipt.nextAction === "retry") return undefined;
    const latest = await this.journal.latest(record.receipt.idempotencyKey);
    const expectedDecision = journalDecisionFromRecord(record);
    if (latest?.executionId === record.receipt.executionId && latest.decision === expectedDecision) return latest;
    return this.journal.record({
      executionId: record.receipt.executionId,
      idempotencyKey: record.receipt.idempotencyKey,
      adapter: record.receipt.adapter,
      observed: journalObservationFromRecord(record),
      decision: expectedDecision,
      observedAt: record.receipt.recordedAt,
      reconciledAt: this.now(),
      ownerId: this.ownerId,
      note: "repaired from authoritative durable execution ledger after incomplete finalization",
    });
  }

  async run(): Promise<StartupRecoverySummary> {
    const summary: StartupRecoverySummary = { acquired: false, scanned: 0, candidates: 0, reconciled: 0, skippedTerminal: 0, skippedPreviouslyCompleted: 0, unknown: 0, failed: 0, journalEntries: [], failures: [] };
    let lease: ExecutionLease;
    try { lease = await this.options.leases.acquire(STARTUP_RECOVERY_LEASE, this.ownerId, this.now(), this.leaseTtlMs); }
    catch (error) { if (isLeaseContention(error)) return summary; throw error; }
    summary.acquired = true;

    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let heartbeatError: Error | undefined;
    const renew = async (): Promise<void> => {
      try { lease = await this.options.leases.renew(lease, this.now(), this.leaseTtlMs); }
      catch (error) { heartbeatError = error instanceof Error ? error : new Error(String(error)); }
    };

    try {
      await this.options.leases.assertCurrent(lease, this.now());
      heartbeat = setInterval(() => { void renew(); }, Math.max(1, Math.floor(this.leaseTtlMs / 3)));
      const records = await this.options.persistence.load();
      summary.scanned = records.length;
      const latestByKey = new Map<string, RecoveryRecord>();
      for (const record of records) latestByKey.set(record.receipt.idempotencyKey, record);
      for (const record of latestByKey.values()) {
        await this.options.leases.assertCurrent(lease, this.now());
        if (heartbeatError) throw heartbeatError;

        if (record.receipt.nextAction !== "retry") {
          try {
            const repaired = await this.repairTerminalJournal(record);
            if (repaired) summary.journalEntries.push(repaired);
          } catch (error) {
            summary.failed += 1;
            summary.failures.push({ idempotencyKey: record.receipt.idempotencyKey, error: error instanceof Error ? error.message : String(error) });
            continue;
          }
          summary.skippedTerminal += 1;
          continue;
        }

        summary.candidates += 1;
        try {
          const observation = await this.options.observer.observe(record);
          await this.options.leases.assertCurrent(lease, this.now());
          const result = await this.reconciliation.reconcile(record, observation);
          summary.journalEntries.push(result.journal);
          if (result.journal.decision === "completed" || result.journal.decision === "dead_letter") summary.reconciled += 1;
          else if (result.journal.decision === "unknown_external_state") summary.unknown += 1;
        } catch (error) {
          summary.failed += 1;
          summary.failures.push({ idempotencyKey: record.receipt.idempotencyKey, error: error instanceof Error ? error.message : String(error) });
          continue;
        }
      }
      if (heartbeatError) throw heartbeatError;
      await this.options.leases.assertCurrent(lease, this.now());
      return summary;
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await this.options.leases.release(lease);
    }
  }
}

export interface ProductionStartupRecoveryOptions { env?: Record<string, string | undefined>; observer: StartupRecoveryObservationResolver; ownerId?: string; leaseTtlMs?: number; }
export function createProductionStartupRecoveryController(options: ProductionStartupRecoveryOptions): StartupRecoveryController {
  const env = options.env ?? process.env;
  return new StartupRecoveryController({ persistence: createProductionExecutionStorageFromEnv(env), journal: createProductionReconciliationJournalStoreFromEnv(env), leases: createProductionExecutionLeaseStoreFromEnv(env), observer: options.observer, ownerId: options.ownerId ?? createExecutionLeaseOwnerId(env), leaseTtlMs: options.leaseTtlMs });
}
export function createProductionStartupRecoveryControllerFromProviderRegistry(options: Omit<ProductionStartupRecoveryOptions, "observer"> & { providerRegistry: ProviderObservationRegistry }): StartupRecoveryController {
  return createProductionStartupRecoveryController({ ...options, observer: options.providerRegistry });
}
export function createProductionStartupRecoveryControllerFromEnvironment(options: Omit<ProductionStartupRecoveryOptions, "observer" | "env"> & { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {}): StartupRecoveryController {
  const env = options.env ?? process.env;
  const providerRegistry = createProductionProviderObservationRegistry(env, options.fetchImpl ?? fetch);
  return createProductionStartupRecoveryController({ ...options, env, observer: providerRegistry });
}
function isLeaseContention(error: unknown): boolean { return error instanceof Error && /Execution lease (?:is held|contention):/.test(error.message); }
