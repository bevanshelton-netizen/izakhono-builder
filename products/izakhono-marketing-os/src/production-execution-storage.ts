import { FileExecutionPersistenceStore } from "./file-execution-persistence";
import type { ExecutionPersistenceStore } from "./execution-persistence";

const EPHEMERAL_PREFIXES = ["/tmp", "/var/task", "/vercel", "/workspace"];

export interface ProductionExecutionStorageConfig {
  ledgerPath: string;
}

export function createProductionExecutionStorage(
  config: ProductionExecutionStorageConfig,
): ExecutionPersistenceStore {
  const path = config.ledgerPath.trim();
  if (!path) throw new Error("IZAKHONO execution ledger path is required");
  if (!path.startsWith("/")) throw new Error("IZAKHONO execution ledger path must be absolute");
  if (EPHEMERAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error("IZAKHONO execution ledger cannot use an ephemeral filesystem path");
  }
  return new FileExecutionPersistenceStore(path);
}

export function createProductionExecutionStorageFromEnv(
  env: Record<string, string | undefined> = process.env,
): ExecutionPersistenceStore {
  const ledgerPath = env.IZAKHONO_EXECUTION_LEDGER_PATH;
  if (!ledgerPath) throw new Error("IZAKHONO_EXECUTION_LEDGER_PATH is required for production execution storage");
  return createProductionExecutionStorage({ ledgerPath });
}
