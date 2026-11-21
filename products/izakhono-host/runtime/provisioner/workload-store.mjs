import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  createWorkloadRecord, transitionWorkload, recordWorkloadAttempt,
  assertPublicActivation, validateWorkloadSpec
} from './workload-state-machine.mjs';

function makeId() {
  return `nav-workload-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

export function createWorkloadStore({ filePath }) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('A persistent workload filePath is required');
  let queue = Promise.resolve();

  async function read() {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (parsed?.version !== 1 || !Array.isArray(parsed.workloads)) throw new Error('Unsupported workload store format');
      return parsed;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      return { version: 1, workloads: [] };
    }
  }

  async function write(state) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      await fs.rename(temporary, filePath);
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }

  function serialize(operation) {
    const result = queue.then(operation, operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  return Object.freeze({
    async list() {
      const state = await read();
      return state.workloads;
    },
    async get(id) {
      const state = await read();
      return state.workloads.find(item => item.id === id) || null;
    },
    async create(spec, { now = new Date().toISOString() } = {}) {
      return serialize(async () => {
        validateWorkloadSpec(spec);
        const state = await read();
        const duplicate = state.workloads.find(item => item.idempotency_key === spec.idempotencyKey);
        if (duplicate) {
          const same = duplicate.workload_id === spec.workloadId &&
            duplicate.workload_class === spec.workloadClass &&
            duplicate.logical_node_id === spec.logicalNodeId &&
            duplicate.runtime_target_id === (spec.runtimeTargetId || null) &&
            duplicate.release_digest === spec.releaseDigest.toLowerCase() &&
            duplicate.health_path === spec.healthPath &&
            duplicate.internal_port === spec.internalPort;
          if (!same) {
            const error = new Error('Idempotency key was already used for a different workload release');
            error.code = 'IDEMPOTENCY_CONFLICT';
            throw error;
          }
          return { created: false, workload: duplicate };
        }
        const workload = createWorkloadRecord(spec, { id: makeId(), now });
        state.workloads.push(workload);
        await write(state);
        return { created: true, workload };
      });
    },
    async claimNext({ workerId, leaseMs = 60000, now = new Date() } = {}) {
      return serialize(async () => {
        if (typeof workerId !== 'string' || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(workerId)) throw new Error('workerId must be a stable lowercase identifier');
        if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000) throw new Error('leaseMs must be between 1000 and 300000');
        const instant = now instanceof Date ? now : new Date(now);
        if (!Number.isFinite(instant.getTime())) throw new Error('now must be a valid date');
        const state = await read();
        const candidate = state.workloads.find(item => {
          const leaseExpired = !item.worker_lease || Date.parse(item.worker_lease.expires_at) <= instant.getTime();
          const retryReady = !item.retry_after || Date.parse(item.retry_after) <= instant.getTime();
          const runnableState = ['REQUESTED', 'VALIDATING', 'PROVISIONING'].includes(item.state);
          return runnableState && item.runtime_target_id && !item.execution_stage && leaseExpired && retryReady && Number(item.attempts || 0) < 5;
        });
        if (!candidate) return null;
        const attempted = recordWorkloadAttempt(candidate, instant.toISOString());
        attempted.worker_lease = { worker_id: workerId, expires_at: new Date(instant.getTime() + leaseMs).toISOString() };
        attempted.retry_after = null;
        const index = state.workloads.findIndex(item => item.id === candidate.id);
        state.workloads[index] = attempted;
        await write(state);
        return attempted;
      });
    },
    async recordExecution(id, workerId, event, details = {}, now = new Date().toISOString()) {
      return serialize(async () => {
        const state = await read();
        const index = state.workloads.findIndex(item => item.id === id);
        if (index < 0) return null;
        const record = state.workloads[index];
        if (record.worker_lease?.worker_id !== workerId || Date.parse(record.worker_lease.expires_at) <= Date.parse(now)) {
          throw new Error('Worker lease is missing, expired or owned by another worker');
        }
        if (typeof event !== 'string' || !/^[A-Z0-9_]{3,64}$/.test(event)) throw new Error('Execution event must be a stable uppercase identifier');
        const safeDetails = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
        record.execution_evidence = [...(record.execution_evidence || []), { at: now, event, details: safeDetails }];
        if (typeof safeDetails.stage === 'string') record.execution_stage = safeDetails.stage;
        record.updated_at = now;
        await write(state);
        return record;
      });
    },
    async releaseClaim(id, workerId, { retryAfter = null, errorCode = null } = {}, now = new Date().toISOString()) {
      return serialize(async () => {
        const state = await read();
        const index = state.workloads.findIndex(item => item.id === id);
        if (index < 0) return null;
        const record = state.workloads[index];
        if (record.worker_lease?.worker_id !== workerId) throw new Error('Worker lease is owned by another worker');
        delete record.worker_lease;
        if (retryAfter) record.retry_after = retryAfter;
        if (errorCode) record.last_execution_error = String(errorCode).slice(0, 80);
        record.updated_at = now;
        await write(state);
        return record;
      });
    },
    async transition(id, next, metadata = {}, now = new Date().toISOString()) {
      return serialize(async () => {
        const state = await read();
        const index = state.workloads.findIndex(item => item.id === id);
        if (index < 0) return null;
        state.workloads[index] = transitionWorkload(state.workloads[index], next, metadata, now);
        await write(state);
        return state.workloads[index];
      });
    },
    async attempt(id, now = new Date().toISOString()) {
      return serialize(async () => {
        const state = await read();
        const index = state.workloads.findIndex(item => item.id === id);
        if (index < 0) return null;
        state.workloads[index] = recordWorkloadAttempt(state.workloads[index], now);
        await write(state);
        return state.workloads[index];
      });
    },
    async activate(id, evidence = {}) {
      return serialize(async () => {
        const state = await read();
        const index = state.workloads.findIndex(item => item.id === id);
        if (index < 0) return null;
        state.workloads[index] = assertPublicActivation(state.workloads[index], evidence);
        await write(state);
        return state.workloads[index];
      });
    }
  });
}
