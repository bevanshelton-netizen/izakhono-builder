import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, isAbsolute, normalize } from "node:path";
import { createExecutionLeaseOwnerId, FileExecutionLeaseStore, type ExecutionLease, type ExecutionLeaseStore } from "./execution-lease";
import type { RecoveryRecord } from "./execution-recovery";
import { validateExecutionReceipt } from "./execution-reliability";
import type { ExecutionPersistenceStore } from "./execution-persistence";

const PRODUCTION_LEDGER_ENV = "IZAKHONO_EXECUTION_LEDGER_PATH";
const KNOWN_EPHEMERAL_PREFIXES = ["/tmp", "/var/task", "/workspace"];
const LEDGER_LOCK_TTL_MS = 30_000;
const LEDGER_LOCK_RETRY_MS = 25;
const LEDGER_LOCK_TIMEOUT_MS = 10_000;

/**
 * Durable JSONL persistence for an IZAKHONO-owned persistent runtime.
 *
 * The target filesystem must itself be persistent (for example, a mounted
 * IZAKHONO/NODES01 volume). This adapter deliberately does not claim that a
 * serverless/ephemeral filesystem is durable.
 *
 * Appends are protected by a filesystem lease so separate runtime processes
 * cannot both read the same tail sequence and append conflicting records.
 */
export class FileExecutionPersistenceStore implements ExecutionPersistenceStore {
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly leaseStore: ExecutionLeaseStore;
  private readonly ownerId: string;
  private readonly leaseKey: string;

  constructor(
    private readonly filePath: string,
    options: { leaseStore?: ExecutionLeaseStore; ownerId?: string; leaseDirectory?: string } = {},
  ) {
    this.leaseStore = options.leaseStore ?? new FileExecutionLeaseStore(`${filePath}.locks`);
    this.ownerId = options.ownerId?.trim() || createExecutionLeaseOwnerId();
    this.leaseKey = `execution-ledger:${filePath}`;
  }

  private async ensureParent(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async append(record: RecoveryRecord): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      await this.ensureParent();
      const lease = await this.acquireLedgerLease();
      try {
        await this.appendUnderLease(record, lease);
      } finally {
        await this.leaseStore.release(lease);
      }
    });

    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  private async appendUnderLease(record: RecoveryRecord, lease: ExecutionLease): Promise<void> {
    await this.leaseStore.assertCurrent(lease, new Date().toISOString());
    const existing = await this.load();
    const latest = existing[existing.length - 1];
    const expectedSequence = latest ? latest.sequence + 1 : 1;
    if (record.sequence !== expectedSequence) {
      throw new Error("Persistence sequence must be contiguous");
    }
    if (record.schema !== "izakhono.marketing.recovery-record.v1") {
      throw new Error("Invalid recovery record schema");
    }
    validateExecutionReceipt(record.receipt);

    const handle = await open(this.filePath, "a");
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await this.leaseStore.assertCurrent(lease, new Date().toISOString());
  }

  private async acquireLedgerLease(): Promise<ExecutionLease> {
    const startedAt = Date.now();
    let lastError: unknown;
    while (Date.now() - startedAt < LEDGER_LOCK_TIMEOUT_MS) {
      const now = new Date().toISOString();
      try {
        return await this.leaseStore.acquire(this.leaseKey, this.ownerId, now, LEDGER_LOCK_TTL_MS);
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || !/Execution lease (?:is held|contention):/.test(error.message)) throw error;
        await new Promise((resolve) => setTimeout(resolve, LEDGER_LOCK_RETRY_MS));
      }
    }
    throw lastError instanceof Error
      ? new Error(`Execution ledger write lock timeout: ${lastError.message}`)
      : new Error("Execution ledger write lock timeout");
  }

  async load(): Promise<RecoveryRecord[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      if (!content) return [];

      const lines = content.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();
      if (lines.some((line) => line.trim() === "")) {
        throw new Error("Persistence ledger contains an unexpected blank record line");
      }

      const records = lines.map((line) => {
        const record = JSON.parse(line) as RecoveryRecord;
        if (record.schema !== "izakhono.marketing.recovery-record.v1") {
          throw new Error("Invalid recovery record schema in persistence store");
        }
        validateExecutionReceipt(record.receipt);
        return record;
      });

      records.forEach((record, index) => {
        if (record.sequence !== index + 1) {
          throw new Error("Persistence sequence is not contiguous");
        }
      });

      return records;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
      if (code === "ENOENT") return [];
      throw error;
    }
  }
}

/**
 * Production storage is fail-closed: no implicit /tmp or serverless fallback.
 * IZAKHONO infrastructure must explicitly provide the durable ledger path.
 */
export function createProductionExecutionPersistenceStore(
  env: Record<string, string | undefined> = process.env,
): ExecutionPersistenceStore {
  const configured = env[PRODUCTION_LEDGER_ENV]?.trim();
  if (!configured) {
    throw new Error(`${PRODUCTION_LEDGER_ENV} is required for production execution storage`);
  }

  const path = normalize(configured);
  if (!isAbsolute(path)) {
    throw new Error(`${PRODUCTION_LEDGER_ENV} must be an absolute persistent filesystem path`);
  }

  if (KNOWN_EPHEMERAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error(`${PRODUCTION_LEDGER_ENV} points to a known ephemeral filesystem location`);
  }

  return new FileExecutionPersistenceStore(path);
}
