export * from './core.ts';
export * from './planner.ts';
export * from './harness.ts';
export * from './runtime.ts';

import { AgentHarness } from './harness.ts';
import type { Goal, Tool } from './core.ts';
import { planGoal } from './planner.ts';
import { defaultPolicy, InMemoryExperienceStore, evidenceTool } from './runtime.ts';

export function createDefaultAgent(tools: Tool[] = []) {
  const memory = new InMemoryExperienceStore();
  const harness = new AgentHarness(defaultPolicy(), memory, {
    approve: async () => false,
  });

  for (const tool of [
    evidenceTool('state.inspect', 'Current state inspected'),
    evidenceTool('workspace.prepare', 'Workspace preparation completed'),
    evidenceTool('quality.validate', 'Deterministic validation passed'),
    evidenceTool('quality.verify', 'Outcome verification passed'),
    evidenceTool('approval.owner', 'Owner approval gate evaluated'),
    ...tools,
  ]) harness.register(tool);

  return {
    memory,
    harness,
    plan: (goal: Goal) => planGoal(goal),
  };
}
