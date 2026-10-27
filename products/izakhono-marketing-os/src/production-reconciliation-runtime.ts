import { ReconciliationRuntime, type ReconciliationRuntimeResult } from "./reconciliation-runtime";
import type { ExecutionObservation } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { createProductionReconciliationJournalStoreFromEnv } from "./file-reconciliation-journal";

export interface ProductionReconciliationRuntimeOptions {
  env?: Record<string, string | undefined>;
}

export function createProductionReconciliationRuntime(
  options: ProductionReconciliationRuntimeOptions = {},
): ReconciliationRuntime {
  const env = options.env ?? process.env;
  const path = env.IZAKHONO_RECONCILIATION_JOURNAL_PATH;
  if (!path) throw new Error("IZAKHONO_RECONCILIATION_JOURNAL_PATH is required for production reconciliation");
  const store = createProductionReconciliationJournalStoreFromEnv({
    ...env,
    IZAKHONO_RECONCILIATION_JOURNAL_PATH: path,
  });
  return new ReconciliationRuntime(store);
}

export async function reconcileProductionExecution(
  record: RecoveryRecord,
  observation: ExecutionObservation,
  options: ProductionReconciliationRuntimeOptions = {},
): Promise<ReconciliationRuntimeResult> {
  return createProductionReconciliationRuntime(options).reconcile(record, observation);
}
