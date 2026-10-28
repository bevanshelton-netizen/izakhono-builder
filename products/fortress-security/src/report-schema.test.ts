import assert from 'node:assert/strict';
import { FORTRESS_REPORT_FORMATS, FORTRESS_REPORT_VERSION } from './report-schema.js';

assert.equal(FORTRESS_REPORT_VERSION, '1.7');
assert.deepEqual(FORTRESS_REPORT_FORMATS, ['json', 'markdown']);
console.log('FORTRESS report schema passed');
