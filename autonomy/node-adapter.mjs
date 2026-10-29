import { spawn } from 'node:child_process';
import path from 'node:path';
import { ingestHeartbeat, deploymentTarget } from './node-control-plane.mjs';

const root = process.cwd();
const agent = path.join(root, 'autonomy', 'node-agent.mjs');
const heartbeat = path.join(root, 'autonomy', 'node-heartbeat.mjs');

function runProcess(script, request = null) {
  return new Promise((resolve) => {
    const args = request === null ? [script] : [script, typeof request === 'string' ? request : JSON.stringify(request)];
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
    const result = await runProcess(heartbeat);
    if (result.status === 'waiting' || result.status === 'failed') return result;

    let registered = null;
    try {
      registered = ingestHeartbeat(result);
    } catch (error) {
      return { status: 'failed', reason: 'heartbeat-registration-failed', error: error.message };
    }

    const healthy = result.health === 'healthy';
    return {
      status: healthy ? 'completed' : 'waiting',
      reason: healthy ? undefined : 'node-health-degraded',
      evidence: [
        { name: 'heartbeat-emitted', status: 'passed' },
        { name: 'node-health-readable', status: healthy ? 'passed' : 'failed' },
        { name: 'capacity-reported', status: result.capacity ? 'passed' : 'failed' },
      ],
      heartbeat: result,
      registeredNode: registered?.nodeId ?? result.node?.id ?? null,
    };
  }

  if (action === 'node-readiness' || action === 'promote') {
    const target = deploymentTarget(input.requirements || {});
    if (target.status !== 'ready') {
      return {
        status: 'waiting',
        reason: target.reason,
        ownerGate: 'physical-infrastructure',
        target,
      };
    }

    const result = await runProcess(agent, {
      operation: 'promote',
      targetNodeId: target.nodeId,
      requestId: input.requestId || `promotion-${Date.now()}`,
      ...input,
    });

    return {
      ...result,
      selectedNode: target.nodeId,
      target,
    };
  }

  return { status: 'failed', reason: `unsupported-node-action:${action}` };
}
