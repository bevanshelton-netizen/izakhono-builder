import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('repository form avoids browser window.name and reports errors', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="repoName"/);
  assert.match(html, /name:repoName\.value/);
  assert.doesNotMatch(html, /name:name\.value/);
  assert.match(html, /id="repoError"/);
});


test('AI operations remains read-only and visible in the owner console', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const server = await readFile(new URL('../src/server.mjs', import.meta.url), 'utf8');
  assert.match(html, /AI Operations/);
  assert.match(html, /\/api\/ai-operations\/status/);
  assert.match(html, /Harness sandbox prepared/);
  assert.match(html, /External AI ready to activate/);
  assert.match(html, /Oracle A1 worker registered/);
  assert.match(html, /Owner model pool/);
  assert.match(html, /Gateway capacity/);
  assert.match(server, /ownerPoolAvailable/);
  assert.match(server, /maxInflight/);
  assert.match(server, /\/api\/ai-operations\/status/);
  assert.match(server, /external-ai\.key\.dpapi/);
  assert.match(server, /oracle-a1-worker\.json/);
  assert.match(server, /manual-local-sandbox/);
  assert.doesNotMatch(server, /launch-harness/);
});
