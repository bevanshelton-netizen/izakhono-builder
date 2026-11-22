/**
 * IZAKHONO CODE AGENT v1
 *
 * Provider-neutral coding-agent contracts and deterministic safety boundary.
 * The agent may inspect and modify only an explicitly mounted workspace.
 * Real filesystem and process execution are supplied by a separately managed,
 * isolated runner; this module never executes shell commands itself.
 */

export type CodeTaskKind = 'inspect' | 'edit' | 'test' | 'review';
export type CodeTaskStatus = 'queued' | 'running' | 'passed' | 'failed' | 'blocked';
export type CodeApproval = 'none' | 'workspace_write' | 'network' | 'production';

export interface CodeAgentGoal {
  id: string;
  repository: string;
  baseRef: string;
  objective: string;
  maxSteps?: number;
}

export interface CodeTask {
  id: string;
  kind: CodeTaskKind;
  title: string;
  dependsOn: string[];
  status: CodeTaskStatus;
  approval: CodeApproval;
}

export interface CodePlan {
  goal: CodeAgentGoal;
  tasks: CodeTask[];
  status: 'planned' | 'running' | 'blocked' | 'complete' | 'failed';
  events: Array<{ at: string; type: string; message: string }>;
}

export interface WorkspaceDescriptor {
  id: string;
  root: string;
  repository: string;
  baseRef: string;
  isolated: true;
  network: 'disabled' | 'allowlisted';
}

export interface WorkspaceFile {
  path: string;
  content: string;
}

export interface Patch {
  path: string;
  unifiedDiff: string;
}

export interface CommandSpec {
  id: string;
  argv: string[];
  timeoutMs: number;
}

export interface CodeRunner {
  readFile(workspace: WorkspaceDescriptor, path: string): Promise<WorkspaceFile>;
  listFiles(workspace: WorkspaceDescriptor, path: string): Promise<string[]>;
  applyPatch(workspace: WorkspaceDescriptor, patch: Patch): Promise<{ applied: boolean; evidence: string[] }>;
  runCommand(workspace: WorkspaceDescriptor, command: CommandSpec): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  diff(workspace: WorkspaceDescriptor): Promise<string>;
}

export interface CodeAgentPolicy {
  allowedRepositories: string[];
  allowedCommands: string[];
  maxCommandTimeoutMs: number;
  maxFileBytes: number;
  maxPatchBytes: number;
  allowNetwork: boolean;
}

export function validateWorkspacePath(path: string): string {
  if (typeof path !== 'string' || !path.trim()) throw new Error('Workspace path is required.');
  const normalized = path.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.includes('\0')) {
    throw new Error('Absolute paths are not permitted.');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Workspace path contains an unsafe segment.');
  }
  return segments.join('/');
}

export function validateCommand(command: CommandSpec, policy: CodeAgentPolicy): CommandSpec {
  if (!command || !Array.isArray(command.argv) || command.argv.length === 0 ||
      command.argv.some((part) => typeof part !== 'string' || !part.trim())) {
    throw new Error('Command argv must be a non-empty string array.');
  }
  if (!policy.allowedCommands.includes(command.argv[0])) {
    throw new Error('Command executable is not allowlisted.');
  }
  if (!Number.isInteger(command.timeoutMs) || command.timeoutMs < 1 ||
      command.timeoutMs > policy.maxCommandTimeoutMs) {
    throw new Error('Command timeout exceeds policy.');
  }
  return { ...command, argv: [...command.argv] };
}

export function assertWorkspaceAllowed(workspace: WorkspaceDescriptor, goal: CodeAgentGoal, policy: CodeAgentPolicy): void {
  if (!workspace.isolated) throw new Error('Coding requires an isolated workspace.');
  if (workspace.repository !== goal.repository || workspace.baseRef !== goal.baseRef) {
    throw new Error('Workspace does not match the requested repository and base ref.');
  }
  if (!policy.allowedRepositories.includes(goal.repository)) {
    throw new Error('Repository is not allowlisted.');
  }
  if (workspace.network === 'allowlisted' && !policy.allowNetwork) {
    throw new Error('Workspace network access is not permitted.');
  }
}

export function planCodeGoal(goal: CodeAgentGoal): CodePlan {
  if (!goal.id.trim() || !goal.repository.trim() || !goal.baseRef.trim() || !goal.objective.trim()) {
    throw new Error('Goal id, repository, base ref and objective are required.');
  }
  const tasks: CodeTask[] = [
    { id: goal.id + ':inspect', kind: 'inspect', title: 'Inspect repository and relevant files', dependsOn: [], status: 'queued', approval: 'none' },
    { id: goal.id + ':edit', kind: 'edit', title: 'Prepare and apply a bounded workspace patch', dependsOn: [goal.id + ':inspect'], status: 'queued', approval: 'workspace_write' },
    { id: goal.id + ':test', kind: 'test', title: 'Run allowlisted validation commands', dependsOn: [goal.id + ':edit'], status: 'queued', approval: 'none' },
    { id: goal.id + ':review', kind: 'review', title: 'Review diff and produce evidence', dependsOn: [goal.id + ':test'], status: 'queued', approval: 'none' },
  ];
  return {
    goal: { ...goal, maxSteps: Math.min(Math.max(goal.maxSteps ?? 30, 1), 100) },
    tasks,
    status: 'planned',
    events: [{ at: new Date().toISOString(), type: 'plan', message: 'Created a four-stage coding plan. Execution requires an isolated runner.' }],
  };
}

export async function inspectWorkspace(
  runner: CodeRunner,
  workspace: WorkspaceDescriptor,
  goal: CodeAgentGoal,
  policy: CodeAgentPolicy,
): Promise<{ files: string[]; evidence: string[] }> {
  assertWorkspaceAllowed(workspace, goal, policy);
  const files = await runner.listFiles(workspace, '.');
  const safeFiles = files.map(validateWorkspacePath);
  return {
    files: safeFiles,
    evidence: [`Inspected ${safeFiles.length} workspace paths in isolated workspace ${workspace.id}.`],
  };
}

export async function applyWorkspacePatch(
  runner: CodeRunner,
  workspace: WorkspaceDescriptor,
  goal: CodeAgentGoal,
  policy: CodeAgentPolicy,
  patch: Patch,
): Promise<{ applied: boolean; evidence: string[] }> {
  assertWorkspaceAllowed(workspace, goal, policy);
  const path = validateWorkspacePath(patch.path);
  if (new TextEncoder().encode(patch.unifiedDiff).byteLength > policy.maxPatchBytes) {
    throw new Error('Patch exceeds policy size limit.');
  }
  if (!patch.unifiedDiff.trim()) throw new Error('Patch cannot be empty.');
  return runner.applyPatch(workspace, { ...patch, path });
}

export async function runValidationCommand(
  runner: CodeRunner,
  workspace: WorkspaceDescriptor,
  goal: CodeAgentGoal,
  policy: CodeAgentPolicy,
  command: CommandSpec,
): Promise<{ passed: boolean; exitCode: number; evidence: string[] }> {
  assertWorkspaceAllowed(workspace, goal, policy);
  const safeCommand = validateCommand(command, policy);
  const result = await runner.runCommand(workspace, safeCommand);
  return {
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    evidence: [`Executed allowlisted command ${safeCommand.id}; exit code ${result.exitCode}.`],
  };
}
