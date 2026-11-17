import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workloadPath = path.join(root, 'products', 'izakhono-host', 'kora-workload.json');
const dataRoot = process.env.IZAKHONO_NODE_DATA_DIR || path.join(root, '.izakhono-private');
const executionPath = process.env.IZAKHONO_WORKLOAD_EXECUTION_STATE_PATH || path.join(dataRoot, 'workload-execution.json');
const rollbackEvidencePath = process.env.IZAKHONO_KORA_ROLLBACK_EVIDENCE_PATH || path.join(dataRoot, 'kora-rollback-evidence.json');
const workload = JSON.parse(fs.readFileSync(workloadPath, 'utf8'));

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryPath = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporaryPath, file);
}

async function main() {
  const execution = readJson(executionPath);
  const record = execution?.workloads?.[workload.workloadId];
  const evidence = [];

  if (!record) {
    console.log(JSON.stringify({ status: 'waiting', reason: 'kora-runtime-evidence-not-found', evidence }, null, 2));
    return;
  }
  if (record.runtimeAcceptance !== 'passed') {
    console.log(JSON.stringify({ status: 'waiting', reason: 'kora-runtime-not-verified', evidence: record.evidence ?? [] }, null, 2));
    return;
  }

  const hostname = workload.routing.hostname;
  const healthPath = workload.artifact.healthPath || '/api/health';
  const healthUrl = new URL(healthPath, `https://${hostname}`);
  const timeoutMs = Math.max(1000, Number(process.env.IZAKHONO_KORA_ROUTE_TIMEOUT_MS || 10000));
  let routePassed = false;
  let httpsPassed = false;
  let routeDetail = 'public health endpoint did not return a verified healthy response';

  try {
    const response = await fetch(healthUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    const finalUrl = new URL(response.url || healthUrl.toString());
    httpsPassed = finalUrl.protocol === 'https:';
    routePassed = response.ok && payload?.ok === true;
    routeDetail = `HTTP ${response.status}; final URL ${finalUrl.origin}; health payload ok=${payload?.ok === true}`;
    evidence.push({ name: 'public-route-verified', status: routePassed ? 'passed' : 'failed', url: finalUrl.toString(), detail: routeDetail });
    evidence.push({ name: 'trusted-https-verified', status: httpsPassed ? 'passed' : 'failed', protocol: finalUrl.protocol, detail: 'Node fetch TLS validation and final HTTPS URL' });
    evidence.push({ name: 'service-connectivity', status: routePassed ? 'passed' : 'failed', detail: routeDetail });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    evidence.push({ name: 'public-route-verified', status: 'failed', url: healthUrl.toString(), detail });
    evidence.push({ name: 'trusted-https-verified', status: 'failed', detail });
    evidence.push({ name: 'service-connectivity', status: 'failed', detail });
  }

  const rollback = readJson(rollbackEvidencePath);
  const rollbackPassed = rollback?.status === 'passed'
    && rollback.workloadId === workload.workloadId
    && rollback.rollbackTestPassed === true
    && typeof rollback.evidenceRef === 'string'
    && rollback.evidenceRef.trim().length > 0
    && Number.isFinite(Date.parse(rollback.verifiedAt || ''));
  evidence.push({
    name: 'rollback-ready',
    status: rollbackPassed ? 'passed' : 'pending',
    evidenceRef: rollbackPassed ? rollback.evidenceRef : undefined,
    reason: rollbackPassed ? undefined : 'independent rollback-test evidence is required',
  });

  const routingCandidate = evidence.every(item => item.status === 'passed');
  record.acceptance = routingCandidate ? 'passed' : 'pending';
  record.acceptanceCheckedAt = new Date().toISOString();
  record.routingEvidence = evidence;
  writeJson(executionPath, execution);

  console.log(JSON.stringify({
    status: routingCandidate ? 'routing-candidate' : 'awaiting-acceptance',
    reason: routingCandidate ? undefined : 'public-route-or-rollback-evidence-incomplete',
    workload: workload.workloadId,
    hostname,
    nodeId: record.nodeId ?? null,
    evidence,
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', reason: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
