import type { Goal, Plan, PlanStep } from './core.ts';

const step = (id: string, action: string, tool: string, input: Record<string, unknown> = {}, requiresApproval = false): PlanStep => ({
  id,
  action,
  tool,
  input,
  requiresApproval,
  requiresEvidence: true,
  status: 'pending',
  attempts: 0,
});

/**
 * Deterministic baseline planner. Higher-level AI planners may enrich a plan,
 * but the resulting plan must still satisfy this typed contract before execution.
 */
export function planGoal(goal: Goal): Plan {
  const steps: PlanStep[] = [
    step('inspect', 'Inspect the current project and known state', 'state.inspect'),
    step('prepare', 'Prepare the smallest safe change required by the objective', 'workspace.prepare'),
    step('validate', 'Run deterministic validation before any external release', 'quality.validate'),
    step('verify', 'Verify the requested outcome using explicit evidence', 'quality.verify'),
  ];

  if (goal.risk === 'high' || goal.risk === 'critical' || goal.approvalRequired) {
    steps.splice(3, 0, step('approval', 'Obtain explicit owner approval before consequential execution', 'approval.owner', {}, true));
  }

  return {
    id: `plan-${goal.id}-v1`,
    goalId: goal.id,
    version: 1,
    steps,
  };
}
