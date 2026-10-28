import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { FileExecutionLeaseStore, type ExecutionLease, type ExecutionLeaseStore } from "./execution-lease";
import { validateFinalization, type FinalizationStore, type RecoveryFinalizationRecord } from "./execution-finalization";

const EPHEMERAL_PREFIXES = ["/tmp", "/var/task", "/vercel", "/workspace"];

function validatePath(path: string): string {
  const value = path.trim();
  if (!value || !isAbsolute(value)) throw new Error("Finalization path must be absolute");
  if (EPHEMERAL_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) throw new Error("Finalization path must be persistent");
  return value;
}

export class FileExecutionFinalizationStore implements FinalizationStore {
  private readonly lockStore: ExecutionLeaseStore;
  private readonly ownerId: string;
  private readonly lockKey: string;

  constructor(private readonly filePath: string, options: { leaseStore?: ExecutionLeaseStore; ownerId?: string } = {}) {
    this.filePath = validatePath(filePath);
    this.lockStore = options.leaseStore ?? new FileExecutionLeaseStore(`${this.filePath}.locks`);
    this.ownerId = options.ownerId?.trim() || `finalization:${process.pid}`;
    this.lockKey = `execution-finalization:${this.filePath}`;
  }

  private async withLock<T>(work: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const lease = await this.lockStore.acquire(this.lockKey, this.ownerId, new Date().toISOString(), 30_000);
    try { return await work(); } finally { await this.lockStore.release(lease); }
  }

  private async read(): Promise<RecoveryFinalizationRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Finalization store must contain an array");
      for (const record of parsed) validateFinalization(record as RecoveryFinalizationRecord);
      return parsed as RecoveryFinalizationRecord[];
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(records: RecoveryFinalizationRecord[]): Promise<void> {
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(records) + "\n", { encoding: "utf8", flag: "wx" });
    await rename(temp, this.filePath);
  }

  async prepare(record: RecoveryFinalizationRecord): Promise<void> {
    validateFinalization(record);
    await this.withLock(async () => {
      const records = await this.read();
      const existing = records.find((item) => item.finalizationId === record.finalizationId);
      if (existing) {
        validateFinalization(existing);
        return;
      }
      records.push(structuredClone(record));
      await this.write(records);
    });
  }

  async commit(finalizationId: string, committedAt: string): Promise<void> {
    await this.withLock(async () => {
      const records = await this.read();
      const index = records.findIndex((item) => item.finalizationId === finalizationId);
      if (index < 0) throw new Error("Finalization does not exist");
      if (records[index].status === "committed") return;
      records[index] = { ...records[index], status: "committed", committedAt };
      validateFinalization(records[index]);
      await this.write(records);
    });
  }

  async load(): Promise<RecoveryFinalizationRecord[]> {
    return this.withLock(async () => (await this.read()).map((record) => structuredClone(record)));
  }
}

export function createProductionFinalizationStoreFromEnv(env: Record<string, string | undefined> = process.env): FileExecutionFinalizationStore {
  const path = env.IZAKHONO_FINALIZATION_PATH?.trim();
  if (!path) throw new Error("IZAKHONO_FINALIZATION_PATH is required for production finalization");
  return new FileExecutionFinalizationStore(path, { ownerId: env.IZAKHONO_EXECUTION_OWNER_ID });
}
