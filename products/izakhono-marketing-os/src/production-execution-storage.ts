import { FileExecutionPersistenceStore } from "./file-execution-persistence";
import type { ExecutionPersistenceStore } from "./execution-persistence";
import { FileExecutionLeaseStore, type ExecutionLeaseStore } from "./execution-lease";

const EPHEMERAL_PREFIXES = ["/tmp", "/var/task", "/vercel", "/workspace"];

export interface ProductionExecutionStorageConfig {
  ledgerPath: string;
}

export interface ProductionExecutionLeaseConfig {
  leaseDirectory: string;
}

function validatePersistentPath(path: string, label: string): string {
  const value = path.trim();
  if (!value) throw new Error(`IZAKHONO ${label} path is required`);
  if (!value.startsWith("/")) throw new Error(`IZAKHONO ${label} path must be absolute`);
  if (EPHEMERAL_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) {
    throw new Error(`IZAKHONO ${label} path cannot use an ephemeral filesystem path`);
  }
  return value;
}

export function createProductionExecutionStorage(
  config: ProductionExecutionStorageConfig,
): ExecutionPersistenceStore {
  return new FileExecutionPersistenceStore(validatePersistentPath(config.ledgerPath, "execution ledger"));
}

export function createProductionExecutionLeaseStore(
  config: ProductionExecutionLeaseConfig,
): ExecutionLeaseStore {
  return new FileExecutionLeaseStore(validatePersistentPath(config.leaseDirectory, "execution lease"));
}

export function createProductionExecutionStorageFromEnv(
  env: Record<string, string | undefined> = process.env,
): ExecutionPersistenceStore {
  const ledgerPath = env.IZAKHONO_EXECUTION_LEDGER_PATH;
  if (!ledgerPath) throw new Error("IZAKHONO_EXECUTION_LEDGER_PATH is required for production execution storage");
  return createProductionExecutionStorage({ ledgerPath });
}

export function createProductionExecutionLeaseStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): ExecutionLeaseStore {
  const leaseDirectory = env.IZAKHONO_EXECUTION_LEASE_DIRECTORY;
  if (!leaseDirectory) throw new Error("IZAKHONO_EXECUTION_LEASE_DIRECTORY is required for production execution leases");
  return createProductionExecutionLeaseStore({ leaseDirectory });
}
