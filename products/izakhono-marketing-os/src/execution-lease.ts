import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface ExecutionLease {
  key: string;
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface ExecutionLeaseStore {
  acquire(key: string, ownerId: string, now: string, ttlMs: number): Promise<ExecutionLease>;
  renew(lease: ExecutionLease, now: string, ttlMs: number): Promise<ExecutionLease>;
  release(lease: ExecutionLease): Promise<void>;
}

export class MemoryExecutionLeaseStore implements ExecutionLeaseStore {
  private readonly leases = new Map<string, ExecutionLease>();

  async acquire(key: string, ownerId: string, now: string, ttlMs: number): Promise<ExecutionLease> {
    validateLeaseInput(key, ownerId, now, ttlMs);
    const existing = this.leases.get(key);
    if (existing && new Date(existing.expiresAt).getTime() > new Date(now).getTime()) {
      throw new Error(`Execution lease is held: ${key}`);
    }
    const lease = createLease(key, ownerId, now, ttlMs);
    this.leases.set(key, lease);
    return { ...lease };
  }

  async renew(lease: ExecutionLease, now: string, ttlMs: number): Promise<ExecutionLease> {
    validateLeaseInput(lease.key, lease.ownerId, now, ttlMs);
    const current = this.leases.get(lease.key);
    if (!current || current.ownerId !== lease.ownerId || current.acquiredAt !== lease.acquiredAt) {
      throw new Error(`Execution lease ownership lost: ${lease.key}`);
    }
    const renewed = createLease(lease.key, lease.ownerId, now, ttlMs, lease.acquiredAt);
    this.leases.set(lease.key, renewed);
    return { ...renewed };
  }

  async release(lease: ExecutionLease): Promise<void> {
    const current = this.leases.get(lease.key);
    if (!current) return;
    if (current.ownerId !== lease.ownerId || current.acquiredAt !== lease.acquiredAt) {
      throw new Error(`Execution lease ownership lost: ${lease.key}`);
    }
    this.leases.delete(lease.key);
  }
}

export class FileExecutionLeaseStore implements ExecutionLeaseStore {
  constructor(private readonly directory: string) {}

  private pathFor(key: string): string {
    return join(this.directory, `${Buffer.from(key, "utf8").toString("base64url")}.lock`);
  }

  async acquire(key: string, ownerId: string, now: string, ttlMs: number): Promise<ExecutionLease> {
    validateLeaseInput(key, ownerId, now, ttlMs);
    await mkdir(this.directory, { recursive: true });
    const path = this.pathFor(key);
    const lease = createLease(key, ownerId, now, ttlMs);

    try {
      await mkdir(path);
      await writeFile(join(path, "lease.json"), JSON.stringify(lease), "utf8");
      return { ...lease };
    } catch (error) {
      if (codeOf(error) !== "EEXIST") throw error;
    }

    const existing = await this.readLease(path);
    if (new Date(existing.expiresAt).getTime() > new Date(now).getTime()) {
      throw new Error(`Execution lease is held: ${key}`);
    }

    await rm(path, { recursive: true, force: true });
    try {
      await mkdir(path);
      await writeFile(join(path, "lease.json"), JSON.stringify(lease), "utf8");
      return { ...lease };
    } catch (error) {
      if (codeOf(error) === "EEXIST") throw new Error(`Execution lease contention: ${key}`);
      throw error;
    }
  }

  async renew(lease: ExecutionLease, now: string, ttlMs: number): Promise<ExecutionLease> {
    validateLeaseInput(lease.key, lease.ownerId, now, ttlMs);
    const path = this.pathFor(lease.key);
    const current = await this.readLease(path);
    if (current.ownerId !== lease.ownerId || current.acquiredAt !== lease.acquiredAt) {
      throw new Error(`Execution lease ownership lost: ${lease.key}`);
    }
    const renewed = createLease(lease.key, lease.ownerId, now, ttlMs, lease.acquiredAt);
    await writeFile(join(path, "lease.json"), JSON.stringify(renewed), "utf8");
    return { ...renewed };
  }

  async release(lease: ExecutionLease): Promise<void> {
    const path = this.pathFor(lease.key);
    const current = await this.readLease(path);
    if (current.ownerId !== lease.ownerId || current.acquiredAt !== lease.acquiredAt) {
      throw new Error(`Execution lease ownership lost: ${lease.key}`);
    }
    await rm(path, { recursive: true, force: true });
  }

  private async readLease(path: string): Promise<ExecutionLease> {
    try {
      const value = JSON.parse(await readFile(join(path, "lease.json"), "utf8")) as ExecutionLease;
      if (!value.key || !value.ownerId || !value.acquiredAt || !value.expiresAt) {
        throw new Error("Invalid execution lease record");
      }
      return value;
    } catch (error) {
      if (codeOf(error) === "ENOENT") throw new Error("Execution lease disappeared during coordination");
      throw error;
    }
  }
}

export function createExecutionLeaseOwnerId(env: Record<string, string | undefined> = process.env): string {
  return env.IZAKHONO_EXECUTION_OWNER_ID?.trim() || `${hostname()}:${process.pid}:${randomUUID()}`;
}

function createLease(key: string, ownerId: string, now: string, ttlMs: number, acquiredAt = now): ExecutionLease {
  return {
    key,
    ownerId,
    acquiredAt,
    expiresAt: new Date(new Date(now).getTime() + ttlMs).toISOString(),
  };
}

function validateLeaseInput(key: string, ownerId: string, now: string, ttlMs: number): void {
  if (!key.trim()) throw new Error("Execution lease key is required");
  if (!ownerId.trim()) throw new Error("Execution lease owner is required");
  if (!Number.isFinite(new Date(now).getTime())) throw new Error("Execution lease timestamp is invalid");
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new Error("Execution lease TTL must be a positive integer");
}

function codeOf(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}
