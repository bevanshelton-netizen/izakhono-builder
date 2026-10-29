import {
  CAPABILITIES,
  type Capability,
  type CapabilityEvidence,
  type ControlPlanePolicy,
  type JobState,
  type ProvisioningJob,
  type ProvisioningRequest,
  type ProviderRef,
} from './types';

export const DEFAULT_POLICY: ControlPlanePolicy = {
  infrastructureMode: 'owned-first-externally-reversible',
  requireEvidenceForLive: true,
  maxAttempts: 3,
  allowExternalFallback: true,
  autoRollbackOnVerificationFailure: true,
};

const OWNED_PROVIDER: Partial<Record<Capability, string>> = {
  IDENTITY: 'IZAKHONO-ID',
  DATABASE: 'IZAKHONO-DATA',
  STORAGE: 'IZAKHONO-STORAGE',
  API: 'IZAKHONO-CORE',
  SECURITY: 'FORTRESS',
  JOBS: 'IZAKHONO-TASKS',
  OBSERVABILITY: 'IZAKHONO-OBSERVE',
  DEPLOYMENT: 'IZAKHONO-PROVISIONER',
};

const FALLBACK_PROVIDER: Partial<Record<Capability, string>> = {
  DATABASE: 'SUPABASE',
  STORAGE: 'CLOUDFLARE-R2',
  API: 'VERCEL-FUNCTIONS',
  WEB: 'VERCEL',
  DOMAIN: 'CLOUDFLARE-DOMAINS',
  DNS: 'CLOUDFLARE-DNS',
  TLS: 'CLOUDFLARE-TLS',
  EMAIL: 'APPROVED-MAIL-PROVIDER',
  PAYMENTS: 'APPROVED-PAYMENT-PROVIDER',
  AI: 'APPROVED-AI-PROVIDER',
  ANALYTICS: 'VERCEL-ANALYTICS',
  OBSERVABILITY: 'VERCEL-OBSERVABILITY',
  BACKUP: 'APPROVED-BACKUP-PROVIDER',
  DEPLOYMENT: 'VERCEL',
};

export function planProviders(requested: readonly Capability[]): ProviderRef[] {
  const providers: ProviderRef[] = [];
  for (const capability of requested) {
    const owned = OWNED_PROVIDER[capability];
    if (owned) providers.push({ capability, provider: owned, priority: 1, mode: 'PRIMARY', reversible: true });
    const fallback = FALLBACK_PROVIDER[capability];
    if (fallback && fallback !== owned) {
      providers.push({ capability, provider: fallback, priority: 2, mode: 'FAILOVER', reversible: true });
    }
  }
  return providers;
}

function evidenceFor(requested: readonly Capability[]): CapabilityEvidence[] {
  return requested.map((capability) => ({ capability, state: 'PENDING' }));
}

export function createJob(request: ProvisioningRequest, now = new Date().toISOString()): ProvisioningJob {
  validateRequest(request);
  return {
    schemaVersion: '1.0',
    request: { ...request, requested: [...request.requested] },
    state: 'RECEIVED',
    providers: planProviders(request.requested),
    evidence: evidenceFor(request.requested),
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateRequest(request: ProvisioningRequest): void {
  if (!request || request.requestId.trim().length < 3) throw new Error('requestId is required');
  if (request.projectId.trim().length < 3) throw new Error('projectId is required');
  if (!request.name.trim()) throw new Error('name is required');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.slug)) throw new Error('slug must be lowercase kebab-case');
  if (!request.requested.length) throw new Error('at least one capability is required');
  if (new Set(request.requested).size !== request.requested.length) throw new Error('capabilities must be unique');
  for (const capability of request.requested) {
    if (!(CAPABILITIES as readonly string[]).includes(capability)) throw new Error(`unsupported capability: ${capability}`);
  }
}

export function begin(job: ProvisioningJob, now = new Date().toISOString()): ProvisioningJob {
  if (job.state !== 'RECEIVED' && job.state !== 'PLANNED' && job.state !== 'FAILED') {
    throw new Error(`cannot begin from ${job.state}`);
  }
  if (job.attempts >= DEFAULT_POLICY.maxAttempts) throw new Error('maximum provisioning attempts reached');
  return { ...job, state: 'PROVISIONING', attempts: job.attempts + 1, updatedAt: now };
}

