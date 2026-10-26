import type { ProvisioningJob } from "./domain";

export interface ProvisioningRepository {
  get(id: string): Promise<ProvisioningJob | undefined>;
  getByIdempotencyKey(key: string): Promise<ProvisioningJob | undefined>;
  save(job: ProvisioningJob): Promise<void>;
  listByTenant(tenantId: string): Promise<ProvisioningJob[]>;
}

/** Development-only repository. Replace with the native IZAKHONO PostgreSQL adapter. */
export class MemoryProvisioningRepository implements ProvisioningRepository {
  private readonly jobs = new Map<string, ProvisioningJob>();

  async get(id: string) { return this.jobs.get(id); }

  async getByIdempotencyKey(key: string) {
    return [...this.jobs.values()].find((job) => job.id === key);
  }

  async save(job: ProvisioningJob) {
    this.jobs.set(job.id, { ...job });
  }

  async listByTenant(tenantId: string) {
    return [...this.jobs.values()].filter((job) => job.tenantId === tenantId);
  }
}
