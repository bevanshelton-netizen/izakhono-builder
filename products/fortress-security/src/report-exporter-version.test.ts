import assert from 'node:assert/strict';
import { REPORT_EXPORTER_VERSION } from './report-exporter-version.js';
assert.equal(REPORT_EXPORTER_VERSION, '1.7');
console.log('FORTRESS exporter version passed');
