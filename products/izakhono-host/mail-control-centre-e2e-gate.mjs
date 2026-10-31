import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'products/izakhono-host/MAIL-CONTROL-CENTRE-V1.md',
  'products/izakhono-host/mail-control-centre-state.json',
  'products/izakhono-host/mail-control-centre.ts',
  'products/izakhono-host/mail-control-centre.test.ts',
];

for (const relative of required) {
  assert.equal(fs.existsSync(path.join(root, relative)), true, `missing required artifact: ${relative}`);
}

const state = JSON.parse(fs.readFileSync(path.join(root, 'products/izakhono-host/mail-control-centre-state.json'), 'utf8'));
assert.equal(state.productionClaimsRequireEvidence, true);
assert.equal(state.contentAccess, 'separately-permissioned-and-audited');
assert.deepEqual(state.statusModel, ['configured', 'degraded', 'verified', 'failed']);

const contract = fs.readFileSync(path.join(root, 'products/izakhono-host/MAIL-CONTROL-CENTRE-V1.md'), 'utf8');
for (const phrase of [
  'Mailbox content is not exposed in the executive dashboard',
  'least privilege',
  'production-ready',
  'external capacity remains reversible',
]) {
  assert.equal(contract.includes(phrase), true, `missing control-plane contract phrase: ${phrase}`);
}

console.log('[PASS] Mail Control Centre end-to-end governance gate');
