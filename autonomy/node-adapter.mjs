import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ingestHeartbeat, deploymentTarget } from './node-control-plane.mjs';
import { scheduleWorkload } from './workload-scheduler.mjs';

const root = process.cwd();
const agent = path.join(root, 'autonomy', 'node-agent.mjs');
const heartbeat = path.join(root, 'autonomy', 'node-heartbeat.mjs');
const softwareNode = path.join(root, 'autonomy', 'software-node.mjs');

function evidencePath() {
  return process.env.IZAKHONO_NODE_HEARTBEAT_EVIDENCE_PATH
    || path.join(process.env.IZAKHONO_NODE_DATA_DIR || path.join(root, 'autonomy'), 'heartbeat.json');
}

function runProcess(script, request = null) {
  return new Promise((resolve) => {
    const args = request === null ? [script] : [script, typeof request === 'string' ? request : JSON.stringify(request)];
    const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ status: 'waiting', reason: 'software-node-agent-timeout' });
    }, Number(process.env.IZAKHONO_NODE_AGENT_TIMEOUT_MS || 30000));
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: 'waiting', reason: 'software-node-runtime-unavailable', error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout.trim());
        resolve({ ...result, exitCode: code, stderr: stderr.trim() });
      } catch {
        resolve({ status: code === 0 ? 'failed' : 'waiting', reason: 'invalid-node-runtime-response', exitCode: code, stderr: stderr.trim(), stdout: stdout.trim() });
      }
    });
  });
}

export async function runNodeAdapter(action, input = {}) {
  if (action === 'node-discovery' || action === 'software-node-instantiation' || action === 'inspect') {
    return runProcess(softwareNode, { operation: 'instantiate', ...input });
  }

  if (action === 'node-heartbeat') {
    const result = await runProcess(softwareNode, { operation: 'heartbeat', ...input });
    if (result.status === 'waiting' || result.status === 'failed') return result;
    return registerAndSummarize(result, 'software-node-heartbeat');
  }

  if (action === 'node-evidence') {
    const file = evidencePath();
    try {
      const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
      return registerAndSummarize(persisted, 'persisted');
    } catch (error) {
      return { status: 'waiting', reason: 'heartbeat-evidence-unavailable', error: error.message };
    }
  }

  if (action === 'node-target') {
    const target = deploymentTarget(input.requirements || {});
    if (target.status !== 'ready') return { status: 'waiting', reason: target.reason, target };
    return { status: 'completed', selectedNode: target.nodeId, target, evidence: [{ name: 'eligible-node-selected', status: 'passed' }] };
  }

  if (action === 'node-readiness' || action === 'promote') {
    const target = deploymentTarget(input.requirements || {});
    if (target.status !== 'ready') return { status: 'waiting', reason: target.reason, target };
    const result = await runProcess(softwareNode, {
      operation: 'promote',
      targetNodeId: input.selectedNode || target.nodeId,
      requestId: input.requestId || `promotion-${Date.now()}`,
      ...input,
    });
    return { ...result, selectedNode: input.selectedNode || target.nodeId, target };
  }

  if (action === 'workload-schedule') {
    return scheduleWorkload(input.workload || {
      workloadId: input.workloadId || 'anonymous-workload',
      workloadType: input.workloadType || 'application',
      requirements: input.requirements || {},
    });
  }

  return { status: 'failed', reason: `unsupported-node-action:${action}` };
}

function registerAndSummarize(result, source) {
  const nodeId = result.nodeId || result.node?.id;
  const heartbeat = {
    ...result,
    nodeId,
    node: result.node || { id: nodeId },
    status: result.health || result.status,
  };
  let registered = null;
  try {
    registered = ingestHeartbeat(heartbeat);
  } catch (error) {
    return { status: 'failed', reason: `${source}-heartbeat-registration-failed`, error: error.message };
  }
  const healthy = result.health === 'healthy';
  return {
    status: healthy ? 'completed' : 'waiting',
    reason: healthy ? undefined : 'node-health-degraded',
    source,
    evidence: [
      { name: 'heartbeat-emitted', status: 'passed' },
      { name: 'node-health-readable', status: healthy ? 'passed' : 'failed' },
      { name: 'capacity-reported', status: result.capacity ? 'passed' : 'not-required' },
      { name: 'heartbeat-persisted', status: result.evidence?.persisted === false ? 'failed' : 'passed' },
    ],
    heartbeat: result,
    registeredNode: registered?.nodeId ?? nodeId ?? null,
  };
}
