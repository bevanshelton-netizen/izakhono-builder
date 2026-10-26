import { dbFetch } from './server-db';

export type ProviderContext = {
  workspaceId: string;
  campaignId?: string | null;
  payload?: Record<string, unknown>;
  jobId?: string;
  stepId?: string;
};

export type ProviderResult = {
  ok: boolean;
  provider: string;
  action: string;
  mode: 'prepared' | 'executed';
  message: string;
  data?: Record<string, unknown>;
};

export interface ProviderAdapter {
  provider: string;
  supports(action: string): boolean;
  execute(action: string, context: ProviderContext): Promise<ProviderResult>;
}

function executionKey(context: ProviderContext, action: string) {
  return `${context.workspaceId}:${context.jobId ?? 'manual'}:${context.stepId ?? action}`;
}

async function recordArtifact(context: ProviderContext, type: string, payload: Record<string, unknown>) {
  try {
    await dbFetch('business_engine_artifacts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        workspace_id: context.workspaceId,
        campaign_id: context.campaignId ?? null,
        job_id: context.jobId ?? null,
        step_id: context.stepId ?? null,
        artifact_type: type,
        idempotency_key: executionKey(context, type),
        payload,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

function businessManifest(context: ProviderContext) {
  const payload = context.payload ?? {};
  return {
    workspaceId: context.workspaceId,
    campaignId: context.campaignId ?? null,
    businessName: payload.businessName ?? payload.business_name ?? null,
    domain: payload.domain ?? null,
    industry: payload.industry ?? null,
    location: payload.location ?? null,
    generatedAt: new Date().toISOString(),
  };
}

const adapters: ProviderAdapter[] = [
  {
    provider: 'izakhono-provisioner',
    supports: (action) => action === 'prepare_business_presence',
    async execute(action, context) {
      const manifest = businessManifest(context);
      const persisted = await recordArtifact(context, 'business_presence_manifest', manifest);
      return {
        ok: true,
        provider: this.provider,
        action,
        mode: 'prepared',
        message: persisted
          ? 'Business-presence manifest generated and recorded; external domain/hosting execution remains provider-gated.'
          : 'Business-presence manifest generated; persistence will activate after the Business Engine schema is installed.',
        data: { ...manifest, persisted },
      };
    },
  },
  {
    provider: 'izakhono-growth',
    supports: (action) => ['prepare_seo', 'prepare_paid_campaign', 'prepare_social_campaign'].includes(action),
    async execute(action, context) {
      const manifest = {
        workspaceId: context.workspaceId,
        campaignId: context.campaignId ?? null,
        action,
        objective: context.payload?.objective ?? 'lead_generation',
        channels: context.payload?.channels ?? [],
        generatedAt: new Date().toISOString(),
      };
      const persisted = await recordArtifact(context, 'growth_execution_manifest', manifest);
      return {
        ok: true,
        provider: this.provider,
        action,
        mode: 'prepared',
        message: persisted
          ? 'Growth execution manifest generated and recorded; ad/social provider publishing remains credential-gated.'
          : 'Growth execution manifest generated; persistence will activate after the Business Engine schema is installed.',
        data: { ...manifest, persisted },
      };
    },
  },
  {
    provider: 'izakhono-crm',
    supports: (action) => action === 'activate_lead_capture',
    async execute(action, context) {
      const manifest = {
        workspaceId: context.workspaceId,
        captureChannels: ['website', 'whatsapp', 'form'],
        status: 'ready_for_activation',
        generatedAt: new Date().toISOString(),
      };
      const persisted = await recordArtifact(context, 'crm_activation_manifest', manifest);
      return {
        ok: true,
        provider: this.provider,
        action,
        mode: 'prepared',
        message: persisted
          ? 'Lead-capture activation manifest generated and recorded.'
          : 'Lead-capture activation manifest generated; persistence will activate after the Business Engine schema is installed.',
        data: { ...manifest, persisted },
      };
    },
  },
  {
    provider: 'izakhono-analytics',
    supports: (action) => action === 'activate_reporting',
    async execute(action, context) {
      const manifest = {
        workspaceId: context.workspaceId,
        metrics: ['leads', 'conversion_rate', 'campaign_spend', 'cost_per_lead', 'revenue'],
        status: 'ready_for_activation',
        generatedAt: new Date().toISOString(),
      };
      const persisted = await recordArtifact(context, 'analytics_activation_manifest', manifest);
      return {
        ok: true,
        provider: this.provider,
        action,
        mode: 'prepared',
        message: persisted
          ? 'Growth-reporting activation manifest generated and recorded.'
          : 'Growth-reporting activation manifest generated; persistence will activate after the Business Engine schema is installed.',
        data: { ...manifest, persisted },
      };
    },
  },
];

export function resolveProvider(provider: string, action: string) {
  return adapters.find((adapter) => adapter.provider === provider && adapter.supports(action)) ?? null;
}

export async function executeProvider(provider: string, action: string, context: ProviderContext) {
  const adapter = resolveProvider(provider, action);
  if (!adapter) throw new Error(`No provider adapter registered for ${provider}/${action}.`);
  return adapter.execute(action, context);
}
