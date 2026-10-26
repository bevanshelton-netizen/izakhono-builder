export type ProviderContext = {
  workspaceId: string;
  campaignId?: string | null;
  payload?: Record<string, unknown>;
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

const adapters: ProviderAdapter[] = [
  {
    provider: 'izakhono-provisioner',
    supports: (action) => action === 'prepare_business_presence',
    async execute(action, context) {
      return { ok: true, provider: this.provider, action, mode: 'prepared', message: 'Business-presence provisioning contract prepared.', data: { workspaceId: context.workspaceId } };
    },
  },
  {
    provider: 'izakhono-growth',
    supports: (action) => ['prepare_seo', 'prepare_paid_campaign', 'prepare_social_campaign'].includes(action),
    async execute(action, context) {
      return { ok: true, provider: this.provider, action, mode: 'prepared', message: 'Growth execution contract prepared.', data: { workspaceId: context.workspaceId, campaignId: context.campaignId ?? null } };
    },
  },
  {
    provider: 'izakhono-crm',
    supports: (action) => action === 'activate_lead_capture',
    async execute(action, context) {
      return { ok: true, provider: this.provider, action, mode: 'prepared', message: 'Lead-capture activation contract prepared.', data: { workspaceId: context.workspaceId } };
    },
  },
  {
    provider: 'izakhono-analytics',
    supports: (action) => action === 'activate_reporting',
    async execute(action, context) {
      return { ok: true, provider: this.provider, action, mode: 'prepared', message: 'Growth-reporting contract prepared.', data: { workspaceId: context.workspaceId } };
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
