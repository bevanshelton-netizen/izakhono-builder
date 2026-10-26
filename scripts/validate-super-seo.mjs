import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const product = join(root, 'products', 'izakhono-super-seo');
const pkg = JSON.parse(await readFile(join(product, 'package.json'), 'utf8'));

const required = {
  check: pkg.scripts?.check,
  test: pkg.scripts?.test,
};

for (const [name, value] of Object.entries(required)) {
  if (!value) throw new Error(`SUPER SEO V5 missing required script: ${name}`);
}

console.log('[SUPER SEO V5] package contract verified.');
console.log('[SUPER SEO V5] running syntax checks and tests...');

const { spawnSync } = await import('node:child_process');
const run = spawnSync('npm', ['run', 'check', '--prefix', product], { stdio: 'inherit', shell: process.platform === 'win32' });
if (run.status !== 0) process.exit(run.status ?? 1);

const tests = spawnSync('npm', ['test', '--prefix', product], { stdio: 'inherit', shell: process.platform === 'win32' });
if (tests.status !== 0) process.exit(tests.status ?? 1);

console.log('[PASS] SUPER SEO V5 validation complete.');
