import type { CarrierCapabilities } from "./carrier";
import type { ProvisioningJob, ProvisioningState } from "./domain";

const NEXT: Partial<Record<ProvisioningState, ProvisioningState>> = {
  REQUESTED: "PAYMENT_CONFIRMED",
  PAYMENT_CONFIRMED: "TENANT_CREATED",
  TENANT_CREATED: "NUMBER_ASSIGNED",
  NUMBER_ASSIGNED: "EXTENSIONS_CREATED",
  EXTENSIONS_CREATED: "ROUTING_CONFIGURED",
  ROUTING_CONFIGURED: "DEVICES_ISSUED",
  DEVICES_ISSUED: "SERVICE_VALIDATED",
  SERVICE_VALIDATED: "ACTIVE",
};

export class ProvisioningService {
  constructor(private readonly carrier: CarrierCapabilities) {}

  async advance(job: ProvisioningJob, number: string, extension: string): Promise<ProvisioningJob> {
    if (job.state === "ACTIVE") return job;
    if (job.state === "REQUIRES_ATTENTION") return job;

    try {
      switch (job.state) {
        case "PAYMENT_CONFIRMED":
          await this.ensureNumber(number);
          break;
        case "NUMBER_ASSIGNED":
          await this.carrier.createSipCredential(extension);
          break;
        case "EXTENSIONS_CREATED":
          await this.carrier.configureInboundRoute(number, extension);
          await this.carrier.configureOutboundRoute(extension, number);
          break;
        case "DEVICES_ISSUED": {
          const health = await this.carrier.healthCheck();
          if (!health.healthy) throw new Error("carrier_unhealthy");
          break;
        }
        default:
          break;
      }

      const next = NEXT[job.state];
      if (!next) throw new Error(`invalid_provisioning_state:${job.state}`);
      return { ...job, state: next, attempts: job.attempts, updatedAt: new Date().toISOString() };
    } catch (error) {
      return {
        ...job,
        state: "REQUIRES_ATTENTION",
        attempts: job.attempts + 1,
        lastError: error instanceof Error ? error.message : "unknown_error",
        updatedAt: new Date().toISOString(),
      };
    }
  }

  private async ensureNumber(number: string) {
    await this.carrier.reserveNumber(number);
  }
}
