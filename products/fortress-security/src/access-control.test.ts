import assert from 'node:assert/strict';
import { authorize } from './access-control.js';

const analyst = { id: 'user-1', tenantId: 'tenant-a', role: 'ANALYST' as const, active: true };
const viewer = { id: 'user-2', tenantId: 'tenant-a', role: 'VIEWER' as const, active: true };

assert.doesNotThrow(() => authorize(analyst, 'tenant-a', 'scan:run'));
assert.throws(() => authorize(viewer, 'tenant-a', 'scan:run'), /lacks scan:run/);
assert.throws(() => authorize(analyst, 'tenant-b', 'finding:read'), /cross-tenant/);
assert.throws(() => authorize({ ...analyst, active: false }, 'tenant-a', 'finding:read'), /inactive/);

console.log('FORTRESS access-control tests: PASS');
