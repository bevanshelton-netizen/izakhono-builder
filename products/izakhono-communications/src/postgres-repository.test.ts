import { PostgresProvisioningRepository, type SqlExecutor } from "./postgres-repository";

class FakeDb implements SqlExecutor {
  public readonly calls: Array<{ sql: string; params: unknown[] }> = [];
  private rows: Record<string, unknown>[] = [];

  setRows(rows: Record<string, unknown>[]) { this.rows = rows; }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    this.calls.push({ sql, params });
    return { rows: this.rows as T[] };
  }
}

async function run() {
  const db = new FakeDb();
  const repo = new PostgresProvisioningRepository(db);
  db.setRows([{ id: "job-1", tenant_id: "tenant-1", state: "requested", attempt_count: 0, last_error: null, updated_at: "2026-10-26T10:00:00Z" }]);

  const created = await repo.create({ id: "job-1", tenantId: "tenant-1", state: "REQUESTED", attempts: 0, updatedAt: "2026-10-26T10:00:00Z" }, "idem-1");
  if (created.state !== "REQUESTED" || created.tenantId !== "tenant-1") throw new Error("create_mapping_failed");

  const found = await repo.findByIdempotencyKey("idem-1", "tenant-1");
  if (!found || found.id !== "job-1") throw new Error("idempotency_lookup_failed");

  const missing = await repo.get("job-1", "tenant-2");
  if (missing) throw new Error("tenant_isolation_failed");

  console.log("communications PostgreSQL repository test: PASS");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
