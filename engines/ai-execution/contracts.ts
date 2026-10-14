export type JobStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'awaiting_approval';

export type StepStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PromptRequest {
  prompt: string;
  sessionId?: string;
  priority?: number;
  latencyBudgetMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionStep {
  stepKey: string;
  workerType: string;
  dependsOn: string[];
  timeoutMs: number;
  reversible: boolean;
  required: boolean;
}

export interface ExecutionPlan {
  intent: string;
  engineKey: string;
  steps: ExecutionStep[];
  targetMs: number;
  verificationRequired: boolean;
}

export interface ExecutionResult {
  jobId: string;
  status: JobStatus;
  result?: unknown;
  verification?: {
    passed: boolean;
    checks: string[];
    evidence: Record<string, unknown>;
  };
  latencyMs: number;
}

export interface ModelRoute {
  taskClass: string;
  preferredProvider?: string;
  preferredModel?: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  maxLatencyMs: number;
}