export function markPlanned(job: ProvisioningJob, now = new Date().toISOString()): ProvisioningJob {
  if (job.state !== 'RECEIVED') throw new Error(`cannot plan from ${job.state}`);
  return { ...job, state: 'PLANNED', updatedAt: now };
}

export function recordEvidence(
  job: ProvisioningJob,
  capability: Capability,
  state: EvidenceState,
  reference: string,
  provider?: string,
  detail?: string,
  now = new Date().toISOString(),
): ProvisioningJob {
  if (job.state !== 'PROVISIONING' && job.state !== 'VERIFYING') throw new Error(`cannot record evidence from ${job.state}`);
  if (!job.request.requested.includes(capability)) throw new Error(`capability not requested: ${capability}`);
  const evidence = job.evidence.map((item) => item.capability === capability
    ? { ...item, state, reference, provider, detail, checkedAt: now }
    : item);
  return { ...job, evidence, state: evidence.some((e) => e.state === 'FAILED') ? 'FAILED' : 'VERIFYING', updatedAt: now };
}

export function evaluate(job: ProvisioningJob, now = new Date().toISOString()): ProvisioningJob {
  if (job.state !== 'VERIFYING') throw new Error(`cannot evaluate from ${job.state}`);
  const allPassed = job.evidence.length > 0 && job.evidence.every((e) => e.state === 'PASSED');
  const anyFailed = job.evidence.some((e) => e.state === 'FAILED');
  if (allPassed) return { ...job, state: 'LIVE', updatedAt: now };
  if (anyFailed) return { ...job, state: DEFAULT_POLICY.autoRollbackOnVerificationFailure ? 'ROLLED_BACK' : 'FAILED', updatedAt: now };
  return job;
}

export function fail(job: ProvisioningJob, reason: string, now = new Date().toISOString()): ProvisioningJob {
  return {
    ...job,
    state: 'FAILED',
    updatedAt: now,
    evidence: job.evidence.map((e) => e.state === 'PENDING' ? { ...e, detail: reason, checkedAt: now } : e),
  };
}

export function degrade(job: ProvisioningJob, reason: string, now = new Date().toISOString()): ProvisioningJob {
  return {
    ...job,
    state: 'DEGRADED',
    updatedAt: now,
    evidence: job.evidence.map((e) => e.state === 'PASSED' ? { ...e, detail: e.detail || reason } : e),
  };
}

export function verifyLive(job: ProvisioningJob): boolean {
  return job.state === 'LIVE' && job.evidence.length > 0 && job.evidence.every((e) => e.state === 'PASSED');
}

export function nextProvider(job: ProvisioningJob, capability: Capability): ProviderRef | undefined {
  const candidates = job.providers
    .filter((provider) => provider.capability === capability)
    .sort((a, b) => a.priority - b.priority);
  const current = job.evidence.find((e) => e.capability === capability)?.provider;
  return candidates.find((provider) => provider.provider !== current);
}

export function transition(job: ProvisioningJob, desired: JobState): ProvisioningJob {
  const allowed: Record<JobState, JobState[]> = {
    RECEIVED: ['PLANNED', 'FAILED'],
    PLANNED: ['PROVISIONING', 'FAILED'],
    PROVISIONING: ['VERIFYING', 'DEGRADED', 'FAILED'],
    VERIFYING: ['LIVE', 'ROLLED_BACK', 'FAILED'],
    LIVE: ['DEGRADED', 'ROLLED_BACK'],
    DEGRADED: ['PROVISIONING', 'ROLLED_BACK', 'FAILED', 'LIVE'],
    BLOCKED: ['PLANNED', 'FAILED'],
    FAILED: ['PLANNED', 'ROLLED_BACK'],
    ROLLED_BACK: ['PLANNED', 'PROVISIONING'],
  };
  if (!allowed[job.state].includes(desired)) throw new Error(`invalid transition ${job.state} -> ${desired}`);
  return { ...job, state: desired, updatedAt: new Date().toISOString() };
}
