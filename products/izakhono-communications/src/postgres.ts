import type { ProvisioningJob, ProvisioningState } from "./domain";
import type { ProvisioningRepository } from "./repository";

/** Minimal database contract so the adapter does not own a driver dependency. */
export type PgClient = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type JobRow = {
  id: string;
  tenant_id: string | null;
  state: string;
  attempt_count: number;
  updated_at: string;
};

const mapJob = (row: JobRow): ProvisioningJob => ({
  id: row.id,
  tenantId: row.tenant_id ?? "",
  state: row.state.toUpperCase() as ProvisioningState,
  attempts: row.attempt_count,
  updatedAt: new Date(row.updated_at).toISOString(),
});

/**
 * IZAKHONO-owned PostgreSQL persistence adapter.
 *
 * The adapter intentionally depends only on the narrow PgClient contract.
 * The runtime supplies the actual PostgreSQL driver/pool and credentials.
 */
export class PostgresProvisioningRepository implements ProvisioningRepository {
  constructor(private readonly db: PgClient) {}

  async create(job: ProvisioningJob, idempotencyKey: string): Promise<ProvisioningJob> {
    const existing = await this.findByIdempotencyKey(idempotencyKey, job.tenantId);
    if (existing) return existing;

    const result = await this.db.query<JobRow>(
      `insert into provisioning_jobs
        (id, tenant_id, job_type, idempotency_key, state, attempt_count, payload, updated_at)
       values ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7)
       returning id, tenant_id, state, attempt_count, updated_at`,
      [job.id, job.tenantId || null, "communications_provisioning", idempotencyKey, job.state.toLowerCase(), job.attempts, job.updatedAt],
    );
    return mapJob(result.rows[0]);
  }

  async get(id: string, tenantId: string): Promise<ProvisioningJob | undefined> {
    const result = await this.db.query<JobRow>(
      `select id, tenant_id, state, attempt_count, updated_at
         from provisioning_jobs
        where id = $1 and tenant_id = $2
        limit 1`,
      [id, tenantId],
    );
    return result.rows[0] ? mapJob(result.rows[0]) : undefined;
  }

  async findByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<ProvisioningJob | undefined> {
    const result = await this.db.query<JobRow>(
      `select id, tenant_id, state, attempt_count, updated_at
         from provisioning_jobs
        where idempotency_key = $1 and tenant_id = $2
        limit 1`,
      [idempotencyKey, tenantId],
    );
    return result.rows[0] ? mapJob(result.rows[0]) : undefined;
  }

  async save(job: ProvisioningJob, tenantId: string): Promise<ProvisioningJob> {
    if (job.tenantId !== tenantId) throw new Error("tenant_scope_violation");

    const result = await this.db.query<JobRow>(
      `update provisioning_jobs
          set state = $1,
              attempt_count = $2,
              updated_at = $3
        where id = $4 and tenant_id = $5
        returning id, tenant_id, state, attempt_count, updated_at`,
      [job.state.toLowerCase(), job.attempts, job.updatedAt, job.id, tenantId],
    );

    if (!result.rows[0]) throw new Error("provisioning_job_not_found");
    return mapJob(result.rows[0]);
  }
}
