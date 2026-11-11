import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const compose = await readFile(new URL('./docker-compose.yml', import.meta.url), 'utf8');
assert.match(source, /ALLOWED_IMAGE_PREFIX/);
assert.match(source, /image_not_allowed/);
assert.match(source, /POST.*\/deploy/s);
assert.match(source, /docker/);
assert.match(compose, /restart:\s*unless-stopped/);
console.log('[PASS] NODE01 runtime and container restart contract validated.');
