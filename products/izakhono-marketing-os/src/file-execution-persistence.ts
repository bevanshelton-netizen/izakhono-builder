import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RecoveryRecord } from "./execution-recovery";
import { validateExecutionReceipt } from "./execution-reliability";
import type { ExecutionPersistenceStore } from "./execution-persistence";

/**
 * Durable JSONL persistence for an IZAKHONO-owned persistent runtime.
 *
 * The target filesystem must itself be persistent (for example, a mounted
 * IZAKHONO/NODES01 volume). This adapter deliberately does not claim that a
 * serverless/ephemeral filesystem is durable.
 */
export class FileExecutionPersistenceStore implements ExecutionPersistenceStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async ensureParent(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async append(record: RecoveryRecord): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      await this.ensureParent();
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
    });

    this.writeQueue = operation.catch(() => undefined);
    await operation;
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
