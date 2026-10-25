import type { OneDistributionPackage } from './one-distribution';
import type { OneMasterPackage } from './one-master-assembly';
import type { OneWorkflowPlan } from './one-workflow';

export type PublishChannel = 'webhook' | 'download';
export type PublishAdapterStatus = 'configured' | 'not-configured';
export type PublishRuntimeEnv = { ONE_PUBLISH_WEBHOOK_URL?: string; ONE_PUBLISH_SECRET?: string };
export type PublishRequest = { workflowId: string; projectId: string; channel: PublishChannel; distribution: OneDistributionPackage; master: OneMasterPackage; workflow: OneWorkflowPlan };
export type PublishResult = { channel: PublishChannel; status: 'published' | 'blocked' | 'failed'; publicLive: false; evidence?: string; error?: string };
export type PublishAdapter = { channel: PublishChannel; status(env: PublishRuntimeEnv): PublishAdapterStatus; publish(input: PublishRequest, env: PublishRuntimeEnv): Promise<PublishResult> };

const webhook: PublishAdapter = {
  channel: 'webhook',
  status: env => env.ONE_PUBLISH_WEBHOOK_URL ? 'configured' : 'not-configured',
  async publish(input, env) {
    if (!env.ONE_PUBLISH_WEBHOOK_URL) return { channel: 'webhook', status: 'blocked', publicLive: false, error: 'Webhook publishing is not configured.' };
    const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
    if (env.ONE_PUBLISH_SECRET) headers.authorization = `Bearer ${env.ONE_PUBLISH_SECRET}`;
    const response = await fetch(env.ONE_PUBLISH_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify({ schema: 'izakhono.one/publish-v1', workflowId: input.workflowId, projectId: input.projectId, master: input.master, workflow: input.workflow }) });
    if (!response.ok) return { channel: 'webhook', status: 'failed', publicLive: false, error: `Webhook returned HTTP ${response.status}.` };
    return { channel: 'webhook', status: 'published', publicLive: false, evidence: `webhook:${response.status}` };
  },
};

const download: PublishAdapter = {
  channel: 'download',
  status: () => 'configured',
  async publish(input) { return { channel: 'download', status: 'published', publicLive: false, evidence: `delivery-package:${input.workflowId}` }; },
};

export function createPublishAdapters(): Record<PublishChannel, PublishAdapter> { return { webhook, download }; }

export function configuredPublishChannels(env: PublishRuntimeEnv): PublishChannel[] {
  return (Object.values(createPublishAdapters()) as PublishAdapter[]).filter(adapter => adapter.status(env) === 'configured').map(adapter => adapter.channel);
}

export async function publishApprovedDistribution(input: PublishRequest, env: PublishRuntimeEnv): Promise<PublishResult[]> {
  if (input.distribution.status !== 'approved') return input.distribution.channels.map(channel => ({ channel: channel as PublishChannel, status: 'blocked', publicLive: false, error: 'Distribution approval is required.' }));
  if (input.master.status !== 'approved') return input.distribution.channels.map(channel => ({ channel: channel as PublishChannel, status: 'blocked', publicLive: false, error: 'Master approval is required.' }));
  const adapters = createPublishAdapters();
  const results: PublishResult[] = [];
  for (const channel of input.distribution.channels) {
    const adapter = adapters[channel as PublishChannel];
    if (!adapter) { results.push({ channel: channel as PublishChannel, status: 'blocked', publicLive: false, error: `No publish adapter exists for channel '${channel}'.` }); continue; }
    results.push(await adapter.publish(input, env));
  }
  return results;
}
