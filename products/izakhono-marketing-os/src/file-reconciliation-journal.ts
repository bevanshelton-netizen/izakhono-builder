import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import {
  FileExecutionLeaseStore,
  createExecutionLeaseOwnerId,
} from "./execution-lease";
import type {
  ReconciliationJournalEntry,
  ReconciliationJournalStore,
} from "./execution-reconciliation-journal";

function validatePersistentPath(path: string): void {
  if (!path || !path.startsWith("/")) throw new Error("Reconciliation journal path must be absolute");
  for (const prefix of ["/tmp", "/var/task", "/vercel", "/workspace"]) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      throw new Error("Reconciliation journal path must not be ephemeral");
    }
  }
}

function validateEntry(entry: ReconciliationJournalEntry): void {
  if (entry.schema !== "izakhono.marketing.reconciliation-journal.v1") throw new Error("Invalid reconciliation journal schema");
  if (entry.sequence < 1 || !Number.isInteger(entry.sequence)) throw new Error("Invalid reconciliation journal sequence");
  if (!entry.executionId || !entry.idempotencyKey || !entry.ownerId) throw new Error("Reconciliation journal identity is required");
  if (!entry.observedAt || !entry.reconciledAt) throw new Error("Reconciliation journal timestamps are required");
}

export class FileReconciliationJournalStore implements ReconciliationJournalStore {
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly leaseStore: FileExecutionLeaseStore;
  private readonly ownerId: string;

  constructor(private readonly path: string) {
    validatePersistentPath(path);
    this.leaseStore = new FileExecutionLeaseStore(`${path}.locks`);
    this.ownerId = createExecutionLeaseOwnerId();
  }

  async append(entry: ReconciliationJournalEntry): Promise<void> {
    validateEntry(entry);
    this.writeQueue = this.writeQueue.then(async () => {
      const lease = await this.leaseStore.acquire(
        `reconciliation-journal:${this.path}`,
        this.ownerId,
        new Date().toISOString(),
        10_000,
      );
      try {
        await fs.mkdir(dirname(this.path), { recursive: true });
        const records = await this.load();
        const latest = records[records.length - 1];
        if (entry.sequence !== records.length + 1) throw new Error("Reconciliation journal sequence must be contiguous");
        if (latest && entry.sequence <= latest.sequence) throw new Error("Reconciliation journal sequence must increase");
        await fs.appendFile(this.path, `${JSON.stringify(entry)}\n`, "utf8");
      } finally {
        await this.leaseStore.release(lease);
      }
    });
    return this.writeQueue;
  }

  async appendNext(entry: Omit<ReconciliationJournalEntry, "sequence">): Promise<ReconciliationJournalEntry> {
    const promise = this.writeQueue.then(async () => {
      const lease = await this.leaseStore.acquire(
        `reconciliation-journal:${this.path}`,
        this.ownerId,
        new Date().toISOString(),
        10_000,
      );
      try {
        await fs.mkdir(dirname(this.path), { recursive: true });
        const records = await this.load();
        const complete: ReconciliationJournalEntry = { ...entry, sequence: records.length + 1 };
        validateEntry(complete);
        await fs.appendFile(this.path, `${JSON.stringify(complete)}\n`, "utf8");
        return { ...complete };
      } finally {
        await this.leaseStore.release(lease);
      }
    });
    this.writeQueue = promise.then(() => undefined);
    return promise;
  }

  async load(): Promise<ReconciliationJournalEntry[]> {
    try {
      const content = await fs.readFile(this.path, "utf8");
      const lines = content.split("\n");
      if (lines.length && lines[lines.length - 1] === "") lines.pop();
      if (lines.some((line) => !line.trim())) throw new Error("Reconciliation journal contains a blank record");
      const records = lines.map((line) => JSON.parse(line) as ReconciliationJournalEntry);
      records.forEach((record, index) => {
        validateEntry(record);
        if (record.sequence !== index + 1) throw new Error("Reconciliation journal sequence is not contiguous");
      });
      return records.map((record) => ({ ...record }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

export function createProductionReconciliationJournalStoreFromEnv(): FileReconciliationJournalStore {
  const path = process.env.IZAKHONO_RECONCILIATION_JOURNAL_PATH;
  if (!path) throw new Error("IZAKHONO_RECONCILIATION_JOURNAL_PATH is required");
  return new FileReconciliationJournalStore(path);
}
