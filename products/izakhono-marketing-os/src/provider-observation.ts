import type { ExecutionObservation } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";

export interface ProviderObservationAdapter {
  readonly kind: RecoveryRecord["receipt"]["adapter"];
  observe(record: RecoveryRecord): Promise<ExecutionObservation>;
}

/**
 * Provider observation boundary for restart reconciliation. The concrete
 * callback is where a real Metricool/owned-node status lookup is attached;
 * this layer deliberately does not guess provider state.
 */
export class CredentialGatedProviderObservationAdapter implements ProviderObservationAdapter {
  constructor(
    public readonly kind: RecoveryRecord["receipt"]["adapter"],
    private readonly configured: boolean,
    private readonly observeConfigured: (record: RecoveryRecord) => Promise<ExecutionObservation>,
  ) {}

  async observe(record: RecoveryRecord): Promise<ExecutionObservation> {
    if (record.receipt.adapter !== this.kind) throw new Error("Observation adapter/provider mismatch");
    if (!this.configured) throw new Error(`${this.kind} provider observation credentials are not configured`);
    const observation = await this.observeConfigured(record);
    if (observation.idempotencyKey !== record.receipt.idempotencyKey) {
      throw new Error("Provider observation idempotency key mismatch");
    }
    if (observation.executionId !== record.receipt.executionId) {
      throw new Error("Provider observation execution identity mismatch");
    }
    return observation;
  }
}

export class ProviderObservationRegistry {
  private readonly adapters = new Map<RecoveryRecord["receipt"]["adapter"], ProviderObservationAdapter>();

  register(adapter: ProviderObservationAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  async observe(record: RecoveryRecord): Promise<ExecutionObservation> {
    const adapter = this.adapters.get(record.receipt.adapter);
    if (!adapter) throw new Error(`No provider observation adapter registered for ${record.receipt.adapter}`);
    return adapter.observe(record);
  }
}
