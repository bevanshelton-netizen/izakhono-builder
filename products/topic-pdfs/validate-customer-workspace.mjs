import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('public/topic-guides/index.html', 'utf8');
const js = readFileSync('public/topic-guides/app.js', 'utf8');
const css = readFileSync('public/topic-guides/styles.css', 'utf8');
const worker = readFileSync('src/sovereign.ts', 'utf8');

const checks = [
  ['customer account forms', /id="login-form"/.test(html) && /id="register-form"/.test(html)],
  ['arbitrary topic request form', /id="request-form"/.test(html) && /name="topic"/.test(html)],
  ['request progress list', /id="request-list"/.test(html)],
  ['purchased guide library', /id="library-list"/.test(html) && /Your guide library/.test(html)],
  ['library download links', /api\/topic-pdfs\/download\//.test(js) && /Download PDF/.test(js)],
  ['same-origin cookie requests', /credentials:\s*'same-origin'/.test(js)],
  ['safe DOM text rendering', /textContent/.test(js) && !/\.innerHTML\s*=/.test(js)],
  ['no browser token persistence', !/localStorage|sessionStorage/.test(js)],
  ['responsive mobile layout', /@media\s*\(max-width:\s*760px\)/.test(css)],
  ['workspace route and CSP', /topic-guides\/styles\.css/.test(html) && /frame-ancestors 'none'/.test(worker)],
  ['private fulfilment route wiring', /topicPdfFulfilmentRoute/.test(worker)],
  ['no third-party script or stylesheet', !/<script[^>]+src="https?:\/\//i.test(html) && !/<link[^>]+href="https?:\/\//i.test(html)],
];

for (const [name, passed] of checks) {
  assert.ok(passed, 'FAILED: ' + name);
  console.log('PASS ' + name);
}
console.log('Customer workspace checks passed.');
