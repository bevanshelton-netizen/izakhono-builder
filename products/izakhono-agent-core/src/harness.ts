import { audit, now, transition, type AgentState, type AuditEvent, type ExecutionResult, type Goal, type Memory, type Plan, type Policy, type Tool } from './core.ts';

export interface ApprovalGate {
  approve: (goal: Goal, stepId: string) => Promise<boolean>;
}

export class AgentHarness {
  private readonly tools = new Map<string, Tool>();
  private readonly auditLog: AuditEvent[] = [];

  constructor(
    private readonly policy: Policy,
    private readonly memory: Memory,
    private readonly approval: ApprovalGate,
  ) {}

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  async execute(goal: Goal, plan: Plan): Promise<ExecutionResult> {
    let state: AgentState = 'planned';
    const evidence = [] as NonNullable<ExecutionResult['evidence']>;
    const emit = (event: AuditEvent) => this.auditLog.push(event);
    emit(audit({ type: 'goal.accepted', goalId: goal.id, state }));

    try {
      state = transition(state, 'authorized');
      emit(audit({ type: 'plan.authorized', goalId: goal.id, state, data: { planId: plan.id } }));

      state = transition(state, 'executing');
      emit(audit({ type: 'execution.started', goalId: goal.id, state }));

      for (const step of plan.steps) {
        const tool = this.tools.get(step.tool);
        if (!tool) return this.block(plan, goal, state, `Unregistered tool: ${step.tool}`);
        if (!this.policy.allowTool(goal, step, tool)) {
          return this.block(plan, goal, state, `Policy denied tool: ${step.tool}`);
        }
        if (this.policy.needsApproval(goal, step)) {
          const approved = await this.approval.approve(goal, step.id);
          emit(audit({ type: 'approval.checked', goalId: goal.id, stepId: step.id, state, data: { approved } }));
          if (!approved) return this.block(plan, goal, state, `Approval denied: ${step.id}`);
        }

        step.status = 'running';
        let result = null as Awaited<ReturnType<Tool['execute']>> | null;
        for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt++) {
          step.attempts = attempt;
          emit(audit({ type: 'step.started', goalId: goal.id, stepId: step.id, state, data: { attempt } }));
          result = await tool.execute(step.input, { goal, step, emit });
          if (result.ok) break;
          emit(audit({ type: 'step.failed', goalId: goal.id, stepId: step.id, state, data: { attempt, reason: result.reason } }));
          if (!result.retryable || attempt === this.policy.maxAttempts) break;
          state = transition(state, 'recovering');
          emit(audit({ type: 'recovery.requested', goalId: goal.id, stepId: step.id, state }));
          state = transition(state, 'executing');
        }

        if (!result?.ok) {
          step.status = 'failed';
          state = transition(state, 'failed');
          await this.memory.remember({ key: `${goal.id}:${step.id}`, pattern: goal.objective, outcome: 'failure', createdAt: now() });
          emit(audit({ type: 'execution.failed', goalId: goal.id, stepId: step.id, state, data: { reason: result?.reason } }));
          return { goalId: goal.id, state, plan, evidence, audit: [...this.auditLog], reason: result?.reason };
        }

        step.status = 'passed';
        if (result.evidence) evidence.push(...result.evidence);
        emit(audit({ type: 'step.passed', goalId: goal.id, stepId: step.id, state, data: { evidenceCount: result.evidence?.length ?? 0 } }));
      }

      state = transition(state, 'verifying');
      emit(audit({ type: 'verification.started', goalId: goal.id, state }));
      const verified = evidence.length > 0;
      if (!verified) return this.block(plan, goal, state, 'No verification evidence was produced');

      state = transition(state, 'completed');
      emit(audit({ type: 'execution.completed', goalId: goal.id, state, data: { evidenceCount: evidence.length } }));
      await this.memory.remember({ key: goal.id, pattern: goal.objective, outcome: 'success', evidence, createdAt: now() });
      return { goalId: goal.id, state, plan, evidence, audit: [...this.auditLog] };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { goalId: goal.id, state: 'failed', plan, evidence, audit: [...this.auditLog], reason };
    }
  }

  private block(plan: Plan, goal: Goal, state: AgentState, reason: string): ExecutionResult {
    if (state !== 'blocked' && state !== 'failed') state = transition(state, 'blocked');
    this.auditLog.push(audit({ type: 'execution.blocked', goalId: goal.id, state, data: { reason } }));
    return { goalId: goal.id, state, plan, evidence: [], audit: [...this.auditLog], reason };
  }
}
