import type { Goal, Memory, MemoryRecord, Policy, PlanStep, Tool } from './core.ts';

export class InMemoryExperienceStore implements Memory {
  private readonly records: MemoryRecord[] = [];

  async recall(pattern: string): Promise<MemoryRecord[]> {
    const needle = pattern.toLowerCase();
    return this.records.filter((record) => record.pattern.toLowerCase().includes(needle));
  }

  async remember(record: MemoryRecord): Promise<void> {
    this.records.push(structuredClone(record));
  }

  snapshot(): MemoryRecord[] {
    return structuredClone(this.records);
  }
}

export const defaultPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  maxAttempts: 2,
  allowTool: (_goal: Goal, _step: PlanStep, tool: Tool) => tool.risk !== 'critical',
  needsApproval: (goal: Goal, step: PlanStep) => Boolean(goal.approvalRequired || step.requiresApproval || goal.risk === 'high' || goal.risk === 'critical'),
  ...overrides,
});

export const evidenceTool = (name: string, summary: string, output: unknown = true): Tool => ({
  name,
  risk: 'low',
  async execute() {
    return {
      ok: true,
      output,
      evidence: [{ kind: 'runtime', summary, value: output, verifiedAt: new Date().toISOString() }],
    };
  },
});
