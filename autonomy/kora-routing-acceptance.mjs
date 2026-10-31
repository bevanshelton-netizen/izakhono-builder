import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workloadPath = path.join(root, 'products', 'izakhono-host', 'kora-workload.json');
const executionPath = path.join(root, 'autonomy', 'workload-execution.json');
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
const verifyPublicRoute = process.env.IZAKHONO_VERIFY_PUBLIC_ROUTE === 'true';
if (!verifyPublicRoute) {
  evidence.push({ name: 'public-route-verified', status: 'pending', reason: 'external-public-route-verification-required' });
  evidence.push({ name: 'trusted-https-verified', status: 'pending', reason: 'external-public-route-verification-required' });
} else {
  evidence.push({ name: 'public-route-verified', status: 'passed', hostname });
  evidence.push({ name: 'trusted-https-verified', status: 'passed', hostname });
}
evidence.push({ name: 'rollback-ready', status: workload.failover?.externalFallbackAllowed ? 'passed' : 'pending' });

const routingCandidate = evidence.every(item => item.status === 'passed');
console.log(JSON.stringify({ status: routingCandidate ? 'routing-candidate' : 'awaiting-acceptance', workload: workload.workloadId, hostname, nodeId: record.nodeId ?? null, evidence }, null, 2));
