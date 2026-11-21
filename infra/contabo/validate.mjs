import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const manifest = JSON.parse(fs.readFileSync(path.join(root, '..', 'runtime-fabric', 'nodes', 'contabo-vps-01.json'), 'utf8'));
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const stackExample = fs.readFileSync(path.join(root, 'stack.env.example'), 'utf8');
const compose = fs.readFileSync(path.join(root, 'compose.yml'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'deploy-stack.sh'), 'utf8');
const inventory = fs.readFileSync(path.join(root, 'inventory.sh'), 'utf8');

const requiredFiles = [
  'README.md',
  '.env.example',
  'cloud-init.yaml',
  'provision.sh',
  'inventory.sh',
  'healthcheck.sh',
  'deploy-stack.sh',
  'compose.yml',
  'stack.env.example',
  'postgres-init/001-extensions.sql'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
}

if (manifest.provider !== 'contabo') throw new Error('Provider must be contabo');
if (manifest.dataSourceOfTruth !== false) throw new Error('Runtime node cannot be source of truth');
if (manifest.publicTraffic !== false) throw new Error('Node must not claim public traffic before cutover gates');
if (manifest.productId !== 'V161') throw new Error('plus8 must map to Contabo product V161');
if (!envExample.includes('CONTABO_CLIENT_SECRET=')) throw new Error('Contabo secret contract missing');
if (!stackExample.includes('POSTGRES_PASSWORD=CHANGE_ME')) throw new Error('Stack example must not contain a real secret');

for (const key of ['POSTGRES_IMAGE=', 'REDIS_IMAGE=', 'QDRANT_IMAGE=', 'OPEN_WEBUI_IMAGE=']) {
  if (!stackExample.includes(key) || !compose.includes('${' + key.slice(0, -1) + ':?')) {
    throw new Error(`Missing required digest-pinned image contract: ${key}`);
  }
}
if (!deploy.includes('test("@sha256:[0-9a-f]{64}$")')) throw new Error('Deployment must reject mutable or unverified image tags');
if (deploy.includes('source /opt/izakhono/config/stack.env')) throw new Error('Secret files must never be executed as shell code');
if (deploy.indexOf('Missing regular secret file') > deploy.indexOf('mv -Tf "$NEXT_LINK" "$CURRENT"')) {
  throw new Error('Secret preflight must happen before release pointer switch');
}
if (!inventory.includes('--get') || !inventory.includes('/v1/compute/instances')) {
  throw new Error('Read-only Contabo inventory contract missing');
}
if (inventory.includes('-X POST "${API}/v1/compute/instances"')) {
  throw new Error('Inventory helper must not provision compute instances');
}

console.log('IZAKHONO Contabo Runtime Fabric gate: PASS');
