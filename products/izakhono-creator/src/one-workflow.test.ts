import { markArtifactCompleted, nextRunnableArtifacts, planOneWorkflow } from './one-workflow';

const plan = planOneWorkflow({
  id: 'test-brief',
  instruction: 'Create an Amapiano music video with voiceover, visuals and TikTok cuts, plus a companion landing page.',
  language: 'en',
  channels: ['youtube', 'tiktok'],
});

if (plan.schema !== 'izakhono.one/workflow-v1') throw new Error('invalid workflow schema');
if (plan.publicLive !== false) throw new Error('workflow must not be public by default');
for (const gate of ['creative', 'generation', 'master', 'distribution'] as const) {
  if (!plan.approvalGates.includes(gate)) throw new Error(`missing approval gate: ${gate}`);
}

const brief = plan.artifacts.find(a => a.kind === 'brief');
const script = plan.artifacts.find(a => a.kind === 'script');
const video = plan.artifacts.find(a => a.kind === 'video');
const code = plan.artifacts.find(a => a.kind === 'code');
if (!brief || !script || !video || !code) throw new Error('expected cross-domain artifacts were not planned');
if (!script.dependsOn.includes(brief.id)) throw new Error('script must depend on brief');
if (!video.dependsOn.includes(script.id)) throw new Error('video must depend on script');

const initialRunnable = nextRunnableArtifacts(plan, new Set());
if (!initialRunnable.some(a => a.id === brief.id)) throw new Error('brief should be runnable first');
if (initialRunnable.some(a => a.id === video.id)) throw new Error('video must wait for upstream assets');

const afterBrief = markArtifactCompleted(plan, brief.id, 'test-evidence');
const runnableAfterBrief = nextRunnableArtifacts(afterBrief, new Set([brief.id]));
if (!runnableAfterBrief.some(a => a.id === script.id)) throw new Error('script should run after brief');

console.log('IZAKHONO ONE workflow contract: PASS');
