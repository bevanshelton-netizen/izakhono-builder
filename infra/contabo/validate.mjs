import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const manifest = JSON.parse(fs.readFileSync(path.join(root, '..', 'runtime-fabric', 'nodes', 'contabo-vps-01.json'), 'utf8'));
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const stackExample = fs.readFileSync(path.join(root, 'stack.env.example'), 'utf8');

const requiredFiles = [
  'README.md',
  '.env.example',
  'cloud-init.yaml',
  'provision.sh',
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

console.log('IZAKHONO Contabo Runtime Fabric gate: PASS');
