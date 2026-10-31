import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { deploymentTarget } from './node-control-plane.mjs';

const root = process.cwd();
const statePath = process.env.IZAKHONO_WORKLOAD_STATE_PATH || path.join(root, 'autonomy', 'workload-state.json');

function readState() {
  if (!fs.existsSync(statePath)) return { schema: 'izakhono.workload-state/v1', workloads: {} };
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function writeState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tmp = `${statePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, statePath);
}

/**
 * Provider-neutral workload scheduler.
 * It assigns workloads only to fresh, healthy Software NODEs selected by the
 * IZAKHONO control plane. It records intent/evidence but does not claim that
 * a workload is live until a workload-specific runtime check is supplied.
 */
export function scheduleWorkload(workload = {}) {
  if (!workload.workloadId) throw new Error('workloadId is required');
  const target = deploymentTarget(workload.requirements || {});
  if (target.status !== 'ready') {
    return {
      contract: 'izakhono.workload/v1',
      status: 'waiting',
      workloadId: workload.workloadId,
      reason: target.reason,
      target,
    };
  }

  const state = readState();
  const assignmentId = crypto.randomUUID();
  const assignment = {
    assignmentId,
    workloadId: workload.workloadId,
    workloadType: workload.workloadType || 'application',
    version: workload.version || null,
    nodeId: target.nodeId,
    status: 'assigned',
    assignedAt: new Date().toISOString(),
    source: 'izakhono-control-plane',
    targetReason: target.reason,
  };
  state.workloads[workload.workloadId] = assignment;
  writeState(state);

  return {
    contract: 'izakhono.workload/v1',
    status: 'assigned',
    ...assignment,
    target,
    verificationRequired: true,
  };
}

export function getWorkload(workloadId) {
  return readState().workloads[workloadId] || null;
}

export function listWorkloads() {
  return Object.values(readState().workloads);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [operation = 'list', payload = '{}'] = process.argv.slice(2);
  const input = JSON.parse(payload);
  const result = operation === 'schedule'
    ? scheduleWorkload(input)
    : operation === 'get'
      ? getWorkload(input.workloadId)
      : listWorkloads();
  console.log(JSON.stringify(result, null, 2));
}
