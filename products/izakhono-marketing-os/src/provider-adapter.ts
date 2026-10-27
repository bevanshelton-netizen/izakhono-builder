import { validateAdapterInstruction, type AdapterInstruction } from "./adapter-execution";
import type { ReplayInstruction } from "./execution-recovery";
import type { ExecutionAttemptResult } from "./execution-reliability";

export interface ProviderAdapter {
  readonly kind: AdapterInstruction["adapter"];
  execute(instruction: AdapterInstruction): ExecutionAttemptResult;
  executeReplay?(instruction: ReplayInstruction): ExecutionAttemptResult;
}

export class CredentialGatedProviderAdapter implements ProviderAdapter {
  constructor(
    public readonly kind: AdapterInstruction["adapter"],
    private readonly configured: boolean,
    private readonly executeConfigured: (instruction: AdapterInstruction) => ExecutionAttemptResult,
    private readonly executeConfiguredReplay?: (instruction: ReplayInstruction) => ExecutionAttemptResult,
  ) {}

  execute(instruction: AdapterInstruction): ExecutionAttemptResult {
    validateAdapterInstruction(instruction);
    if (instruction.adapter !== this.kind) throw new Error("Adapter/provider mismatch");
    if (!this.configured) throw new Error(`${this.kind} provider credentials are not configured`);
    return this.executeConfigured(instruction);
  }

  executeReplay(instruction: ReplayInstruction): ExecutionAttemptResult {
    if (instruction.adapter !== this.kind) throw new Error("Adapter/provider mismatch");
    if (!this.configured) throw new Error(`${this.kind} provider credentials are not configured`);
    if (!this.executeConfiguredReplay) throw new Error(`${this.kind} provider does not support replay execution`);
    return this.executeConfiguredReplay(instruction);
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

  executeReplay(instruction: ReplayInstruction): ExecutionAttemptResult {
    const adapter = this.adapters.get(instruction.adapter);
    if (!adapter) throw new Error(`No provider adapter registered for ${instruction.adapter}`);
    if (!adapter.executeReplay) throw new Error(`Provider ${instruction.adapter} does not support replay execution`);
    return adapter.executeReplay(instruction);
  }
}
