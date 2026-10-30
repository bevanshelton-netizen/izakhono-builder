import assert from 'node:assert/strict';
import { authorizeGateway } from './gateway.js';
import type { ConsentGrant } from './types.js';

const consent: ConsentGrant = {
  subjectId: 'user-1',
  serviceId: 'mail',
  permissions: ['read:mail', 'send:mail'],
  dataDomains: ['communications'],
  grantedAt: '2026-10-30T00:00:00.000Z',
};

const allowed = authorizeGateway({
  subjectId: 'user-1', serviceId: 'mail', permission: 'read:mail',
  dataDomain: 'communications', path: '/mail/inbox', consent,
});
assert.equal(allowed.allowed, true);
assert.equal(allowed.route, '/mail');
assert.equal(allowed.externalBridgeAllowed, true);

const denied = authorizeGateway({
  subjectId: 'user-1', serviceId: 'mail', permission: 'read:files',
  dataDomain: 'communications', path: '/mail/inbox', consent,
});
assert.equal(denied.allowed, false);

const wrongRoute = authorizeGateway({
  subjectId: 'user-1', serviceId: 'mail', permission: 'read:mail',
  dataDomain: 'communications', path: '/cloud/files', consent,
});
assert.equal(wrongRoute.allowed, false);

const unknown = authorizeGateway({
  subjectId: 'user-1', serviceId: 'does-not-exist', permission: 'read:mail',
  dataDomain: 'communications', path: '/unknown', consent,
});
assert.equal(unknown.allowed, false);

console.log('I-NET gateway tests passed');
