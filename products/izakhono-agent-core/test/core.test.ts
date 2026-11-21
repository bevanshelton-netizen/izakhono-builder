import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, transition } from '../src/core.ts';
import { AgentHarness } from '../src/harness.ts';
import { planGoal } from '../src/planner.ts';
import { defaultPolicy, InMemoryExperienceStore, evidenceTool } from '../src/runtime.ts';

test('state machine rejects illegal transitions', () => {
  assert.equal(canTransition('planned', 'authorized'), true);
  assert.equal(canTransition('planned', 'completed'), false);
  assert.throws(() => transition('planned', 'completed'), /Illegal agent state transition/);
});

test('low-risk goal completes only with evidence', async () => {
  const memory = new InMemoryExperienceStore();
  const harness = new AgentHarness(defaultPolicy(), memory, { approve: async () => false });
  for (const name of ['state.inspect', 'workspace.prepare', 'quality.validate', 'quality.verify']) {
    harness.register(evidenceTool(name, `${name} passed`));
  }
  const goal = { id: 'g-001', title: 'Test', objective: 'build a safe internal change', owner: 'owner', risk: 'low' as const };
  const result = await harness.execute(goal, planGoal(goal));
  assert.equal(result.state, 'completed');
  assert.ok(result.evidence.length >= 4);
  assert.equal(memory.snapshot()[0]?.outcome, 'success');
});

test('high-risk goal stops at approval gate', async () => {
  const memory = new InMemoryExperienceStore();
  const harness = new AgentHarness(defaultPolicy(), memory, { approve: async () => false });
  for (const name of ['state.inspect', 'workspace.prepare', 'quality.validate', 'approval.owner', 'quality.verify']) {
    harness.register(evidenceTool(name, `${name} passed`));
  }
  const goal = { id: 'g-002', title: 'Sensitive', objective: 'perform a consequential action', owner: 'owner', risk: 'high' as const };
  const result = await harness.execute(goal, planGoal(goal));
  assert.equal(result.state, 'blocked');
  assert.match(result.reason ?? '', /Approval denied/);
});
