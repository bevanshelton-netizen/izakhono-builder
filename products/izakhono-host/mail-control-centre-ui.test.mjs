import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('./mail-control-centre-ui.html',import.meta.url),'utf8');
for (const marker of ['IZAKHONO MAIL CONTROL CENTRE','Domain health','Mailbox operations','Security & incidents','No managed domains']) assert.ok(html.includes(marker),`missing UI marker: ${marker}`);
assert.ok(html.includes('escape') || html.includes('esc='),'UI must escape rendered values');
console.log('[PASS] mail control centre UI contract');
