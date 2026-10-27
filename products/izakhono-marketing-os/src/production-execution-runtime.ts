import {
  ExecutionRuntime,
  type AdapterExecutor,
  type ExecutionRuntimeClock,
} from "./execution-runtime";
import { createProductionExecutionLeaseStoreFromEnv, createProductionExecutionStorageFromEnv } from "./production-execution-storage";
import type { RetryPolicy } from "./execution-reliability";

export interface ProductionExecutionRuntimeOptions {
  executor: AdapterExecutor;
  retryPolicy: RetryPolicy;
  clock?: ExecutionRuntimeClock;
  leaseOwnerId?: string;
  leaseTtlMs?: number;
  env?: Record<string, string | undefined>;
}

/**
 * Production wiring deliberately requires explicit persistent ledger and lease
 * paths. It cannot silently fall back to memory or an ephemeral filesystem.
 */
export async function createProductionExecutionRuntime(
  options: ProductionExecutionRuntimeOptions,
): Promise<ExecutionRuntime> {
  const env = options.env ?? process.env;
  const persistence = createProductionExecutionStorageFromEnv(env);
  const leaseStore = createProductionExecutionLeaseStoreFromEnv(env);

  return ExecutionRuntime.restore(
    persistence,
    options.executor,
    options.retryPolicy,
    options.clock,
    leaseStore,
    options.leaseOwnerId,
    options.leaseTtlMs,
  );
}
