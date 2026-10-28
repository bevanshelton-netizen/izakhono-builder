import assert from 'node:assert/strict';
import { createSecurityReport } from './report.js';
import { reportingFixture } from './report-fixtures.js';

const report = createSecurityReport(reportingFixture);
assert.equal(report.tenantId, 'fixture-tenant');
assert.equal(report.summary.totalFindings, 0);
console.log('FORTRESS reporting fixture passed');
