import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const agent = path.join(root, 'autonomy', 'node-agent.mjs');
const heartbeat = path.join(root, 'autonomy', 'node-heartbeat.mjs');

function runProcess(script, request = null) {
  return new Promise((resolve) => {
    const args = request ? [script, JSON.stringify(request)] : [script];
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ status: 'waiting', reason: 'node-agent-timeout' });
    }, Number(process.env.IZAKHONO_NODE_AGENT_TIMEOUT_MS || 30000));
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: 'waiting', reason: 'node-agent-unavailable', error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout.trim());
        resolve({ ...result, exitCode: code, stderr: stderr.trim() });
      } catch {
        resolve({
          status: code === 0 ? 'failed' : 'waiting',
          reason: 'invalid-node-agent-response',
          exitCode: code,
          stderr: stderr.trim(),
          stdout: stdout.trim(),
        });
      }
    });
  });
}

export async function runNodeAdapter(action, input = {}) {
  if (action === 'node-discovery' || action === 'inspect') {
    return runProcess(agent, { operation: 'inspect', ...input });
  }
  if (action === 'node-heartbeat') {
    return runProcess(heartbeat);
  }
  if (action === 'node-readiness' || action === 'promote') {
    return runProcess(agent, { operation: 'promote', ...input });
  }
  return { status: 'failed', reason: `unsupported-node-action:${action}` };
}
