import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileExecutionLeaseStore, MemoryExecutionLeaseStore } from "./execution-lease";

const directory = await mkdtemp(join(tmpdir(), "izakhono-lease-"));

try {
  const memory = new MemoryExecutionLeaseStore();
  const first = await memory.acquire("campaign:approval:facebook:scheduled", "node-a", "2026-10-27T08:00:00.000Z", 30_000);
  let memoryBlocked = false;
  try {
    await memory.acquire(first.key, "node-b", "2026-10-27T08:00:01.000Z", 30_000);
  } catch {
    memoryBlocked = true;
  }
  if (!memoryBlocked) throw new Error("Active in-memory lease must block another owner");
  const renewed = await memory.renew(first, "2026-10-27T08:00:05.000Z", 30_000);
  if (renewed.ownerId !== "node-a") throw new Error("Lease renewal must preserve ownership");
  await memory.release(renewed);

  const leaseDirectory = join(directory, "locks");
  const nodeA = new FileExecutionLeaseStore(leaseDirectory);
  const nodeB = new FileExecutionLeaseStore(leaseDirectory);
  const results = await Promise.allSettled([
    nodeA.acquire("campaign:approval:instagram:scheduled", "node-a", "2026-10-27T08:00:00.000Z", 30_000),
    nodeB.acquire("campaign:approval:instagram:scheduled", "node-b", "2026-10-27T08:00:00.000Z", 30_000),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  if (fulfilled.length !== 1 || rejected.length !== 1) {
    throw new Error("Cross-process lease contention must allow exactly one owner");
  }

  const lease = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<FileExecutionLeaseStore["acquire"]>>>).value;
  await nodeA.release(lease);
  const stale = await nodeA.acquire("campaign:approval:stale:scheduled", "node-a", "2026-10-27T08:00:00.000Z", 1_000);
  const recovered = await nodeB.acquire("campaign:approval:stale:scheduled", "node-b", "2026-10-27T08:00:02.000Z", 1_000);
  if (recovered.ownerId !== "node-b") throw new Error("Expired lease must be recoverable");
  await nodeB.release(recovered);
  void stale;

  const expiredKey = "campaign:approval:expired-race:scheduled";
  await nodeA.acquire(expiredKey, "node-a", "2026-10-27T08:00:00.000Z", 1_000);
  const takeoverResults = await Promise.allSettled([
    nodeA.acquire(expiredKey, "node-a-2", "2026-10-27T08:00:02.000Z", 1_000),
    nodeB.acquire(expiredKey, "node-b-2", "2026-10-27T08:00:02.000Z", 1_000),
  ]);
  const takeoverFulfilled = takeoverResults.filter((result) => result.status === "fulfilled");
  const takeoverRejected = takeoverResults.filter((result) => result.status === "rejected");
  if (takeoverFulfilled.length !== 1 || takeoverRejected.length !== 1) {
    throw new Error("Concurrent expired-lease takeover must have exactly one winner");
  }
  const winner = (takeoverFulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<FileExecutionLeaseStore["acquire"]>>>).value;
  await nodeA.release(winner).catch(async () => nodeB.release(winner));

  console.log("IZAKHONO MARKETING OS multi-process execution lease contract validated");
} finally {
  await rm(directory, { recursive: true, force: true });
}
