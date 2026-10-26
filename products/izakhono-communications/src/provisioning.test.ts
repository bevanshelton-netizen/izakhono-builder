import { SimulatorCarrier } from "./carrier";
import type { ProvisioningJob } from "./domain";
import { ProvisioningService } from "./provisioning";

const service = new ProvisioningService(new SimulatorCarrier());
const base: ProvisioningJob = {
  id: "job-1",
  tenantId: "tenant-1",
  state: "REQUESTED",
  attempts: 0,
  updatedAt: new Date().toISOString(),
};

async function run() {
  let job = base;
  const expected = [
    "PAYMENT_CONFIRMED",
    "TENANT_CREATED",
    "NUMBER_ASSIGNED",
    "EXTENSIONS_CREATED",
    "ROUTING_CONFIGURED",
    "DEVICES_ISSUED",
    "SERVICE_VALIDATED",
    "ACTIVE",
  ] as const;

  for (const state of expected) {
    job = await service.advance(job, "+27115550123", "1001");
    if (job.state !== state) throw new Error(`expected_${state}_got_${job.state}`);
  }

  const stable = await service.advance(job, "+27115550123", "1001");
  if (stable.state !== "ACTIVE") throw new Error("active_job_not_idempotent");

  console.log("communications provisioning test: PASS");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
