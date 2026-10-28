import assert from 'node:assert/strict';
import { FORTRESS_REPORT_VERSION } from './report-schema.js';
assert.equal(FORTRESS_REPORT_VERSION, '1.7');
console.log('FORTRESS report version passed');
