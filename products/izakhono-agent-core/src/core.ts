export type AgentState =
  | 'planned'
  | 'authorized'
  | 'executing'
  | 'verifying'
  | 'recovering'
  | 'completed'
  | 'blocked'
  | 'failed';

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'blocked';

export interface Goal {
  id: string;
  title: string;
  objective: string;
  owner: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  approvalRequired?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PlanStep {
  id: string;
  action: string;
  tool: string;
  input: Record<string, unknown>;
  requiresApproval?: boolean;
  requiresEvidence?: boolean;
  status: StepStatus;
  attempts: number;
}

export interface Plan {
  id: string;
  goalId: string;
  version: 1;
  steps: PlanStep[];
}

export interface Evidence {
  kind: string;
  summary: string;
  value?: unknown;
  verifiedAt: string;
}

export interface ToolContext {
  goal: Goal;
  step: PlanStep;
  emit: (event: AuditEvent) => void;
}

export interface ToolResult {
  ok: boolean;
  output?: unknown;
  evidence?: Evidence[];
  retryable?: boolean;
  reason?: string;
}

export interface Tool {
  name: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  execute: (input: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface AuditEvent {
  at: string;
  type: string;
  goalId: string;
  stepId?: string;
  state?: AgentState;
  data?: Record<string, unknown>;
}

export interface MemoryRecord {
  key: string;
  pattern: string;
  outcome: 'success' | 'failure';
  evidence?: Evidence[];
  createdAt: string;
}

export interface Memory {
  recall: (pattern: string) => Promise<MemoryRecord[]>;
  remember: (record: MemoryRecord) => Promise<void>;
}

export interface Policy {
  allowTool: (goal: Goal, step: PlanStep, tool: Tool) => boolean;
  needsApproval: (goal: Goal, step: PlanStep) => boolean;
  maxAttempts: number;
}

export interface ExecutionResult {
  goalId: string;
  state: AgentState;
  plan: Plan;
  evidence: Evidence[];
  audit: AuditEvent[];
  reason?: string;
}

export const now = () => new Date().toISOString();

const transitions: Record<AgentState, AgentState[]> = {
  planned: ['authorized', 'blocked'],
  authorized: ['executing', 'blocked'],
  executing: ['verifying', 'recovering', 'blocked', 'failed'],
  verifying: ['completed', 'recovering', 'blocked', 'failed'],
  recovering: ['executing', 'blocked', 'failed'],
  completed: [],
  blocked: [],
  failed: [],
};

export function canTransition(from: AgentState, to: AgentState): boolean {
  return transitions[from].includes(to);
}

export function transition(from: AgentState, to: AgentState): AgentState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal agent state transition: ${from} -> ${to}`);
  }
  return to;
}

export function audit(event: Omit<AuditEvent, 'at'>): AuditEvent {
  return { ...event, at: now() };
}
