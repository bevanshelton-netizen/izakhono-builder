import assert from 'node:assert/strict';
import { authorize, can } from './access-control.js';

const owner = { id: 'owner-1', tenantId: 'tenant-a', role: 'OWNER' as const, active: true };
const admin = { id: 'admin-1', tenantId: 'tenant-a', role: 'SECURITY_ADMIN' as const, active: true };
const analyst = { id: 'user-1', tenantId: 'tenant-a', role: 'ANALYST' as const, active: true };
const viewer = { id: 'user-2', tenantId: 'tenant-a', role: 'VIEWER' as const, active: true };

assert.doesNotThrow(() => authorize(analyst, 'tenant-a', 'scan:run'));
assert.throws(() => authorize(viewer, 'tenant-a', 'scan:run'), /lacks scan:run/);
assert.throws(() => authorize(analyst, 'tenant-b', 'finding:read'), /cross-tenant/);
assert.throws(() => authorize({ ...analyst, active: false }, 'tenant-a', 'finding:read'), /inactive/);
assert.doesNotThrow(() => authorize(analyst, 'tenant-a', 'creator:generate'));
assert.throws(() => authorize(viewer, 'tenant-a', 'creator:write'), /lacks creator:write/);
assert.throws(() => authorize(analyst, 'tenant-b', 'creator:read'), /cross-tenant/);

// Publishing review permissions are least-privilege and entity-scoped.
assert.doesNotThrow(() => authorize(owner, 'tenant-a', 'publishing:review:approve'));
assert.doesNotThrow(() => authorize(admin, 'tenant-a', 'publishing:publisher:suspend'));
assert.doesNotThrow(() => authorize(analyst, 'tenant-a', 'publishing:review:request_evidence'));
assert.doesNotThrow(() => authorize(viewer, 'tenant-a', 'publishing:review:read'));
assert.equal(can(analyst, 'publishing:review:approve'), false, 'analysts cannot approve publishers');
assert.equal(can(analyst, 'publishing:publisher:list'), false, 'analysts cannot publish directory listings');
assert.equal(can(viewer, 'publishing:review:request_evidence'), false, 'viewers cannot request evidence');
assert.equal(can(viewer, 'publishing:review:read'), true, 'viewers retain read-only review access');
assert.throws(() => authorize(admin, 'tenant-b', 'publishing:review:approve'), /cross-tenant/);

console.log('FORTRESS access-control tests: PASS');
