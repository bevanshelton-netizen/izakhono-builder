import type { AdapterInstruction } from "./adapter-execution";
import type { ReplayInstruction } from "./execution-recovery";
import type { AdapterExecutor } from "./execution-runtime";
import type { ExecutionAttemptResult } from "./execution-reliability";
import { ProviderAdapterRegistry } from "./provider-adapter";

export class ProviderBackedExecutionExecutor implements AdapterExecutor {
  constructor(private readonly registry: ProviderAdapterRegistry) {}

  execute(instruction: AdapterInstruction | ReplayInstruction): ExecutionAttemptResult {
    if ("schema" in instruction) return this.registry.execute(instruction);
    return this.registry.executeReplay(instruction);
  }
}
