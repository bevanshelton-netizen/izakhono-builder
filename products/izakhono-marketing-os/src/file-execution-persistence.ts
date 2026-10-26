import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RecoveryRecord } from "./execution-recovery";
import type { ExecutionPersistenceStore } from "./execution-persistence";

/**
 * Durable JSONL persistence for an IZAKHONO-owned persistent runtime.
 *
 * The target filesystem must itself be persistent (for example, a mounted
 * IZAKHONO/NODES01 volume). This adapter deliberately does not claim that a
 * serverless/ephemeral filesystem is durable.
 */
export class FileExecutionPersistenceStore implements ExecutionPersistenceStore {
  constructor(private readonly filePath: string) {}

  private async ensureParent(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async append(record: RecoveryRecord): Promise<void> {
    await this.ensureParent();
    const existing = await this.load();
    const latest = existing[existing.length - 1];
    if (latest && record.sequence !== latest.sequence + 1) {
      throw new Error("Persistence sequence must be contiguous");
    }

    const handle = await open(this.filePath, "a");
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async load(): Promise<RecoveryRecord[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      if (!content.trim()) return [];

      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as RecoveryRecord);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
      if (code === "ENOENT") return [];
      throw error;
    }
  }
}
