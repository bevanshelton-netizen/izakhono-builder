export type ComputeProvider = 'local' | 'docker' | 'vm' | 'vps' | 'cloud';

export type Capability =
  | 'workspace.read'
  | 'workspace.write'
  | 'files.read'
  | 'files.write'
  | 'app.launch'
  | 'job.submit'
  | 'job.read'
  | 'compute.allocate'
  | 'snapshot.create'
  | 'snapshot.restore';

export interface ComputerSession {
  id: string;
  userId: string;
  workspaceId: string;
  deviceId?: string;
  provider: ComputeProvider;
  status: 'starting' | 'ready' | 'suspended' | 'closed';
  createdAt: string;
  lastSeenAt: string;
}

export interface ApplicationManifest {
  id: string;
  name: string;
  version: string;
  capabilities: Capability[];
  entrypoint: string;
  portable: boolean;
}

export interface ComputeRequest {
  sessionId: string;
  cpu?: number;
  memoryMb?: number;
  gpu?: boolean;
  provider?: ComputeProvider;
}

export interface Snapshot {
  id: string;
  workspaceId: string;
  createdAt: string;
  provider: ComputeProvider;
  state: 'creating' | 'ready' | 'failed';
}
