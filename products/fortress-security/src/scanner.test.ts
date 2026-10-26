import assert from 'node:assert/strict';
import { validateScope } from './policy.js';

const scope = {
  owner: 'IZAKHONO',
  assets: [{ id: 'local', host: '127.0.0.1', ports: [443], httpUrls: ['https://127.0.0.1'] }]
};

const previous = process.env.FORTRESS_AUTHORIZED_SCAN;
delete process.env.FORTRESS_AUTHORIZED_SCAN;
assert.throws(() => validateScope(scope), /FORTRESS_AUTHORIZED_SCAN=1/);
process.env.FORTRESS_AUTHORIZED_SCAN = '1';
assert.doesNotThrow(() => validateScope(scope));
process.env.FORTRESS_AUTHORIZED_SCAN = previous;

console.log('FORTRESS policy test: PASS');
