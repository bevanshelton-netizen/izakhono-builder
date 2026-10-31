import assert from 'node:assert/strict';
import { mailControlCentreRoute } from './mail-control-centre-api';

const dashboard = mailControlCentreRoute({ role: 'owner', action: 'read-dashboard' });
assert.equal(dashboard.status, 'ok');
assert.ok(dashboard.snapshot);
assert.equal(dashboard.snapshot?.summary.managedDomains, 0);

const forbidden = mailControlCentreRoute({ role: 'unknown', action: 'read-dashboard' });
assert.equal(forbidden.status, 'forbidden');

const missing = mailControlCentreRoute({ role: 'auditor', action: 'read-domain', domain: 'not-managed.example' });
assert.equal(missing.status, 'not-found');

console.log('[PASS] mail control centre API contract');
