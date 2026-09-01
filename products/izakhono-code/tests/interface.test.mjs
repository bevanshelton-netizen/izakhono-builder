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
