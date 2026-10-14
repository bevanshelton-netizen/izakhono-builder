import type { ExecutionPlan, PromptRequest } from './contracts';

/**
 * Minimal deterministic planner for the one-minute path.
 * Model selection and specialist execution are injected at runtime.
 */
export function buildFastPathPlan(request: PromptRequest): ExecutionPlan {
  const prompt = request.prompt.trim();
  const lower = prompt.toLowerCase();

  const steps = [];

  if (/(research|find|compare|investigate|latest|look up)/.test(lower)) {
    steps.push({
      stepKey: 'research',
      workerType: 'research',
      dependsOn: [],
      timeoutMs: 12000,
      reversible: true,
      required: true,
    });
  }

  if (/(build|create|make|develop|code|website|app|platform)/.test(lower)) {
    steps.push({
      stepKey: 'build',
      workerType: 'code',
      dependsOn: [],
      timeoutMs: 30000,
      reversible: true,
      required: true,
    });
  }

  if (/(design|brand|logo|graphics|advert|poster|visual)/.test(lower)) {
    steps.push({
      stepKey: 'design',
      workerType: 'design',
      dependsOn: [],
      timeoutMs: 20000,
      reversible: true,
      required: false,
    });
  }

  if (/(write|copy|caption|email|proposal|advert)/.test(lower)) {
    steps.push({
      stepKey: 'content',
      workerType: 'content',
      dependsOn: [],
      timeoutMs: 10000,
      reversible: true,
      required: true,
    });
  }

  if (steps.length === 0) {
    steps.push({
      stepKey: 'direct',
      workerType: 'reasoning',
      dependsOn: [],
      timeoutMs: 15000,
      reversible: true,
      required: true,
    });
  }

  steps.push({
    stepKey: 'verify',
    workerType: 'verifier',
    dependsOn: steps.map((step) => step.stepKey),
    timeoutMs: 8000,
    reversible: true,
    required: true,
  });

  return {
    intent: prompt,
    engineKey: 'izakhono-ai-execution',
    steps,
    targetMs: request.latencyBudgetMs ?? 60000,
    verificationRequired: true,
  };
}
