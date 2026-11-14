import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./host/admin-ui/index.html', import.meta.url), 'utf8');
for (const marker of [
  'IZAKHONO HOSTING CONTROL CENTRE',
  'Hosted sites',
  'Recent deployments',
  '/api/control-centre',
  "credentials:'same-origin'",
  "cache:'no-store'",
  'acceptance'
]) {
  assert.ok(html.includes(marker), `missing hosting dashboard marker: ${marker}`);
}
assert.ok(html.includes('const esc='), 'UI must escape runtime-returned values');
assert.ok(html.includes('refresh()'), 'UI must support manual refresh');
assert.ok(!html.includes('const snapshot={'), 'UI must not use a fabricated static snapshot');
console.log('[PASS] live hosting control centre UI contract');
