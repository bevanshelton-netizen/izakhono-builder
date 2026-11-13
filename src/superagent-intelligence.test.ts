import assert from 'node:assert/strict';
import { planGoal, planGoalWithIntelligence, type SuperAgentGoal } from './superagent';
import type { ModelEndpoint } from './intelligence';

const goal: SuperAgentGoal = {
  id: 'goal-20',
  objective: 'Build a secure internal procurement workflow.',
  autonomy: 'owner',
  context: { requestPublicRelease: true },
};
const endpoint: ModelEndpoint = {
  id: 'local-planner',
  provider: 'ollama',
  protocol: 'ollama-chat',
  model: 'qwen2.5-coder:3b',
  baseUrl: 'http://127.0.0.1:11434',
  trust: 'local',
  capabilities: ['reasoning'],
  contextWindow: 8192,
  enabled: true,
  healthy: true,
};

async function main() {
  const baseline = planGoal(goal);
  const refined = await planGoalWithIntelligence(goal, {
    endpoints: [endpoint],
    policy: { allowedTrust: ['local'], requiredCapabilities: [], preferLocal: true },
    registry: { list: async () => [endpoint], getSecret: async () => undefined },
  });
  // Malformed model output must leave the deterministic plan and release gate intact.
  assert.deepEqual(refined.tasks.map(t => ({ id: t.id, deps: t.dependsOn, gate: t.gate, tool: t.tool })),
    baseline.tasks.map(t => ({ id: t.id, deps: t.dependsOn, gate: t.gate, tool: t.tool })));
  assert.equal(refined.tasks.find(t => t.id.endsWith(':release'))?.gate, 'public_release');
  assert.ok(refined.events.some(e => e.type === 'recovery'));

  const successful = await planGoalWithIntelligence(goal, {
    endpoints: [endpoint],
    policy: { allowedTrust: ['local'], requiredCapabilities: [], preferLocal: true },
    registry: { list: async () => [endpoint], getSecret: async () => undefined },
  });
  assert.equal(successful.tasks[0].title, 'Clarify procurement outcome');
  assert.deepEqual(successful.tasks.map(t => t.id), baseline.tasks.map(t => t.id));
  assert.deepEqual(successful.tasks.map(t => t.gate), baseline.tasks.map(t => t.gate));
  console.log('[PASS] SUPERAGENT constrained Intelligence planning and deterministic fallback.');
}

let call = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  call += 1;
  const content = call === 1
    ? '{not-json'
    : JSON.stringify({ tasks: [{ taskId: 'goal-20:intake', title: 'Clarify procurement outcome', purpose: 'Confirm the approved workflow outcome and acceptance criteria.' }] });
  return new Response(JSON.stringify({ message: { content } }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  globalThis.fetch = originalFetch;
});
