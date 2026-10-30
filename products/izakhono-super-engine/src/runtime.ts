import type { AdapterKind, EngineModuleId } from './types';

export interface RuntimeAdapter {
  readonly kind: AdapterKind;
  readonly name: string;
  execute(module: EngineModuleId, operation: string): Promise<{ ok: boolean; module: EngineModuleId; operation: string }>;
}

/** Linux is the mandatory base runtime; adapters remain replaceable. */
export class LinuxRuntime {
  readonly kind = 'linux' as const;
  private readonly adapters = new Map<AdapterKind, RuntimeAdapter>();

  registerAdapter(adapter: RuntimeAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  hasAdapter(kind: AdapterKind): boolean {
    return this.adapters.has(kind);
  }

  async execute(module: EngineModuleId, operation: string, preferred: AdapterKind = 'native') {
    const adapter = this.adapters.get(preferred) ?? this.adapters.get('native');
    if (!adapter) throw new Error('No runtime adapter is registered');
    return adapter.execute(module, operation);
  }
}
