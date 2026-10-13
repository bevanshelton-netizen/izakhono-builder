/**
 * IZAKHONO SUPERAGENT v1
 *
 * DeerFlow-class orchestration primitives for IZAKHONO: goal -> plan -> tools
 * -> artifacts -> verification -> recovery -> release gate.
 *
 * This module is intentionally provider-neutral. A runtime supplies the actual
 * tool implementations (web research, files, code/build, repositories, etc.).
 * It never grants arbitrary shell execution or bypasses authorization gates.
 */

export type AgentStage =
  | 'intake' | 'plan' | 'research' | 'execute' | 'verify' | 'recover'
  | 'artifact' | 'release_gate' | 'complete' | 'blocked';
export type Gate = 'none' | 'payment' | 'legal' | 'account_permission' | 'irreversible_external_action' | 'public_release';
export type ToolKind = 'web_research' | 'file_search' | 'file_read' | 'code' | 'build' | 'repository' | 'deployment' | 'database' | 'messaging' | 'artifact';

export interface SuperAgentGoal {
  id: string;
  objective: string;
  context?: Record<string, unknown>;
  requestedArtifacts?: string[];
  maxSteps?: number;
  autonomy: 'owner' | 'supervised';
}
export interface AgentTask {
  id: string; title: string; purpose: string; stage: AgentStage; tool?: ToolKind;
  dependsOn: string[]; gate: Gate;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'blocked'; attempts: number; maxAttempts: number;
}
export interface AgentArtifact { id: string; name: string; kind: string; status: 'draft' | 'validated' | 'released'; sourceTask: string; evidence: string[]; }
export interface AgentRun { goal: SuperAgentGoal; stage: AgentStage; tasks: AgentTask[]; artifacts: AgentArtifact[]; events: AgentEvent[]; blockedReason?: string; }
export interface AgentEvent { at: string; type: 'plan' | 'tool' | 'task' | 'verification' | 'recovery' | 'gate' | 'artifact'; message: string; taskId?: string; }
export interface ToolRequest { kind: ToolKind; action: string; input: Record<string, unknown>; requiresGate?: Gate; }
export interface ToolResult { ok: boolean; output?: Record<string, unknown>; evidence?: string[]; retryable?: boolean; error?: string; }
export interface SuperAgentToolExecutor { execute(request: ToolRequest): Promise<ToolResult>; }

const now = () => new Date().toISOString();
function event(run: AgentRun, type: AgentEvent['type'], message: string, taskId?: string) { run.events.push({ at: now(), type, message, taskId }); }

/** Convert one owner objective into an executable graph. Safety gates remain stable even when an AI planner enriches the graph. */
export function planGoal(goal: SuperAgentGoal): AgentRun {
  const id = (suffix: string) => `${goal.id}:${suffix}`;
  const publicRelease = goal.context?.requestPublicRelease === true;
  const tasks: AgentTask[] = [
    { id: id('intake'), title: 'Understand objective', purpose: 'Normalize the owner goal and success criteria.', stage: 'intake', dependsOn: [], gate: 'none', status: 'queued', attempts: 0, maxAttempts: 1 },
    { id: id('research'), title: 'Research', purpose: 'Collect relevant public or owner-authorized evidence.', stage: 'research', tool: 'web_research', dependsOn: [id('intake')], gate: 'none', status: 'queued', attempts: 0, maxAttempts: 3 },
    { id: id('execute'), title: 'Execute', purpose: 'Perform the required build, analysis, coding or operational work.', stage: 'execute', tool: 'code', dependsOn: [id('research')], gate: 'none', status: 'queued', attempts: 0, maxAttempts: 3 },
    { id: id('verify'), title: 'Verify', purpose: 'Test outputs against acceptance criteria and evidence requirements.', stage: 'verify', tool: 'build', dependsOn: [id('execute')], gate: 'none', status: 'queued', attempts: 0, maxAttempts: 3 },
    { id: id('artifact'), title: 'Package deliverables', purpose: 'Create and validate requested documents, code, reports or release receipts.', stage: 'artifact', tool: 'artifact', dependsOn: [id('verify')], gate: 'none', status: 'queued', attempts: 0, maxAttempts: 2 },
    { id: id('release'), title: 'Release gate', purpose: 'Determine whether the result can be published or must remain internal.', stage: 'release_gate', tool: 'deployment', dependsOn: [id('artifact')], gate: publicRelease ? 'public_release' : 'none', status: 'queued', attempts: 0, maxAttempts: 1 },
  ];
  const run: AgentRun = { goal, stage: 'plan', tasks, artifacts: [], events: [] };
  event(run, 'plan', `Planned ${tasks.length} tasks for owner objective ${goal.id}.`);
  return run;
}

