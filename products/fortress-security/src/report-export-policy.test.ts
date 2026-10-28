import assert from 'node:assert/strict';
import { isReportExportRole } from './report-policy.js';
for (const role of ['OWNER', 'SECURITY_ADMIN', 'ANALYST'] as const) assert.equal(isReportExportRole(role), true);
assert.equal(isReportExportRole('VIEWER'), false);
console.log('FORTRESS export policy boundaries passed');
