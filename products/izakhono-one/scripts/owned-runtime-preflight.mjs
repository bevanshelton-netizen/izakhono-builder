import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const required = [
  'server.mjs',
  'package.json',
  'Dockerfile',
  'public/registry.json',
  'services/runtime.mjs',
  'services/database-security.mjs',
  'services/supabase-search-store.mjs',
  'services/supabase-node-store.mjs',
  'services/node-control.mjs',
  'services/persistent-node-control.mjs'
];

for (const relative of required) await access(join(root, relative));

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const dockerfile = await readFile(join(root, 'Dockerfile'), 'utf8');
const server = await readFile(join(root, 'server.mjs'), 'utf8');

if (!pkg.scripts?.test) throw new Error('missing npm test script');
if (!pkg.scripts?.['node-control']?.includes('test-persistent-node-control.mjs')) throw new Error('persistent node control test missing from node-control suite');
if (!dockerfile.includes('COPY services ./services')) throw new Error('owned container must include services runtime');
if (!dockerfile.includes('CMD ["node","server.mjs"]')) throw new Error('owned container entrypoint mismatch');
if (!server.includes("process.env.HOST || '0.0.0.0'")) console.log('HOST_BINDING=NOT_YET_FIXED');
else console.log('HOST_BINDING=CONFIGURABLE');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.log('SUPABASE_SERVICE_ROLE_KEY=NOT_PRESENT (expected for structural preflight)');
else console.log('SUPABASE_SERVICE_ROLE_KEY=PRESENT');
if (!process.env.SUPABASE_URL) console.log('SUPABASE_URL=NOT_PRESENT (expected for structural preflight)');
else console.log('SUPABASE_URL=PRESENT');
console.log('OWNED_RUNTIME_PREFLIGHT=PASS');