function nextRunnable(run: AgentRun): AgentTask | undefined {
  return run.tasks.find((task) => task.status === 'queued' && task.dependsOn.every((dep) => run.tasks.find((t) => t.id === dep)?.status === 'passed'));
}
function isExternalGate(gate: Gate): boolean { return gate !== 'none'; }

/** Advance one task while enforcing lifecycle, retries and authorization boundaries. */
export async function advance(run: AgentRun, executor: SuperAgentToolExecutor): Promise<AgentRun> {
  const maxSteps = run.goal.maxSteps ?? 50;
  if (run.events.length >= maxSteps) {
    run.stage = 'blocked'; run.blockedReason = 'Maximum autonomous step budget reached.'; event(run, 'gate', run.blockedReason); return run;
  }
  const task = nextRunnable(run);
  if (!task) {
    const failed = run.tasks.find((t) => t.status === 'failed');
    const blocked = run.tasks.find((t) => t.status === 'blocked');
    if (failed || blocked) { run.stage = 'blocked'; run.blockedReason = 'A prerequisite task failed or is blocked.'; return run; }
    if (run.tasks.every((t) => t.status === 'passed')) run.stage = 'complete';
    return run;
  }
  if (isExternalGate(task.gate)) {
    task.status = 'blocked'; run.stage = 'blocked'; run.blockedReason = `Authorization required: ${task.gate}`; event(run, 'gate', run.blockedReason, task.id); return run;
  }
  task.status = 'running'; task.attempts += 1; run.stage = task.stage; event(run, 'task', `Starting ${task.title}.`, task.id);
  const result = await executor.execute({ kind: task.tool ?? 'artifact', action: task.stage, input: { goal: run.goal.objective, task: task.purpose, taskId: task.id } });
  if (result.ok) {
    task.status = 'passed'; event(run, 'verification', `${task.title} passed.`, task.id);
    if (result.evidence?.length) event(run, 'tool', `Evidence: ${result.evidence.join('; ')}`, task.id);
    if (task.stage === 'artifact') {
      run.artifacts.push({ id: `artifact:${task.id}`, name: 'IZAKHONO deliverable package', kind: 'agent-output', status: 'validated', sourceTask: task.id, evidence: result.evidence ?? [] });
      event(run, 'artifact', 'Validated deliverable package recorded.', task.id);
    }
    return run;
  }
  if ((result.retryable ?? true) && task.attempts < task.maxAttempts) {
    task.status = 'queued'; run.stage = 'recover'; event(run, 'recovery', `Retrying ${task.title} (${task.attempts}/${task.maxAttempts}).`, task.id); return run;
  }
  task.status = 'failed'; run.stage = 'blocked'; run.blockedReason = result.error || `${task.title} failed after ${task.attempts} attempts.`; event(run, 'gate', run.blockedReason, task.id); return run;
}

/** Continue autonomous execution until completion or a genuine authorization/failure gate. */
export async function runToGate(run: AgentRun, executor: SuperAgentToolExecutor): Promise<AgentRun> {
  while (run.stage !== 'complete' && run.stage !== 'blocked') await advance(run, executor);
  return run;
}
