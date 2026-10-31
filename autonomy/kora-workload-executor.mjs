import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const workloadPath = path.join(root, 'products', 'izakhono-host', 'kora-workload.json');
const statePath = path.join(root, 'autonomy', 'workload-execution.json');

const workload = JSON.parse(fs.readFileSync(workloadPath, 'utf8'));
const existing = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { version: 2, workloads: {}, history: [] };

const nodeId = process.env.IZAKHONO_NODE_ID || `software-node-${process.pid}`;
const image = process.env.KORA_IMAGE || 'kora-network:portable';
const containerName = process.env.KORA_CONTAINER_NAME || `kora-${nodeId}`;
const port = Number(process.env.KORA_PORT || workload.artifact.containerPort || 3000);
const dryRun = process.env.IZAKHONO_DRY_RUN !== 'false';
const healthPath = workload.artifact.healthPath || '/api/health';

function run(args) {
  if (dryRun) return { dryRun: true, stdout: '' };
  return { dryRun: false, stdout: execFileSync(args[0], args.slice(1), { stdio: 'pipe', encoding: 'utf8' }).trim() };
}

function record(status, evidence, extra = {}) {
  const event = {
    at: new Date().toISOString(),
    workload: workload.workloadId,
    nodeId,
    status,
    evidence,
    ...extra,
  };
  existing.workloads[workload.workloadId] = { ...event, containerName, image };
  existing.history.push(event);
  fs.writeFileSync(statePath, JSON.stringify(existing, null, 2) + '\n');
  return event;
}

const evidence = [
  { name: 'workload-definition', status: 'passed', source: workloadPath },
  { name: 'image-built', status: 'pending', image },
];

if (dryRun) {
  record('execution-plan-ready', evidence, { acceptance: 'not-verified' });
  console.log(JSON.stringify({
    status: 'execution-plan-ready',
    workload: workload.workloadId,
    nodeId,
    containerName,
    image,
    dryRun: true,
    evidence,
    next: 'run-with-IZAKHONO_DRY_RUN=false-on-an-eligible-software-node',
  }, null, 2));
  process.exit(0);
}

try {
  run(['docker', 'pull', image]);
  evidence[1] = { name: 'image-built', status: 'passed', image };

  try { run(['docker', 'rm', '-f', containerName]); } catch {}
  run(['docker', 'run', '-d', '--restart', 'unless-stopped', '--name', containerName, '-p', `${port}:${port}`, image]);
  evidence.push({ name: 'container-started', status: 'passed' });

  const running = run(['docker', 'inspect', '--format={{.State.Running}}', containerName]).stdout;
  if (running !== 'true') throw new Error('KORA container is not running');
  evidence.push({ name: 'runtime-healthy', status: 'passed' });

  const healthUrl = `http://127.0.0.1:${port}${healthPath}`;
  const health = run(['curl', '-fsS', healthUrl]).stdout;
  const payload = JSON.parse(health);
  if (!payload || payload.ok !== true) throw new Error('KORA health payload did not report ok=true');
  evidence.push({ name: 'health-200', status: 'passed', endpoint: healthUrl });
  evidence.push({ name: 'service-connectivity', status: 'passed' });

  for (const required of workload.acceptance.required) {
    if (!evidence.some(item => item.name === required && item.status === 'passed')) {
      evidence.push({ name: required, status: 'pending', reason: 'requires additional production evidence' });
    }
  }

  const accepted = workload.acceptance.required.every(required =>
    evidence.some(item => item.name === required && item.status === 'passed')
  );

  const status = accepted ? 'accepted' : 'running-awaiting-acceptance-evidence';
  record(status, evidence, { acceptance: accepted ? 'passed' : 'pending', healthPayload: payload });
  console.log(JSON.stringify({ status, workload: workload.workloadId, nodeId, containerName, image, dryRun: false, evidence, next: accepted ? 'routing-candidate' : 'collect-remaining-acceptance-evidence' }, null, 2));
} catch (error) {
  evidence.push({ name: 'execution-error', status: 'failed', message: error instanceof Error ? error.message : String(error) });
  record('failed', evidence, { acceptance: 'failed' });
  console.error(JSON.stringify({ status: 'failed', workload: workload.workloadId, nodeId, containerName, image, evidence }, null, 2));
  process.exitCode = 1;
}
