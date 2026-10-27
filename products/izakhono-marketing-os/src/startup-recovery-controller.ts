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
export interface StartupRecoverySummary { acquired: boolean; scanned: number; candidates: number; reconciled: number; skippedTerminal: number; skippedPreviouslyCompleted: number; unknown: number; failed: number; journalEntries: ReconciliationJournalEntry[]; }
export interface StartupRecoveryControllerOptions { persistence: ExecutionPersistenceStore; journal: ReconciliationJournalStore; leases: ExecutionLeaseStore; observer: StartupRecoveryObservationResolver; ownerId?: string; leaseTtlMs?: number; now?: () => string; }

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
    this.reconciliation = new ReconciliationRuntime(options.journal);
    this.journal = new ReconciliationJournal(options.journal);
  }

  async run(): Promise<StartupRecoverySummary> {
    const summary: StartupRecoverySummary = { acquired: false, scanned: 0, candidates: 0, reconciled: 0, skippedTerminal: 0, skippedPreviouslyCompleted: 0, unknown: 0, failed: 0, journalEntries: [] };
    let lease: ExecutionLease;
    try { lease = await this.options.leases.acquire(STARTUP_RECOVERY_LEASE, this.ownerId, this.now(), this.leaseTtlMs); }
    catch (error) { if (isLeaseContention(error)) return summary; throw error; }
    summary.acquired = true;
    try {
      const records = await this.options.persistence.load();
      summary.scanned = records.length;
      const latestByKey = new Map<string, RecoveryRecord>();
      for (const record of records) latestByKey.set(record.receipt.idempotencyKey, record);
      for (const record of latestByKey.values()) {
        await this.options.leases.assertCurrent(lease, this.now());
        if (record.receipt.nextAction !== "retry") { summary.skippedTerminal += 1; continue; }
        summary.candidates += 1;
        const latestJournal = await this.journal.latest(record.receipt.idempotencyKey);
        if (latestJournal?.decision === "completed" || latestJournal?.decision === "dead_letter") { summary.skippedPreviouslyCompleted += 1; continue; }
        try {
          const observation = await this.options.observer.observe(record);
          const result = await this.reconciliation.reconcile(record, observation);
          summary.journalEntries.push(result.journal);
          if (result.journal.decision === "completed" || result.journal.decision === "dead_letter") summary.reconciled += 1;
          else if (result.journal.decision === "unknown_external_state") summary.unknown += 1;
        } catch (error) { summary.failed += 1; throw error; }
      }
      await this.options.leases.assertCurrent(lease, this.now());
      return summary;
    } finally { await this.options.leases.release(lease); }
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
