import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./mail-control-centre-ui.html', import.meta.url), 'utf8');
for (const marker of [
  'IZAKHONO MAIL CONTROL CENTRE',
  'Domain health',
  'Domain acceptance checks',
  'Mailbox operations',
  'Security and incidents',
  '/api/control-centre',
  "credentials:'same-origin'",
  "cache:'no-store'",
  'not_connected'
]) {
  assert.ok(html.includes(marker), `missing live UI marker: ${marker}`);
}
assert.ok(html.includes('const esc='), 'UI must escape server-returned values');
assert.ok(html.includes('refresh()'), 'UI must support manual refresh');
assert.ok(!html.includes('const snapshot={generatedAt'), 'UI must not use a fabricated hard-coded snapshot');
console.log('[PASS] live mail control centre UI contract');
