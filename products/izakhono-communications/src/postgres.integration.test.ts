import type { ProvisioningJob } from "./domain";
import { PostgresProvisioningRepository, type PgClient } from "./postgres";

/**
 * Runtime integration contract. Supply a real PgClient in the deployment test
 * harness; this file intentionally contains no credentials and performs no
 * connection by itself.
 */
export async function runPostgresProvisioningIntegrationTest(client: PgClient): Promise<void> {
  const repository = new PostgresProvisioningRepository(client);
  const tenantA = "00000000-0000-0000-0000-000000000001";
  const tenantB = "00000000-0000-0000-0000-000000000002";
  const job: ProvisioningJob = {
    id: crypto.randomUUID(),
    tenantId: tenantA,
    state: "REQUESTED",
    attempts: 0,
    updatedAt: new Date().toISOString(),
  };

  await repository.create(job, `integration-${job.id}`);
  const duplicate = await repository.findByIdempotencyKey(`integration-${job.id}`, tenantA);
  if (!duplicate || duplicate.id !== job.id) throw new Error("postgres_idempotency_failed");

  const fetched = await repository.get(job.id, tenantA);
  if (!fetched || fetched.tenantId !== tenantA) throw new Error("postgres_read_failed");

  const crossTenant = await repository.get(job.id, tenantB);
  if (crossTenant) throw new Error("postgres_tenant_isolation_failed");

  const advanced: ProvisioningJob = { ...job, state: "PAYMENT_CONFIRMED", attempts: 1, updatedAt: new Date().toISOString() };
  await repository.save(advanced, tenantA);
  const persisted = await repository.get(job.id, tenantA);
  if (!persisted || persisted.state !== "PAYMENT_CONFIRMED") throw new Error("postgres_update_failed");
}
