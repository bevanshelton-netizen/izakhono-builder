import type { ProvisioningJob, ProvisioningState } from "./domain";
import type { ProvisioningRepository } from "./repository";

export type SqlExecutor = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

const rowToJob = (row: Record<string, unknown>): ProvisioningJob => ({
  id: String(row.id),
  tenantId: String(row.tenant_id),
  state: String(row.state).toUpperCase() as ProvisioningState,
  attempts: Number(row.attempt_count ?? 0),
  ...(row.last_error ? { lastError: String(row.last_error) } : {}),
  updatedAt: new Date(String(row.updated_at)).toISOString(),
});

/** Native PostgreSQL adapter. The caller owns the connection/pool and credentials. */
export class PostgresProvisioningRepository implements ProvisioningRepository {
  constructor(private readonly db: SqlExecutor) {}

  async create(job: ProvisioningJob, idempotencyKey: string): Promise<ProvisioningJob> {
    const result = await this.db.query(
      `insert into provisioning_jobs (id, tenant_id, job_type, idempotency_key, state, attempt_count, last_error, updated_at)
       values ($1, $2, 'voice_provisioning', $3, $4, $5, $6, now())
       on conflict (idempotency_key) do update set updated_at = provisioning_jobs.updated_at
       returning id, tenant_id, state, attempt_count, last_error, updated_at`,
      [job.id, job.tenantId, idempotencyKey, job.state.toLowerCase(), job.attempts, job.lastError ?? null],
    );
    return rowToJob(result.rows[0]);
  }

  async get(id: string, tenantId: string): Promise<ProvisioningJob | undefined> {
    const result = await this.db.query(
      `select id, tenant_id, state, attempt_count, last_error, updated_at
       from provisioning_jobs where id = $1 and tenant_id = $2 limit 1`,
      [id, tenantId],
    );
    return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
  }

  async findByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<ProvisioningJob | undefined> {
    const result = await this.db.query(
      `select id, tenant_id, state, attempt_count, last_error, updated_at
       from provisioning_jobs where idempotency_key = $1 and tenant_id = $2 limit 1`,
      [idempotencyKey, tenantId],
    );
    return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
  }

  async save(job: ProvisioningJob, tenantId: string): Promise<ProvisioningJob> {
    if (job.tenantId !== tenantId) throw new Error("tenant_scope_violation");
    const result = await this.db.query(
      `update provisioning_jobs
       set state = $1, attempt_count = $2, last_error = $3, updated_at = now()
       where id = $4 and tenant_id = $5
       returning id, tenant_id, state, attempt_count, last_error, updated_at`,
      [job.state.toLowerCase(), job.attempts, job.lastError ?? null, job.id, tenantId],
    );
    if (!result.rows[0]) throw new Error("provisioning_job_not_found");
    return rowToJob(result.rows[0]);
  }
}
