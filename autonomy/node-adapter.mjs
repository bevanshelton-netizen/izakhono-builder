import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ingestHeartbeat, deploymentTarget } from './node-control-plane.mjs';
import { scheduleWorkload } from './workload-scheduler.mjs';

const root = process.cwd();
const agent = path.join(root, 'autonomy', 'node-agent.mjs');
const heartbeat = path.join(root, 'autonomy', 'node-heartbeat.mjs');
const softwareNode = path.join(root, 'autonomy', 'software-node.mjs');
const koraExecutor = path.join(root, 'autonomy', 'kora-workload-executor.mjs');
const koraRouting = path.join(root, 'autonomy', 'kora-routing-acceptance.mjs');

function evidencePath() {
  return process.env.IZAKHONO_NODE_HEARTBEAT_EVIDENCE_PATH
    || path.join(process.env.IZAKHONO_NODE_DATA_DIR || path.join(root, 'autonomy'), 'heartbeat.json');
}

function runProcess(script, request = null, envOverrides = {}) {
  return new Promise((resolve) => {
    const args = request === null ? [script] : [script, typeof request === 'string' ? request : JSON.stringify(request)];
    const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...envOverrides } });
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

  if (action === 'kora-workload-execute') {
    if (!input.selectedNode) {
      return { status: 'waiting', reason: 'eligible-owned-node-not-selected' };
    }
    if (process.env.IZAKHONO_KORA_EXECUTION_APPROVED !== 'true' || process.env.IZAKHONO_DRY_RUN !== 'false') {
      return {
        status: 'waiting',
        ownerGate: 'production_deploy',
        reason: 'explicit-owner-approval-and-live-runtime-configuration-required',
        evidence: [{ name: 'production-execution-authorization', status: 'pending' }],
      };
    }
    const localNode = await runProcess(softwareNode, { operation: 'inspect' });
    const localNodeId = localNode.state?.nodeId || localNode.nodeId;
    if (localNode.status === 'failed' || localNodeId !== input.selectedNode) {
      return { status: 'waiting', reason: 'selected-owned-node-runtime-not-bound', selectedNode: input.selectedNode, localNodeId: localNodeId || null };
    }
    const result = await runProcess(koraExecutor);
    if (result.status === 'failed') return result;
    const runtimeChecks = ['image-built', 'container-started', 'health-200', 'runtime-healthy', 'service-connectivity', 'runtime-acceptance-recorded'];
    const runtimeAccepted = result.runtimeAcceptance === 'passed'
      && runtimeChecks.every(name => result.evidence?.some(item => item.name === name && item.status === 'passed'));
    return runtimeAccepted
      ? { ...result, status: 'completed', source: 'owned-node-runtime' }
      : { ...result, status: 'waiting', reason: 'kora-runtime-acceptance-evidence-incomplete' };
  }

  if (action === 'kora-routing-acceptance') {
    const result = await runProcess(koraRouting);
    if (result.status === 'routing-candidate') {
      return { ...result, status: 'completed', acceptance: 'passed', source: 'verified-public-route-and-rollback-evidence' };
    }
    if (result.status === 'awaiting-acceptance' || result.status === 'waiting') {
      return { ...result, status: 'waiting', reason: result.reason || 'public-route-or-rollback-evidence-incomplete' };
    }
    return { ...result, status: 'failed', reason: result.reason || 'kora-routing-acceptance-failed' };
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
