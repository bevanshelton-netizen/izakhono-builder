import type { ProvisioningJob } from "./domain";

export interface ProvisioningRepository {
  create(job: ProvisioningJob, idempotencyKey: string): Promise<ProvisioningJob>;
  get(id: string, tenantId: string): Promise<ProvisioningJob | undefined>;
  findByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<ProvisioningJob | undefined>;
  save(job: ProvisioningJob, tenantId: string): Promise<ProvisioningJob>;
}

/** Development/test repository. Production must use the PostgreSQL adapter. */
export class MemoryProvisioningRepository implements ProvisioningRepository {
  private readonly jobs = new Map<string, ProvisioningJob>();
  private readonly keys = new Map<string, string>();

  async create(job: ProvisioningJob, idempotencyKey: string): Promise<ProvisioningJob> {
    const existing = this.keys.get(`${job.tenantId}:${idempotencyKey}`);
    if (existing) return this.jobs.get(existing)!;
    this.keys.set(`${job.tenantId}:${idempotencyKey}`, job.id);
    this.jobs.set(job.id, job);
    return job;
  }

  async get(id: string, tenantId: string): Promise<ProvisioningJob | undefined> {
    const job = this.jobs.get(id);
    return job?.tenantId === tenantId ? job : undefined;
  }

  async findByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<ProvisioningJob | undefined> {
    const id = this.keys.get(`${tenantId}:${idempotencyKey}`);
    return id ? this.jobs.get(id) : undefined;
  }

  async save(job: ProvisioningJob, tenantId: string): Promise<ProvisioningJob> {
    if (job.tenantId !== tenantId) throw new Error("tenant_scope_violation");
    const existing = this.jobs.get(job.id);
    if (existing && existing.tenantId !== tenantId) throw new Error("tenant_scope_violation");
    this.jobs.set(job.id, job);
    return job;
  }
}
