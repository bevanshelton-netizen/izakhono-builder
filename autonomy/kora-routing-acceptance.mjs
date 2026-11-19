import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workloadPath = path.join(root, 'products', 'izakhono-host', 'kora-workload.json');
const executionPath = process.env.IZAKHONO_WORKLOAD_EXECUTION_STATE_PATH || path.join(root, 'autonomy', 'workload-execution.json');
const workload = JSON.parse(fs.readFileSync(workloadPath, 'utf8'));
const execution = fs.existsSync(executionPath) ? JSON.parse(fs.readFileSync(executionPath, 'utf8')) : null;
const record = execution?.workloads?.[workload.workloadId];

const evidence = [];
if (!record) {
  console.log(JSON.stringify({ status: 'waiting', reason: 'kora-runtime-evidence-not-found', evidence }, null, 2));
  process.exit(0);
}

const accepted = record.acceptance === 'passed' || record.status === 'accepted';
evidence.push({ name: 'runtime-acceptance-record', status: accepted ? 'passed' : 'failed' });

if (!accepted) {
  console.log(JSON.stringify({ status: 'waiting', reason: 'kora-runtime-not-accepted', evidence, nodeId: record.nodeId ?? null }, null, 2));
  process.exit(0);
}

const hostname = workload.routing.hostname;
const healthPath = workload.artifact.healthPath || '/api/health';
try {
  const url = new URL(healthPath, `https://${hostname}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'manual' });
  if (response.status !== 200) throw new Error(`health endpoint returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true) throw new Error('health endpoint did not return ok=true');
  evidence.push({ name: 'public-route-verified', status: 'passed', hostname, endpoint: url.toString(), httpStatus: response.status });
  evidence.push({ name: 'trusted-https-verified', status: 'passed', hostname, tls: 'validated-by-runtime' });
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  evidence.push({ name: 'public-route-verified', status: 'pending', reason });
  evidence.push({ name: 'trusted-https-verified', status: 'pending', reason });
}
const rollbackPath = process.env.KORA_ROLLBACK_EVIDENCE_PATH;
let rollbackReady = false;
if (rollbackPath && fs.existsSync(rollbackPath)) {
  try {
    const rollback = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
    const verifiedAt = Date.parse(rollback.verifiedAt || '');
    rollbackReady = rollback.rollbackReady === true
      && rollback.tested === true
      && typeof rollback.rollbackTarget === 'string'
      && rollback.rollbackTarget.trim().length > 0
      && Number.isFinite(verifiedAt)
      && Date.now() - verifiedAt >= 0
      && Date.now() - verifiedAt <= 24 * 60 * 60 * 1000;
  } catch {}
}
evidence.push({ name: 'rollback-ready', status: rollbackReady ? 'passed' : 'pending', reason: rollbackReady ? undefined : 'fresh-tested-rollback-evidence-required' });

const routingCandidate = evidence.every(item => item.status === 'passed');
console.log(JSON.stringify({ status: routingCandidate ? 'routing-candidate' : 'awaiting-acceptance', workload: workload.workloadId, hostname, nodeId: record.nodeId ?? null, evidence }, null, 2));
