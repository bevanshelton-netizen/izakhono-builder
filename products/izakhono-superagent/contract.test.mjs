import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./src/index.ts', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../../superagent/workflow.json', import.meta.url), 'utf8');

assert.match(source, /\/v1\/plan/);
assert.match(source, /\/v1\/run/);
assert.match(source, /\/v1\/fetch/);
assert.match(source, /SUPERAGENT_SECRET/);
assert.match(source, /ALLOWED_FETCH_HOSTS/);
assert.match(source, /https:/);
assert.match(source, /BUILDER_URL/);
assert.match(source, /SEARCH_URL/);
assert.match(source, /Deployment is an authorization-gated adapter/);
assert.match(source, /File adapter requires an approved runtime connector/);
assert.match(workflow, /"owned_first": true/);
assert.match(workflow, /"arbitrary_shell": false/);
assert.match(workflow, /"public_release"/);

console.log('IZAKHONO SUPERAGENT runtime contract: PASS');
