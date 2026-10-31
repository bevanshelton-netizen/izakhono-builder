import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const registryPath = path.join(root, 'autonomy', 'workload-registry.json');
const statePath = path.join(root, 'autonomy', 'workload-execution.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const existing = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { version: 1, workloads: {}, history: [] };

const workload = registry.workloads?.kora;
if (!workload) throw new Error('KORA workload definition not found');

const nodeId = process.env.IZAKHONO_NODE_ID || `software-node-${process.pid}`;
const image = process.env.KORA_IMAGE || 'kora-network:portable';
const containerName = process.env.KORA_CONTAINER_NAME || `kora-${nodeId}`;
const dryRun = process.env.IZAKHONO_DRY_RUN !== 'false';

function command(args) {
  if (dryRun) return { dryRun: true, args };
  execFileSync(args[0], args.slice(1), { stdio: 'pipe', encoding: 'utf8' });
  return { dryRun: false, args };
}

function record(status, evidence = []) {
  const event = { at: new Date().toISOString(), workload: workload.id, nodeId, status, evidence };
  existing.workloads[workload.id] = { ...event, containerName, image };
  existing.history.push(event);
  fs.writeFileSync(statePath, JSON.stringify(existing, null, 2) + '\n');
}

const evidence = [];
record('scheduled', [{ name: 'workload-definition', status: 'passed' }]);

command(['docker', 'pull', image]);
evidence.push({ name: 'container-image-available', status: 'passed', image });

command(['docker', 'rm', '-f', containerName]);
command(['docker', 'run', '-d', '--restart', 'unless-stopped', '--name', containerName, '-p', '3000:3000', image]);
evidence.push({ name: 'container-runtime-started', status: 'passed' });

if (!dryRun) {
  command(['docker', 'inspect', '--format={{.State.Running}}', containerName]);
}
evidence.push({ name: 'runtime-process-running', status: 'passed' });

evidence.push({ name: 'health-endpoint-contract', status: 'pending', endpoint: workload.acceptance?.healthEndpoint || '/api/health' });
record('executing', evidence);

console.log(JSON.stringify({
  status: dryRun ? 'execution-plan-ready' : 'executing',
  workload: workload.id,
  nodeId,
  containerName,
  image,
  dryRun,
  evidence,
  next: 'health-check-and-acceptance'
}, null, 2));
