export const CAPABILITIES = [
  'IDENTITY',
  'DATABASE',
  'STORAGE',
  'API',
  'WEB',
  'DOMAIN',
  'DNS',
  'TLS',
  'EMAIL',
  'PAYMENTS',
  'AI',
  'ANALYTICS',
  'SECURITY',
  'OBSERVABILITY',
  'JOBS',
  'BACKUP',
  'DEPLOYMENT',
] as const;

export type Capability = typeof CAPABILITIES[number];
export type JobState =
  | 'RECEIVED'
  | 'PLANNED'
  | 'PROVISIONING'
  | 'VERIFYING'
  | 'LIVE'
  | 'DEGRADED'
  | 'BLOCKED'
  | 'FAILED'
  | 'ROLLED_BACK';

export type EvidenceState = 'PENDING' | 'PASSED' | 'FAILED';

export interface ProviderRef {
  capability: Capability;
  provider: string;
  priority: number;
  mode: 'PRIMARY' | 'FAILOVER';
  reversible: boolean;
}

export interface ProvisioningRequest {
  requestId: string;
  projectId: string;
  name: string;
  slug: string;
  requested: Capability[];
  metadata?: Record<string, string>;
}

export interface CapabilityEvidence {
  capability: Capability;
  state: EvidenceState;
  provider?: string;
  reference?: string;
  checkedAt?: string;
  detail?: string;
}

export interface ProvisioningJob {
  schemaVersion: '1.0';
  request: ProvisioningRequest;
  state: JobState;
  providers: ProviderRef[];
  evidence: CapabilityEvidence[];
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface ControlPlanePolicy {
  infrastructureMode: 'owned-first-externally-reversible';
  requireEvidenceForLive: true;
  maxAttempts: number;
  allowExternalFallback: boolean;
  autoRollbackOnVerificationFailure: boolean;
}
