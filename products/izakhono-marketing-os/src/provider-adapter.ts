import { validateAdapterInstruction, type AdapterInstruction } from "./adapter-execution";
import type { ExecutionAttemptResult } from "./execution-reliability";

export interface ProviderAdapter {
  readonly kind: AdapterInstruction["adapter"];
  execute(instruction: AdapterInstruction): ExecutionAttemptResult;
}

export class CredentialGatedProviderAdapter implements ProviderAdapter {
  constructor(
    public readonly kind: AdapterInstruction["adapter"],
    private readonly configured: boolean,
    private readonly executeConfigured: (instruction: AdapterInstruction) => ExecutionAttemptResult,
  ) {}

  execute(instruction: AdapterInstruction): ExecutionAttemptResult {
    validateAdapterInstruction(instruction);
    if (instruction.adapter !== this.kind) throw new Error("Adapter/provider mismatch");
    if (!this.configured) throw new Error(`${this.kind} provider credentials are not configured`);
    return this.executeConfigured(instruction);
  }
}

export class ProviderAdapterRegistry {
  private readonly adapters = new Map<AdapterInstruction["adapter"], ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  execute(instruction: AdapterInstruction): ExecutionAttemptResult {
    validateAdapterInstruction(instruction);
    const adapter = this.adapters.get(instruction.adapter);
    if (!adapter) throw new Error(`No provider adapter registered for ${instruction.adapter}`);
    return adapter.execute(instruction);
  }
}
