import { handleOneWorkflow } from './one-workflow-api';

const env = {};

const request = new Request('https://creator.test/api/one/workflow', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ instruction: 'Create an Amapiano music video with voiceover, visuals, TikTok cuts and a landing page.' }),
});

(async () => {
  const response = await handleOneWorkflow(request, env, '/api/one/workflow');
  if (response.status !== 200) throw new Error(`unexpected status: ${response.status}`);
  const payload = await response.json() as { status: string; plan: { schema: string; publicLive: false; artifacts: Array<{ kind: string }>; approvalGates: string[] }; nextRunnable: Array<{ kind: string }> };
  if (payload.status !== 'planned') throw new Error('workflow was not planned');
  if (payload.plan.schema !== 'izakhono.one/workflow-v1') throw new Error('wrong workflow schema');
  if (payload.plan.publicLive !== false) throw new Error('workflow must not claim public launch');
  for (const gate of ['creative', 'generation', 'master', 'distribution']) if (!payload.plan.approvalGates.includes(gate)) throw new Error(`missing gate: ${gate}`);
  for (const kind of ['brief', 'script', 'voice', 'music', 'image', 'video', 'code', 'caption', 'thumbnail', 'delivery-package']) if (!payload.plan.artifacts.some(a => a.kind === kind)) throw new Error(`missing artifact: ${kind}`);
  if (payload.nextRunnable.length !== 1 || payload.nextRunnable[0].kind !== 'brief') throw new Error('brief should be the first runnable artifact');
  console.log('IZAKHONO ONE workflow API: PASS');
})();
