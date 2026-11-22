import assert from 'node:assert/strict';
import {
  applyWorkspacePatch,
  assertWorkspaceAllowed,
  planCodeGoal,
  runValidationCommand,
  validateCommand,
  validateWorkspacePath,
  type CodeAgentPolicy,
  type CodeRunner,
  type WorkspaceDescriptor,
} from './index';

async function main() {
const policy: CodeAgentPolicy = {
  allowedRepositories: ['bevanshelton-netizen/izakhono-builder'],
  allowedCommands: ['npm'],
  maxCommandTimeoutMs: 120_000,
  maxFileBytes: 1_000_000,
  maxPatchBytes: 100_000,
  allowNetwork: false,
};
const goal = {
  id: 'code-001',
  repository: 'bevanshelton-netizen/izakhono-builder',
  baseRef: 'main',
  objective: 'Add a feature and verify it.',
};
const workspace: WorkspaceDescriptor = {
  id: 'workspace-001',
  root: '/isolated/workspace',
  repository: goal.repository,
  baseRef: 'main',
  isolated: true,
  network: 'disabled',
};

assert.equal(validateWorkspacePath('src\\index.ts'), 'src/index.ts');
assert.throws(() => validateWorkspacePath('../secrets'), /unsafe segment/);
assert.throws(() => validateWorkspacePath('/etc/passwd'), /Absolute paths/);
assert.throws(() => validateWorkspacePath('C:\\\\Windows\\\\system.ini'), /Absolute paths/);
assert.throws(() => validateWorkspacePath('src//file.ts'), /unsafe segment/);
assert.throws(() => validateCommand({ id: 'bad', argv: ['bash', '-c', 'whoami'], timeoutMs: 1000 }, policy), /not allowlisted/);
assert.throws(() => validateCommand({ id: 'slow', argv: ['npm', 'test'], timeoutMs: 999999 }, policy), /timeout/);
assert.throws(() => assertWorkspaceAllowed({ ...workspace, isolated: false } as any, goal, policy), /isolated/);
assert.throws(() => assertWorkspaceAllowed({ ...workspace, network: 'allowlisted' }, goal, policy), /network/);
assert.throws(() => assertWorkspaceAllowed(workspace, { ...goal, repository: 'other/repo' }, policy), /does not match/);

const plan = planCodeGoal(goal);
assert.equal(plan.tasks.length, 4);
assert.deepEqual(plan.tasks.map(task => task.kind), ['inspect', 'edit', 'test', 'review']);
assert.deepEqual(plan.tasks[2].dependsOn, ['code-001:edit']);

let patchApplied = false;
let commandExecuted = false;
const runner: CodeRunner = {
  async readFile(_workspace, path) { return { path, content: 'hello' }; },
  async listFiles() { return ['src/index.ts', 'README.md']; },
  async applyPatch(_workspace, patch) {
    patchApplied = patch.path === 'src/index.ts';
    return { applied: patchApplied, evidence: ['patch receipt'] };
  },
  async runCommand(_workspace, command) {
    commandExecuted = command.argv[0] === 'npm';
    return { exitCode: 0, stdout: 'ok', stderr: '' };
  },
  async diff() { return 'diff --git a/src/index.ts b/src/index.ts'; },
};

const patchResult = await applyWorkspacePatch(runner, workspace, goal, policy, {
  path: 'src/index.ts',
  unifiedDiff: '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-old\n+new',
});
assert.equal(patchResult.applied, true);
assert.equal(patchApplied, true);

const testResult = await runValidationCommand(runner, workspace, goal, policy, {
  id: 'npm-test',
  argv: ['npm', 'test'],
  timeoutMs: 30_000,
});
assert.equal(testResult.passed, true);
assert.equal(commandExecuted, true);

console.log('[PASS] IZAKHONO CODE AGENT workspace policy and runner contracts.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
