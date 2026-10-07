import type { ComputeRequest, ComputeProvider, ComputerSession } from './computer';

export interface ComputeAdapter {
  readonly provider: ComputeProvider;
  canAllocate(request: ComputeRequest): Promise<boolean>;
  allocate(request: ComputeRequest): Promise<ComputerSession>;
  suspend(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<ComputerSession>;
  release(sessionId: string): Promise<void>;
}

export interface StorageAdapter {
  put(workspaceId: string, path: string, data: Uint8Array): Promise<void>;
  get(workspaceId: string, path: string): Promise<Uint8Array | null>;
  delete(workspaceId: string, path: string): Promise<void>;
  list(workspaceId: string, prefix?: string): Promise<string[]>;
}
