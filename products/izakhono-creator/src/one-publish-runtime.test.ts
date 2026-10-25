import { configuredPublishChannels, publishApprovedDistribution, type PublishRuntimeEnv } from './one-publish-runtime';
import type { OneDistributionPackage } from './one-distribution';
import type { OneMasterPackage } from './one-master-assembly';
import type { OneWorkflowPlan } from './one-workflow';

const workflow = { workflowId: 'wf_test', schema: 'izakhono.one/workflow-v1', title: 'test', brief: { id: 'brief', instruction: 'test', channels: ['download', 'webhook'] }, stages: [], artifacts: [], approvalGates: ['creative', 'generation', 'master', 'distribution'], publicLive: false } as unknown as OneWorkflowPlan;
const master = { workflowId: 'wf_test', status: 'approved' } as unknown as OneMasterPackage;
const distribution = { schema: 'izakhono.one/distribution-v1', workflowId: 'wf_test', status: 'approved', channels: ['download', 'webhook'], masterStatus: 'approved', deliveryPackageCompleted: true, publicLive: false, publishAdapters: { download: 'not-configured', webhook: 'not-configured' }, approvalRequired: 'distribution' } as unknown as OneDistributionPackage;

const env: PublishRuntimeEnv = {};
if (JSON.stringify(configuredPublishChannels(env)) !== JSON.stringify(['download'])) throw new Error('download adapter should always be configured');
const blocked = await publishApprovedDistribution({ workflowId: 'wf_test', projectId: 'project', channel: 'download', distribution, master, workflow }, env);
if (blocked[0]?.status !== 'published') throw new Error('download adapter should publish the approved delivery package');
if (blocked[1]?.status !== 'blocked') throw new Error('webhook adapter must remain blocked until configured');
if (blocked.some(result => result.publicLive !== false)) throw new Error('publishing runtime must never claim publicLive');
console.log('IZAKHONO ONE publish runtime: PASS');
