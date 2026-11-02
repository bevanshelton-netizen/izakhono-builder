import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const checkout = 'https://pay.ikhokha.com/izakhono/mpr/businessofmusiceb';
const escapedCheckout = checkout.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

assert.match(html, /R149/);
assert.match(html, /Instant digital purchase/);
assert.match(html, new RegExp(escapedCheckout));
assert.ok((html.match(new RegExp(escapedCheckout, 'g')) || []).length >= 3);
assert.match(html, /TAKE THE 60-SECOND TEST/);
assert.match(html, /SHOW MY RESULT/);
assert.match(html, /function score\(\)/);

console.log('Business of Music campaign acceptance: PASS');
console.log('R149 offer, checkout CTA, test funnel and purchase link are present.');
