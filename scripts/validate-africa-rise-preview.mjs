import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, preview, worker] = await Promise.all([
  readFile(new URL('../products/africa-rise/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/africa-rise/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/sovereign.ts', import.meta.url), 'utf8'),
]);

assert.equal(preview, source, 'The deployed preview asset must exactly match the reviewed AFRICA RISE source.');
for (const programme of ['Connect Africa', 'Build Africa', 'Empower Africa', 'Protect Africa', 'Trade Africa']) {
  assert.ok(source.includes(programme), `Missing founding programme: ${programme}`);
}
assert.match(source, /AFRICA RISE/);
assert.doesNotMatch(source, /<form\b/i, 'The preview must not collect enquiries before governance and privacy gates are approved.');
assert.doesNotMatch(source, /<script\b[^>]*\bsrc=/i, 'The preview must not load unreviewed third-party scripts.');
assert.match(worker, /africaRisePreviewPage/);
assert.match(worker, /\/africa-rise\/index\.html/);
assert.match(worker, /form-action 'none'/);
assert.match(worker, /africa-rise-branch-preview/);

console.log('AFRICA RISE branch preview contract: PASS');
