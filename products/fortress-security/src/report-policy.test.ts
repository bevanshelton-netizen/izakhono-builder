import assert from 'node:assert/strict';
import { isReportExportRole } from './report-policy.js';

assert.equal(isReportExportRole('OWNER'), true);
assert.equal(isReportExportRole('SECURITY_ADMIN'), true);
assert.equal(isReportExportRole('ANALYST'), true);
assert.equal(isReportExportRole('VIEWER'), false);
console.log('FORTRESS report policy passed');
