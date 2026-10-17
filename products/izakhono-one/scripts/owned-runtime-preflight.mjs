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
  'services/supabase-search-store.mjs'
];

for (const relative of required) await access(join(root, relative));

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const dockerfile = await readFile(join(root, 'Dockerfile'), 'utf8');

if (!pkg.scripts?.test) throw new Error('missing npm test script');
if (!dockerfile.includes('COPY services ./services')) throw new Error('owned container must include services runtime');
if (!dockerfile.includes('CMD ["node","server.mjs"]')) throw new Error('owned container entrypoint mismatch');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.log('SUPABASE_SERVICE_ROLE_KEY=NOT_PRESENT (expected for structural preflight)');
else console.log('SUPABASE_SERVICE_ROLE_KEY=PRESENT');
if (!process.env.SUPABASE_URL) console.log('SUPABASE_URL=NOT_PRESENT (expected for structural preflight)');
else console.log('SUPABASE_URL=PRESENT');
console.log('OWNED_RUNTIME_PREFLIGHT=PASS');
